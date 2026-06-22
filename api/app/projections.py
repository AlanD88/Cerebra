"""Event → projection pipeline (data-architecture.md §3).

Two layers:
  * Pure functions over lightweight samples — the metric/heat math, fully unit
    testable with an injected clock.
  * A DB job (`run_projection`) that loads a concept's events, folds SM-2 over
    the recall log, computes metrics, and upserts `concept_metrics` +
    `review_schedule`.

The schedule and metrics are derived ONLY from the immutable event log, so the
projection is idempotent and replayable: drop the projection rows, replay, and
you get identical state.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .enums import HeatState
from .models import (
    Concept,
    ConceptMetric,
    ExplanationEvent,
    MetricSnapshot,
    ProblemAttempt,
    RecallEvent,
    RecallState,
    ReviewSchedule,
)
from .scheduler import ScheduleStep, initial_state, sm2_update

# --- Tunables (data-architecture.md notes "tune in Phase 6"). ----------------
RECENCY_LAMBDA = math.log(2) / 30.0  # 30-day half-life on recency weighting
EXPLANATION_BONUS_CAP = 0.05
DORMANT_DAYS = 180.0
PROJECTION_VERSION = 1

W_RECALL = 0.45
W_PROBLEM = 0.25
W_RETENTION = 0.30


# --------------------------------------------------------------------------- #
# Plain samples — decouple the math from the ORM.
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class RecallSample:
    score: int
    occurred_at: datetime


@dataclass(frozen=True)
class ProblemSample:
    is_correct: bool
    partial: float | None
    occurred_at: datetime


@dataclass(frozen=True)
class ExplanationSample:
    quality: int | None
    direction: str
    occurred_at: datetime


@dataclass(frozen=True)
class ScheduleResult:
    interval_days: float
    ease_factor: float
    repetitions: int
    last_score: int | None
    due_at: datetime | None
    stability: float
    last_reviewed_at: datetime | None


@dataclass(frozen=True)
class MetricsResult:
    mastery: float
    retention: float
    recall_accuracy: float
    problem_accuracy: float
    heat_state: HeatState
    stability: float
    review_count: int
    last_reviewed_at: datetime | None


def ensure_utc(dt: datetime) -> datetime:
    """Coerce naive datetimes (e.g. read back from SQLite) to UTC-aware."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _days_between(later: datetime, earlier: datetime) -> float:
    return (ensure_utc(later) - ensure_utc(earlier)).total_seconds() / 86400.0


def _recency_weight(age_days: float) -> float:
    return math.exp(-RECENCY_LAMBDA * max(age_days, 0.0))


def recency_weighted_average(samples: list[tuple[float, float]]) -> float:
    """samples = [(value, age_days)]. Returns 0.0 when empty."""
    num = 0.0
    den = 0.0
    for value, age in samples:
        w = _recency_weight(age)
        num += w * value
        den += w
    return num / den if den > 0 else 0.0


# --------------------------------------------------------------------------- #
# Stage 3 · Schedule (SM-2 fold over the recall log)
# --------------------------------------------------------------------------- #
def compute_schedule(recalls: list[RecallSample]) -> ScheduleResult:
    state = initial_state()
    step: ScheduleStep | None = None
    last_reviewed: datetime | None = None

    for ev in sorted(recalls, key=lambda r: ensure_utc(r.occurred_at)):
        step = sm2_update(state, ev.score, ensure_utc(ev.occurred_at))
        state = step.state
        last_reviewed = ensure_utc(ev.occurred_at)

    return ScheduleResult(
        interval_days=state.interval_days,
        ease_factor=state.ease_factor,
        repetitions=state.repetitions,
        last_score=state.last_score,
        due_at=step.due_at if step else None,
        stability=step.stability if step else 0.0,
        last_reviewed_at=last_reviewed,
    )


# --------------------------------------------------------------------------- #
# Stage 2 · Derive (metrics + heat)
# --------------------------------------------------------------------------- #
def derive_heat(
    mastery: float, retention: float, days_since: float | None, reviewed: bool
) -> HeatState:
    """Deterministic precedence over the overlapping conditions in §5."""
    if not reviewed or days_since is None:
        return HeatState.frozen
    if days_since > DORMANT_DAYS:
        return HeatState.frozen
    if mastery >= 0.85 and retention >= 0.80:
        return HeatState.mastered
    if mastery < 0.40 or retention < 0.50:
        return HeatState.cold
    if mastery >= 0.70:
        return HeatState.hot
    if mastery >= 0.40:
        return HeatState.warm
    return HeatState.cold


def score_heat(score: int) -> HeatState:
    """Map a single recall score to a heat state for a per-prompt RecallState."""
    return {
        3: HeatState.mastered,
        2: HeatState.hot,
        1: HeatState.cold,
        0: HeatState.frozen,
    }[score]


def _explanation_bonus(explanations: list[ExplanationSample], now: datetime) -> float:
    samples = [
        (e.quality / 3.0, _days_between(now, e.occurred_at))
        for e in explanations
        if e.direction == "learner_to_ai" and e.quality is not None
    ]
    if not samples:
        return 0.0
    return EXPLANATION_BONUS_CAP * recency_weighted_average(samples)


def compute_metrics(
    recalls: list[RecallSample],
    problems: list[ProblemSample],
    explanations: list[ExplanationSample],
    schedule: ScheduleResult,
    now: datetime,
) -> MetricsResult:
    now = ensure_utc(now)

    recall_accuracy = recency_weighted_average(
        [(r.score / 3.0, _days_between(now, r.occurred_at)) for r in recalls]
    )
    problem_accuracy = recency_weighted_average(
        [
            (1.0 if p.is_correct else (p.partial or 0.0), _days_between(now, p.occurred_at))
            for p in problems
        ]
    )

    stability = schedule.stability
    if schedule.last_reviewed_at is not None and stability > 0:
        days_since: float | None = _days_between(now, schedule.last_reviewed_at)
        retention = math.exp(-days_since / stability)
    else:
        days_since = None
        retention = 0.0

    base = W_RECALL * recall_accuracy + W_PROBLEM * problem_accuracy + W_RETENTION * retention
    mastery = min(1.0, max(0.0, base + _explanation_bonus(explanations, now)))

    heat = derive_heat(mastery, retention, days_since, reviewed=len(recalls) > 0)

    return MetricsResult(
        mastery=mastery,
        retention=retention,
        recall_accuracy=recall_accuracy,
        problem_accuracy=problem_accuracy,
        heat_state=heat,
        stability=stability,
        review_count=len(recalls),
        last_reviewed_at=schedule.last_reviewed_at,
    )


# --------------------------------------------------------------------------- #
# DB job — load events, compute, upsert projections
# --------------------------------------------------------------------------- #
def _load_samples(db: Session, concept_id):
    recalls = [
        RecallSample(score=r.score, occurred_at=ensure_utc(r.occurred_at))
        for r in db.scalars(select(RecallEvent).where(RecallEvent.concept_id == concept_id))
    ]
    problems = [
        ProblemSample(is_correct=p.is_correct, partial=p.partial, occurred_at=ensure_utc(p.occurred_at))
        for p in db.scalars(select(ProblemAttempt).where(ProblemAttempt.concept_id == concept_id))
    ]
    explanations = [
        ExplanationSample(
            quality=e.quality, direction=e.direction.value, occurred_at=ensure_utc(e.occurred_at)
        )
        for e in db.scalars(
            select(ExplanationEvent).where(ExplanationEvent.concept_id == concept_id)
        )
    ]
    return recalls, problems, explanations


def run_projection(db: Session, concept_id, now: datetime | None = None) -> MetricsResult:
    """Project a single concept. Idempotent: rewrites both projection rows."""
    now = ensure_utc(now or datetime.now(timezone.utc))

    recalls, problems, explanations = _load_samples(db, concept_id)
    schedule = compute_schedule(recalls)
    metrics = compute_metrics(recalls, problems, explanations, schedule, now)

    cm = db.get(ConceptMetric, concept_id) or ConceptMetric(concept_id=concept_id)
    cm.mastery = metrics.mastery
    cm.retention = metrics.retention
    cm.recall_accuracy = metrics.recall_accuracy
    cm.problem_accuracy = metrics.problem_accuracy
    cm.heat_state = metrics.heat_state
    cm.stability = metrics.stability
    cm.review_count = metrics.review_count
    cm.last_reviewed_at = metrics.last_reviewed_at
    cm.projection_version = PROJECTION_VERSION
    cm.updated_at = now
    db.add(cm)

    rs = db.get(ReviewSchedule, concept_id) or ReviewSchedule(concept_id=concept_id)
    rs.due_at = schedule.due_at
    rs.interval_days = schedule.interval_days
    rs.ease_factor = schedule.ease_factor
    rs.repetitions = schedule.repetitions
    rs.last_score = schedule.last_score
    rs.last_reviewed_at = schedule.last_reviewed_at
    rs.updated_at = now
    db.add(rs)

    _rebuild_recall_states(db, concept_id, now)

    db.flush()
    return metrics


def _rebuild_recall_states(db: Session, concept_id, now: datetime) -> None:
    """Latest recall outcome per distinct prompt — idempotent (delete + rebuild)."""
    db.query(RecallState).filter(RecallState.concept_id == concept_id).delete(
        synchronize_session=False
    )
    latest: dict[str, RecallEvent] = {}
    for ev in db.scalars(select(RecallEvent).where(RecallEvent.concept_id == concept_id)):
        at = ensure_utc(ev.occurred_at)
        prior = latest.get(ev.prompt)
        if prior is None or at >= ensure_utc(prior.occurred_at):
            latest[ev.prompt] = ev
    for prompt, ev in latest.items():
        db.add(
            RecallState(
                concept_id=concept_id,
                prompt=prompt,
                last_score=ev.score,
                last_occurred_at=ensure_utc(ev.occurred_at),
                heat_state=score_heat(ev.score),
                updated_at=now,
            )
        )


def run_all_projections(db: Session, now: datetime | None = None) -> int:
    """Replay every concept's projection. Returns the count processed."""
    now = ensure_utc(now or datetime.now(timezone.utc))
    concept_ids = list(db.scalars(select(Concept.id)))
    for cid in concept_ids:
        run_projection(db, cid, now=now)
    return len(concept_ids)


# --------------------------------------------------------------------------- #
# Heat from an aggregate mastery (used where only avg mastery is known, e.g.
# subject rollups). Matches the client heatState bands (foundations.md §4).
# --------------------------------------------------------------------------- #
def heat_from_mastery(mastery_fraction: float) -> HeatState:
    m = mastery_fraction * 100.0
    if m >= 85:
        return HeatState.mastered
    if m >= 70:
        return HeatState.hot
    if m >= 50:
        return HeatState.warm
    if m >= 25:
        return HeatState.cold
    return HeatState.frozen


# --------------------------------------------------------------------------- #
# Daily snapshots (metric_snapshots) — the all-subjects rollup time series the
# RetentionTrends card reads. Derived solely from the event log; idempotent
# (delete + rebuild the rollup each run).
# --------------------------------------------------------------------------- #
def regenerate_snapshots(db: Session, now: datetime | None = None, window_days: int = 30) -> int:
    now = ensure_utc(now or datetime.now(timezone.utc))

    db.query(MetricSnapshot).filter(
        MetricSnapshot.concept_id.is_(None), MetricSnapshot.subject_id.is_(None)
    ).delete(synchronize_session=False)
    db.flush()

    recalls_by: dict = defaultdict(list)
    problems_by: dict = defaultdict(list)
    expl_by: dict = defaultdict(list)
    for r in db.scalars(select(RecallEvent)):
        recalls_by[r.concept_id].append(RecallSample(r.score, ensure_utc(r.occurred_at)))
    for p in db.scalars(select(ProblemAttempt)):
        problems_by[p.concept_id].append(
            ProblemSample(p.is_correct, p.partial, ensure_utc(p.occurred_at))
        )
    for e in db.scalars(select(ExplanationEvent)):
        expl_by[e.concept_id].append(
            ExplanationSample(e.quality, e.direction.value, ensure_utc(e.occurred_at))
        )

    concept_ids = list(db.scalars(select(Concept.id)))
    today: date = now.date()
    rows: list[MetricSnapshot] = []

    for offset in range(window_days - 1, -1, -1):
        day = today - timedelta(days=offset)
        cutoff = datetime.combine(day, time.max, tzinfo=timezone.utc)
        if cutoff > now:
            cutoff = now

        masteries: list[float] = []
        retentions: list[float] = []
        for cid in concept_ids:
            recs = [s for s in recalls_by[cid] if s.occurred_at <= cutoff]
            if not recs:
                continue
            probs = [s for s in problems_by[cid] if s.occurred_at <= cutoff]
            expls = [s for s in expl_by[cid] if s.occurred_at <= cutoff]
            schedule = compute_schedule(recs)
            m = compute_metrics(recs, probs, expls, schedule, now=cutoff)
            masteries.append(m.mastery)
            retentions.append(m.retention)

        reviews = sum(
            1 for samples in recalls_by.values() for s in samples if s.occurred_at.date() == day
        )
        rows.append(
            MetricSnapshot(
                subject_id=None,
                concept_id=None,
                as_of=day,
                mastery=(sum(masteries) / len(masteries)) if masteries else 0.0,
                retention=(sum(retentions) / len(retentions)) if retentions else 0.0,
                reviews=reviews,
            )
        )

    db.add_all(rows)
    db.flush()
    return len(rows)

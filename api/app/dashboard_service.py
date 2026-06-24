"""Dashboard read aggregations. These compute server-side from PROJECTION rows
(concept_metrics, review_schedule, metric_snapshots) — never from raw events.
Kept separate from the routers so the aggregation logic is unit-testable."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Concept, ConceptMetric, MetricSnapshot, ReviewSchedule, Subject
from .projections import ensure_utc, heat_from_mastery
from .schemas import (
    DueSummaryOut,
    HeatCellOut,
    HeatRowOut,
    LearningHealthOut,
    RetentionTrendsOut,
    ReviewCountPoint,
    SubjectProgressOut,
    WeakConceptOut,
)


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def due_summary(db: Session, now: datetime | None = None) -> DueSummaryOut:
    """Overdue vs. due-today review counts and how many subjects they span — the
    dashboard's "what's due" hero. Comparison is done in Python so the result is
    identical on SQLite (which stores naive timestamps) and PostgreSQL."""
    now = ensure_utc(now or datetime.now(timezone.utc))
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    tomorrow_start = today_start + timedelta(days=1)

    rows = db.execute(
        select(ReviewSchedule.due_at, Concept.subject_id).join(
            Concept, Concept.id == ReviewSchedule.concept_id
        )
    ).all()

    overdue = 0
    due_today = 0
    subjects: set = set()
    for due_at, subject_id in rows:
        if due_at is None:
            continue
        d = ensure_utc(due_at)
        if d < today_start:
            overdue += 1
            subjects.add(subject_id)
        elif d < tomorrow_start:
            due_today += 1
            subjects.add(subject_id)

    return DueSummaryOut(
        total=overdue + due_today, overdue=overdue, due_today=due_today, subjects=len(subjects)
    )


def weak_concepts(db: Session, limit: int = 5) -> list[WeakConceptOut]:
    """The lowest-mastery concepts the learner has actually engaged
    (``review_count > 0``), so never-reviewed concepts don't masquerade as weak."""
    rows = db.execute(
        select(ConceptMetric, Concept.name, Subject.name)
        .join(Concept, Concept.id == ConceptMetric.concept_id)
        .join(Subject, Subject.id == Concept.subject_id)
        .where(ConceptMetric.review_count > 0)  # "forgetting" => already engaged
        .order_by(ConceptMetric.mastery.asc())
        .limit(limit)
    ).all()
    return [
        WeakConceptOut(
            concept_id=cm.concept_id,
            name=cname,
            subject=sname,
            mastery=cm.mastery,
            heat_state=cm.heat_state,
        )
        for cm, cname, sname in rows
    ]


def retention_trends(db: Session, days: int = 30) -> RetentionTrendsOut:
    """The last ``days`` of the global daily snapshot (the rows with both
    subject_id and concept_id NULL — the all-up rollup) as a retention sparkline
    plus reviews-per-day. Snapshots are written by the projection, not computed here."""
    rows = (
        db.scalars(
            select(MetricSnapshot)
            .where(MetricSnapshot.concept_id.is_(None), MetricSnapshot.subject_id.is_(None))
            .order_by(MetricSnapshot.as_of.asc())
        )
        .all()
    )
    rows = rows[-days:]
    return RetentionTrendsOut(
        points=[r.retention for r in rows],
        reviews=[ReviewCountPoint(day=r.as_of, count=r.reviews) for r in rows],
    )


def learning_health(db: Session, now: datetime | None = None) -> LearningHealthOut:
    """Headline averages (mastery, retention) over reviewed concepts, plus the
    retention change vs. ~7 days ago read from the snapshot history."""
    now = ensure_utc(now or datetime.now(timezone.utc))
    metrics = db.scalars(select(ConceptMetric)).all()
    reviewed = [m for m in metrics if m.review_count > 0]
    avg_mastery = _mean([m.mastery for m in reviewed])
    retention = _mean([m.retention for m in reviewed])

    subjects = db.scalar(select(func.count(func.distinct(Concept.subject_id)))) or 0

    cutoff = now.date() - timedelta(days=7)
    past = db.scalars(
        select(MetricSnapshot)
        .where(
            MetricSnapshot.concept_id.is_(None),
            MetricSnapshot.subject_id.is_(None),
            MetricSnapshot.as_of <= cutoff,
        )
        .order_by(MetricSnapshot.as_of.desc())
    ).first()
    retention_delta = retention - past.retention if past is not None else 0.0

    return LearningHealthOut(
        avg_mastery=avg_mastery,
        retention=retention,
        retention_delta=retention_delta,
        tracked=len(reviewed),
        subjects=subjects,
    )


def knowledge_heatmap(db: Session) -> list[HeatRowOut]:
    """Every concept metric as a heat cell, grouped by subject (strongest first
    within each), for the dashboard's at-a-glance heat grid."""
    rows = db.execute(
        select(
            Subject.name,
            ConceptMetric.concept_id,
            Concept.name,
            ConceptMetric.heat_state,
            ConceptMetric.mastery,
        )
        .join(Concept, Concept.id == ConceptMetric.concept_id)
        .join(Subject, Subject.id == Concept.subject_id)
        .order_by(Subject.name.asc(), ConceptMetric.mastery.desc())
    ).all()

    grouped: "OrderedDict[str, list[HeatCellOut]]" = OrderedDict()
    for subject_name, concept_id, concept_name, heat_state, mastery in rows:
        grouped.setdefault(subject_name, []).append(
            HeatCellOut(
                concept_id=concept_id, name=concept_name, heat_state=heat_state, mastery=mastery
            )
        )
    return [HeatRowOut(subject=name, cells=cells) for name, cells in grouped.items()]


def subject_progress(db: Session) -> list[SubjectProgressOut]:
    """Average mastery + derived heat per subject, over reviewed concepts only,
    sorted strongest first. Backs both the dashboard card and the Subjects page."""
    rows = db.execute(
        select(
            Subject.id,
            Subject.name,
            ConceptMetric.mastery,
            ConceptMetric.review_count,
        )
        .join(Concept, Concept.subject_id == Subject.id)
        .join(ConceptMetric, ConceptMetric.concept_id == Concept.id)
    ).all()

    by_subject: "OrderedDict[tuple, list[float]]" = OrderedDict()
    for subject_id, subject_name, mastery, review_count in rows:
        key = (subject_id, subject_name)
        by_subject.setdefault(key, [])
        if review_count > 0:
            by_subject[key].append(mastery)

    out = [
        SubjectProgressOut(
            subject_id=subject_id,
            name=subject_name,
            avg_mastery=_mean(masteries),
            heat_state=heat_from_mastery(_mean(masteries)),
        )
        for (subject_id, subject_name), masteries in by_subject.items()
    ]
    out.sort(key=lambda s: s.avg_mastery, reverse=True)
    return out

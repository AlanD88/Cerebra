"""Review session orchestration (review-frontend.md). Builds a queue of due
items, and on assess: scores the answer server-side, appends an immutable
recall_event, re-projects (SM-2 → review_schedule + concept_metrics), and
returns the read-only outcome. The client never sends or proposes a score."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .enums import HeatState
from .models import (
    Concept,
    ConceptMetric,
    RecallEvent,
    ReviewSchedule,
    ReviewSession,
    ReviewSessionItem,
    Subject,
)
from .projections import ensure_utc, regenerate_snapshots, run_projection
from .scoring import LABELS, assess_answer
from .schemas import AssessResultOut, DueReviewOut, ReviewItemOut, ReviewSessionOut


def _build_prompt(concept: Concept) -> str:
    return f"Explain {concept.name} in your own words, and state its defining relationship."


def due_reviews(db: Session, now: datetime | None = None) -> list[DueReviewOut]:
    """The concepts due now, read straight from review_schedule (a projection
    table) — never a live event scan. A clean read for "what's due" that, unlike
    create_session, does not materialize a ReviewSession row. Comparison is done
    in Python so the result is identical on SQLite and PostgreSQL."""
    now = ensure_utc(now or datetime.now(timezone.utc))
    rows = db.execute(
        select(Concept, ConceptMetric, ReviewSchedule.due_at, Subject.name)
        .join(ReviewSchedule, ReviewSchedule.concept_id == Concept.id)
        .join(Subject, Subject.id == Concept.subject_id)
        .outerjoin(ConceptMetric, ConceptMetric.concept_id == Concept.id)
    ).all()

    due = [
        (concept, metric, due_at, subject_name)
        for concept, metric, due_at, subject_name in rows
        if due_at is not None and ensure_utc(due_at) <= now
    ]
    due.sort(key=lambda r: (ensure_utc(r[2]), r[0].name))

    return [
        DueReviewOut(
            concept_id=concept.id,
            name=concept.name,
            subject=subject_name,
            mastery=metric.mastery if metric else 0.0,
            heat_state=metric.heat_state if metric else HeatState.frozen,
            due_at=due_at,
        )
        for concept, metric, due_at, subject_name in due
    ]


def create_session(
    db: Session, concept_id=None, now: datetime | None = None
) -> ReviewSessionOut:
    """Build a session queue: one item for the given concept, or one per concept
    due now (read from review_schedule, never from raw events). Caller commits."""
    now = ensure_utc(now or datetime.now(timezone.utc))

    if concept_id is not None:
        concepts = list(db.scalars(select(Concept).where(Concept.id == concept_id)))
    else:
        # All due concepts (review_schedule.due_at <= now), aggregated in Python
        # from the projection table (never from raw events).
        rows = db.execute(
            select(Concept, ReviewSchedule.due_at).join(
                ReviewSchedule, ReviewSchedule.concept_id == Concept.id
            )
        ).all()
        concepts = [
            c for c, due_at in rows if due_at is not None and ensure_utc(due_at) <= now
        ]
        concepts.sort(key=lambda c: c.name)

    session = ReviewSession()
    db.add(session)
    db.flush()

    for i, concept in enumerate(concepts):
        db.add(
            ReviewSessionItem(
                session_id=session.id,
                concept_id=concept.id,
                prompt=_build_prompt(concept),
                model_answer=concept.definition,
                order_index=i,
            )
        )
    db.flush()
    return get_session(db, session.id)


def get_session(db: Session, session_id) -> ReviewSessionOut | None:
    """Hydrate a session into its DTO (prompts only — never the score).
    ``concept_name`` is set only for single-item sessions, for the header."""
    session = db.get(ReviewSession, session_id)
    if session is None:
        return None

    items_out: list[ReviewItemOut] = []
    concept_name = None
    for item in session.items:
        name = db.scalar(select(Concept.name).where(Concept.id == item.concept_id))
        concept_name = name
        items_out.append(
            ReviewItemOut(
                item_id=item.id,
                concept_id=item.concept_id,
                concept_name=name,
                prompt=item.prompt,
            )
        )

    return ReviewSessionOut(
        session_id=session.id,
        total=len(items_out),
        concept_name=concept_name if len(items_out) == 1 else None,
        items=items_out,
    )


def assess(
    db: Session, session_id, item_id, learner_answer: str, now: datetime | None = None
) -> AssessResultOut | None:
    """The single write in the review loop. Score the answer (server-side — the
    learner never proposes a score), append an immutable ``recall_event``, then
    re-derive the schedule + metrics from the event log via the projection, and
    return the read-only outcome. Returns None if the item isn't in this session;
    caller commits."""
    now = ensure_utc(now or datetime.now(timezone.utc))
    item = db.get(ReviewSessionItem, item_id)
    if item is None or item.session_id != session_id:
        return None

    concept = db.get(Concept, item.concept_id)
    assessment = assess_answer(concept, learner_answer)

    # Append the immutable event, then re-derive everything from the log.
    db.add(
        RecallEvent(
            concept_id=concept.id,
            prompt=item.prompt,
            learner_answer=learner_answer,
            model_answer=item.model_answer,
            score=assessment.score,
            rationale=assessment.rationale,
            assessed_by=assessment.assessed_by,
            occurred_at=now,
        )
    )
    db.flush()

    run_projection(db, concept.id, now=now)
    regenerate_snapshots(db, now=now)

    item.assessed = True
    item.score = assessment.score
    db.flush()

    schedule = db.get(ReviewSchedule, concept.id)
    metric = db.get(ConceptMetric, concept.id)

    return AssessResultOut(
        score=assessment.score,
        label=LABELS[assessment.score],
        rationale=assessment.rationale,
        next_interval_days=schedule.interval_days if schedule else 0.0,
        heat_state=metric.heat_state if metric else HeatState.frozen,
        model_answer=item.model_answer,
    )

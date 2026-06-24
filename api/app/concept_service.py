"""Concept Page read aggregations (concept-page-frontend.md §2/§3). Reads
projection + concept tables only; the AI insight is a deterministic heuristic
over projection data (no external model call required to run)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .enums import HeatState, RelationshipType
from .models import (
    Concept,
    ConceptMetric,
    ConceptRelationship,
    RecallState,
    ReviewSchedule,
    Subject,
)
from .projections import ensure_utc
from .schemas import (
    ConceptDetailOut,
    DependencyOut,
    InsightOut,
    RecallCardOut,
    RecallItemOut,
)


def get_concept_detail(db: Session, concept_id) -> ConceptDetailOut | None:
    """The Concept Page core read: the concept joined to its metric projection and
    next due date. Returns None for an unknown id (router → 404); a concept that
    has never been reviewed has no metric row and reads as zeros / frozen."""
    row = db.execute(
        select(Concept, Subject.name, ConceptMetric, ReviewSchedule.due_at)
        .join(Subject, Subject.id == Concept.subject_id)
        .outerjoin(ConceptMetric, ConceptMetric.concept_id == Concept.id)
        .outerjoin(ReviewSchedule, ReviewSchedule.concept_id == Concept.id)
        .where(Concept.id == concept_id)
    ).first()
    if row is None:
        return None

    concept, subject_name, metric, due_at = row
    return ConceptDetailOut(
        concept_id=concept.id,
        name=concept.name,
        subject=subject_name,
        breadcrumb=subject_name,
        importance=concept.importance,
        mastery=metric.mastery if metric else 0.0,
        retention=metric.retention if metric else 0.0,
        recall_accuracy=metric.recall_accuracy if metric else 0.0,
        problem_accuracy=metric.problem_accuracy if metric else 0.0,
        heat_state=metric.heat_state if metric else HeatState.frozen,
        review_count=metric.review_count if metric else 0,
        due_at=ensure_utc(due_at) if due_at is not None else None,
        intuition=concept.intuition,
        definition=concept.definition,
        notes=concept.notes,
        viz_spec=concept.viz_spec,
    )


def get_recall_card(db: Session, concept_id, now: datetime | None = None) -> RecallCardOut:
    """The most recent recall prompts for this concept (newest first, from the
    per-prompt RecallState projection) plus whether the concept is due now."""
    now = ensure_utc(now or datetime.now(timezone.utc))
    schedule = db.get(ReviewSchedule, concept_id)
    due = 1 if schedule and schedule.due_at and ensure_utc(schedule.due_at) <= now else 0

    rows = db.scalars(
        select(RecallState)
        .where(RecallState.concept_id == concept_id)
        .order_by(RecallState.last_occurred_at.desc())
        .limit(8)
    ).all()
    items = [
        RecallItemOut(prompt=r.prompt, last_score=r.last_score, heat_state=r.heat_state)
        for r in rows
    ]
    return RecallCardOut(due_count=due, items=items)


def get_dependencies(db: Session, concept_id) -> list[DependencyOut]:
    """Prerequisite concepts (relationships where this concept is the target), each
    with its current heat/mastery. The weakest is flagged ``is_root_weakness`` so
    the UI can point the learner at the true blocker beneath a struggling concept."""
    rows = db.execute(
        select(
            ConceptRelationship.source_concept_id,
            Concept.name,
            ConceptMetric.heat_state,
            ConceptMetric.mastery,
        )
        .join(Concept, Concept.id == ConceptRelationship.source_concept_id)
        .outerjoin(ConceptMetric, ConceptMetric.concept_id == ConceptRelationship.source_concept_id)
        .where(
            ConceptRelationship.target_concept_id == concept_id,
            ConceptRelationship.type == RelationshipType.prerequisite,
        )
    ).all()

    deps = [
        DependencyOut(
            concept_id=source_id,
            name=name,
            heat_state=heat_state or HeatState.frozen,
            mastery=mastery if mastery is not None else 0.0,
            is_root_weakness=False,
        )
        for source_id, name, heat_state, mastery in rows
    ]
    if deps:
        weakest = min(deps, key=lambda d: d.mastery)
        weakest.is_root_weakness = True
    return deps


def _heat_label(state: HeatState) -> str:
    return state.value.capitalize()


def get_insight(db: Session, concept_id) -> InsightOut | None:
    """A deterministic "AI insight" derived purely from projection data — no model
    call, so it always runs offline. When a prerequisite is the root weakness and
    is cold/frozen, it names that concept and suggests reviewing it; otherwise it
    returns a generic nudge. (A real model could later swap in behind this shape.)"""
    detail = get_concept_detail(db, concept_id)
    if detail is None:
        return None

    deps = get_dependencies(db, concept_id)
    root = next((d for d in deps if d.is_root_weakness), None)

    recall_word = "strong" if detail.recall_accuracy >= 0.7 else "still developing"
    if detail.problem_accuracy < detail.recall_accuracy - 0.1:
        gap = "but problem accuracy trails"
    else:
        gap = "and problem accuracy keeps pace"

    if root is not None and root.heat_state in {HeatState.cold, HeatState.frozen}:
        summary = (
            f"Recall is {recall_word}, {gap}. The gap traces back to "
            f"{root.name} ({_heat_label(root.heat_state)}) — a short review there "
            f"should unlock faster progress here."
        )
        return InsightOut(summary=summary, suggested_concept_id=root.concept_id, cta=f"Review {root.name}")

    summary = f"Recall is {recall_word}, {gap}. Keep practicing to deepen retention."
    return InsightOut(summary=summary, suggested_concept_id=None, cta="Practice recall")

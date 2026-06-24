"""Ingest write-surface — authoring + event logging for the deep-learn bridge.

Cerebra's review loop (``review_service.assess``) is the reference write path:
append an immutable event, then re-derive everything from the log via the
projection. This module generalizes that pattern so an external client (the
``cerebra`` MCP server) can upsert content and log recall/problem/explanation
events. Every write still flows through ``projections.run_projection`` +
``regenerate_snapshots`` — mastery stays derived, never stored directly, and the
returned outcomes are read-only (the score is server-assigned, invariant #3).

References (``subject``/``concept``) accept a name **or** a UUID string; names are
resolved within the subject (concept slugs are unique per subject). Single-event
helpers project + snapshot themselves; ``sync_session`` batches so each touched
concept is projected once and snapshots are regenerated once.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .enums import ExplanationDirection, HeatState, RelationshipType
from .models import (
    Concept,
    ConceptMetric,
    ConceptRelationship,
    ExplanationEvent,
    ProblemAttempt,
    RecallEvent,
    ReviewSchedule,
    Subject,
)
from .projections import ensure_utc, regenerate_snapshots, run_projection
from .schemas import (
    ConceptRefOut,
    IngestOutcomeOut,
    RelationshipOut,
    SessionIn,
    SessionOutcomeOut,
    SubjectRefOut,
)

# deep-learn's 3-grade ladder → Cerebra's 0–3 recall score. Partial→1 keeps the
# SM-2 lapse semantics (q<=1 resets the interval), matching deep-learn's
# Partial→reset. Consistent with projections.score_heat.
_GRADE_TO_SCORE = {"full": 3, "partial": 1, "forgotten": 0}


class IngestError(Exception):
    """Raised when a reference can't be resolved; the router maps it to a 422."""


def slugify(name: str) -> str:
    """Dash-cased, lowercased slug. Concept slugs are unique per subject, so this
    is the stable key a vault topic name maps to (e.g. "Eigenvectors" → "eigenvectors",
    "Singular Value Decomposition" → "singular-value-decomposition")."""
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    return s.strip("-") or "concept"


def grade_to_score(grade: str | None, score: int | None = None) -> int:
    """Resolve a recall score from an explicit ``score`` or a 3-grade label."""
    if score is not None:
        if not 0 <= score <= 3:
            raise IngestError(f"score must be in 0..3, got {score}")
        return score
    if grade is None:
        raise IngestError("recall requires either a grade or a score")
    key = grade.strip().lower()
    if key not in _GRADE_TO_SCORE:
        raise IngestError(f"grade must be one of {sorted(_GRADE_TO_SCORE)}, got {grade!r}")
    return _GRADE_TO_SCORE[key]


def _as_uuid(ref: str | uuid.UUID) -> uuid.UUID | None:
    if isinstance(ref, uuid.UUID):
        return ref
    try:
        return uuid.UUID(str(ref))
    except (ValueError, AttributeError, TypeError):
        return None


# --------------------------------------------------------------------------- #
# Resolution
# --------------------------------------------------------------------------- #
def resolve_subject(db: Session, ref: str | uuid.UUID) -> Subject | None:
    """Resolve a subject by UUID or by exact name."""
    sid = _as_uuid(ref)
    if sid is not None:
        subject = db.get(Subject, sid)
        if subject is not None:
            return subject
    return db.scalar(select(Subject).where(Subject.name == str(ref)))


def resolve_concept(db: Session, subject: Subject | None, ref: str | uuid.UUID) -> Concept | None:
    """Resolve a concept by UUID, or by name/slug within ``subject``."""
    cid = _as_uuid(ref)
    if cid is not None:
        concept = db.get(Concept, cid)
        if concept is not None:
            return concept
    if subject is None:
        return None
    name = str(ref)
    return db.scalar(
        select(Concept).where(
            Concept.subject_id == subject.id,
            (Concept.name == name) | (Concept.slug == slugify(name)),
        )
    )


# --------------------------------------------------------------------------- #
# Upserts (structural)
# --------------------------------------------------------------------------- #
def upsert_subject(db: Session, name: str, description: str | None = None) -> tuple[Subject, bool]:
    """Get-or-create a subject by name; update the description when provided."""
    subject = db.scalar(select(Subject).where(Subject.name == name))
    created = subject is None
    if subject is None:
        subject = Subject(name=name, description=description)
        db.add(subject)
        db.flush()
    elif description is not None and description != subject.description:
        subject.description = description
    return subject, created


def upsert_concept(
    db: Session,
    subject: Subject,
    name: str,
    *,
    slug: str | None = None,
    importance: int = 3,
    intuition: str | None = None,
    definition: str | None = None,
    notes: str | None = None,
    viz_spec: dict | None = None,
) -> tuple[Concept, bool]:
    """Get-or-create a concept by ``(subject, slug)``; update authored fields when
    supplied (mirrors the field set authored in seed.py). Never touches metrics."""
    final_slug = slug or slugify(name)
    concept = db.scalar(
        select(Concept).where(Concept.subject_id == subject.id, Concept.slug == final_slug)
    )
    created = concept is None
    if concept is None:
        concept = Concept(
            subject_id=subject.id,
            name=name,
            slug=final_slug,
            importance=importance,
            intuition=intuition,
            definition=definition,
            notes=notes,
            viz_spec=viz_spec,
        )
        db.add(concept)
        db.flush()
        return concept, created

    # Update authored fields in place (idempotent re-author). Only overwrite with
    # values that were actually supplied, so a bare re-sync doesn't wipe content.
    concept.name = name
    if importance is not None:
        concept.importance = importance
    for field, value in (
        ("intuition", intuition),
        ("definition", definition),
        ("notes", notes),
        ("viz_spec", viz_spec),
    ):
        if value is not None:
            setattr(concept, field, value)
    db.flush()
    return concept, created


def add_relationship(
    db: Session,
    subject: Subject,
    source: Concept,
    target: Concept,
    type: str = "prerequisite",
    strength: float | None = None,
) -> tuple[ConceptRelationship, bool]:
    """Upsert a directed edge on the (source, target, type) unique triple."""
    try:
        rel_type = RelationshipType(type)
    except ValueError as exc:
        raise IngestError(
            f"type must be one of {[t.value for t in RelationshipType]}, got {type!r}"
        ) from exc

    rel = db.scalar(
        select(ConceptRelationship).where(
            ConceptRelationship.source_concept_id == source.id,
            ConceptRelationship.target_concept_id == target.id,
            ConceptRelationship.type == rel_type,
        )
    )
    created = rel is None
    if rel is None:
        rel = ConceptRelationship(
            subject_id=subject.id,
            source_concept_id=source.id,
            target_concept_id=target.id,
            type=rel_type,
            strength=strength,
        )
        db.add(rel)
        db.flush()
    elif strength is not None:
        rel.strength = strength
    return rel, created


# --------------------------------------------------------------------------- #
# Event appends (no projection — used by both single and batch paths)
# --------------------------------------------------------------------------- #
def _resolve_or_create(
    db: Session,
    subject_ref: str | uuid.UUID | None,
    concept_ref: str | uuid.UUID,
    create_if_missing: bool,
) -> Concept:
    subject = resolve_subject(db, subject_ref) if subject_ref is not None else None
    concept = resolve_concept(db, subject, concept_ref)
    if concept is not None:
        return concept
    if create_if_missing:
        if subject is None:
            if subject_ref is None:
                raise IngestError("create_if_missing requires a subject")
            subject, _ = upsert_subject(db, str(subject_ref))
        concept, _ = upsert_concept(db, subject, str(concept_ref))
        return concept
    raise IngestError(f"concept {concept_ref!r} not found")


def _append_recall(
    db: Session,
    concept: Concept,
    prompt: str,
    score: int,
    *,
    learner_answer: str | None,
    rationale: str | None,
    assessed_by: str,
    occurred_at: datetime,
) -> None:
    db.add(
        RecallEvent(
            concept_id=concept.id,
            prompt=prompt,
            learner_answer=learner_answer,
            score=score,
            rationale=rationale,
            assessed_by=assessed_by,
            occurred_at=occurred_at,
        )
    )


def _append_problem(
    db: Session,
    concept: Concept,
    prompt: str,
    is_correct: bool,
    partial: float | None,
    occurred_at: datetime,
) -> None:
    db.add(
        ProblemAttempt(
            concept_id=concept.id,
            prompt=prompt,
            is_correct=is_correct,
            partial=partial,
            occurred_at=occurred_at,
        )
    )


def _append_explanation(
    db: Session,
    concept: Concept,
    content: str,
    quality: int | None,
    direction: str,
    occurred_at: datetime,
) -> None:
    try:
        dir_enum = ExplanationDirection(direction)
    except ValueError as exc:
        raise IngestError(
            f"direction must be one of {[d.value for d in ExplanationDirection]}, got {direction!r}"
        ) from exc
    db.add(
        ExplanationEvent(
            concept_id=concept.id,
            content=content,
            direction=dir_enum,
            quality=quality,
            occurred_at=occurred_at,
        )
    )


# --------------------------------------------------------------------------- #
# Outcomes (read-only projection snapshot)
# --------------------------------------------------------------------------- #
def _build_outcome(db: Session, concept: Concept, score: int | None = None) -> IngestOutcomeOut:
    metric = db.get(ConceptMetric, concept.id)
    schedule = db.get(ReviewSchedule, concept.id)

    return IngestOutcomeOut(
        concept_id=concept.id,
        name=concept.name,
        score=score,
        mastery=metric.mastery if metric else 0.0,
        retention=metric.retention if metric else 0.0,
        heat_state=metric.heat_state if metric else HeatState.frozen,
        review_count=metric.review_count if metric else 0,
        due_at=schedule.due_at if schedule else None,
        next_interval_days=schedule.interval_days if schedule else 0.0,
    )


def _project(db: Session, concept: Concept, now: datetime) -> None:
    # autoflush is off on these sessions, so flush the just-appended event before
    # the projection's SELECTs run (mirrors review_service.assess).
    db.flush()
    run_projection(db, concept.id, now=now)
    regenerate_snapshots(db, now=now)


# --------------------------------------------------------------------------- #
# Single-event public API (router commits)
# --------------------------------------------------------------------------- #
def log_recall(
    db: Session,
    concept_ref: str | uuid.UUID,
    prompt: str,
    *,
    grade: str | None = None,
    score: int | None = None,
    learner_answer: str | None = None,
    rationale: str | None = None,
    assessed_by: str = "deep-learn",
    occurred_at: datetime | None = None,
    subject: str | uuid.UUID | None = None,
    create_if_missing: bool = False,
) -> IngestOutcomeOut:
    now = ensure_utc(occurred_at or datetime.now(timezone.utc))
    resolved_score = grade_to_score(grade, score)
    concept = _resolve_or_create(db, subject, concept_ref, create_if_missing)
    _append_recall(
        db, concept, prompt, resolved_score,
        learner_answer=learner_answer, rationale=rationale,
        assessed_by=assessed_by, occurred_at=now,
    )
    _project(db, concept, now)
    return _build_outcome(db, concept, score=resolved_score)


def log_problem(
    db: Session,
    concept_ref: str | uuid.UUID,
    prompt: str,
    is_correct: bool,
    *,
    partial: float | None = None,
    occurred_at: datetime | None = None,
    subject: str | uuid.UUID | None = None,
    create_if_missing: bool = False,
) -> IngestOutcomeOut:
    now = ensure_utc(occurred_at or datetime.now(timezone.utc))
    concept = _resolve_or_create(db, subject, concept_ref, create_if_missing)
    _append_problem(db, concept, prompt, is_correct, partial, now)
    _project(db, concept, now)
    return _build_outcome(db, concept)


def log_explanation(
    db: Session,
    concept_ref: str | uuid.UUID,
    content: str,
    *,
    quality: int | None = None,
    direction: str = "learner_to_ai",
    occurred_at: datetime | None = None,
    subject: str | uuid.UUID | None = None,
    create_if_missing: bool = False,
) -> IngestOutcomeOut:
    now = ensure_utc(occurred_at or datetime.now(timezone.utc))
    concept = _resolve_or_create(db, subject, concept_ref, create_if_missing)
    _append_explanation(db, concept, content, quality, direction, now)
    _project(db, concept, now)
    return _build_outcome(db, concept)


def make_subject_ref(subject: Subject, created: bool) -> SubjectRefOut:
    return SubjectRefOut(id=subject.id, name=subject.name, created=created)


def make_concept_ref(concept: Concept, created: bool) -> ConceptRefOut:
    return ConceptRefOut(
        concept_id=concept.id,
        subject_id=concept.subject_id,
        name=concept.name,
        slug=concept.slug,
        created=created,
    )


def make_relationship_ref(rel: ConceptRelationship, created: bool) -> RelationshipOut:
    return RelationshipOut(
        id=rel.id,
        source=rel.source_concept_id,
        target=rel.target_concept_id,
        type=rel.type.value,
        created=created,
    )


# --------------------------------------------------------------------------- #
# Batch — the primary path the skill calls at session close
# --------------------------------------------------------------------------- #
def sync_session(db: Session, payload: SessionIn) -> SessionOutcomeOut:
    """Upsert the subject + its topics (and prerequisite edges), append every
    event, then project each touched concept ONCE and regenerate snapshots ONCE.
    One round-trip, one projection pass, no double-counting. Router commits."""
    now = datetime.now(timezone.utc)
    subject, _ = upsert_subject(db, payload.subject, payload.description)

    # Upsert topics first so events and prerequisite edges can resolve by name.
    for topic in payload.topics:
        upsert_concept(
            db, subject, topic.name,
            slug=topic.slug, importance=topic.importance,
            intuition=topic.intuition, definition=topic.definition,
            notes=topic.notes, viz_spec=topic.viz_spec,
        )

    # Prerequisite edges (prereq → this topic), once topics exist.
    for topic in payload.topics:
        if not topic.prerequisites:
            continue
        target = resolve_concept(db, subject, topic.name)
        for prereq in topic.prerequisites:
            source = resolve_concept(db, subject, prereq)
            if source is None or target is None:
                raise IngestError(
                    f"prerequisite {prereq!r} of {topic.name!r} not found in subject"
                )
            add_relationship(db, subject, source, target, "prerequisite")

    touched: dict[uuid.UUID, Concept] = {}
    scores: dict[uuid.UUID, int] = {}
    for ev in payload.events:
        concept = resolve_concept(db, subject, ev.concept)
        if concept is None:
            raise IngestError(f"event concept {ev.concept!r} not found in subject")
        occurred = ensure_utc(ev.occurred_at or now)
        if ev.type == "recall":
            if ev.prompt is None:
                raise IngestError("recall event requires a prompt")
            score = grade_to_score(ev.grade, ev.score)
            _append_recall(
                db, concept, ev.prompt, score,
                learner_answer=ev.learner_answer, rationale=ev.rationale,
                assessed_by="deep-learn", occurred_at=occurred,
            )
            scores[concept.id] = score
        elif ev.type == "problem":
            if ev.prompt is None or ev.is_correct is None:
                raise IngestError("problem event requires prompt and isCorrect")
            _append_problem(db, concept, ev.prompt, ev.is_correct, ev.partial, occurred)
        elif ev.type == "explanation":
            if ev.content is None:
                raise IngestError("explanation event requires content")
            _append_explanation(db, concept, ev.content, ev.quality, ev.direction, occurred)
        else:
            raise IngestError(f"unknown event type {ev.type!r}")
        touched[concept.id] = concept

    db.flush()
    now = ensure_utc(now)
    for cid in touched:
        run_projection(db, cid, now=now)
    regenerate_snapshots(db, now=now)

    return SessionOutcomeOut(
        subject_id=subject.id,
        subject_name=subject.name,
        concepts=[_build_outcome(db, c, score=scores.get(cid)) for cid, c in touched.items()],
    )

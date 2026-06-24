"""Ingest routes — the deep-learn → Cerebra write surface. Each POST authors
content or appends an immutable event and re-projects (via ingest_service), then
commits. Reads elsewhere stay on projection tables; this module only writes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ingest_service as ing
from ..db import get_db
from ..schemas import (
    ConceptIn,
    ConceptRefOut,
    ExplanationIn,
    IngestOutcomeOut,
    ProblemIn,
    RecallIn,
    RelationshipIn,
    RelationshipOut,
    SessionIn,
    SessionOutcomeOut,
    SubjectIn,
    SubjectRefOut,
)

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _require_subject(db: Session, ref: str):
    subject = ing.resolve_subject(db, ref)
    if subject is None:
        raise HTTPException(status_code=422, detail=f"subject {ref!r} not found")
    return subject


def _require_concept(db: Session, subject, ref: str):
    concept = ing.resolve_concept(db, subject, ref)
    if concept is None:
        raise HTTPException(status_code=422, detail=f"concept {ref!r} not found")
    return concept


@router.post("/subjects", response_model=SubjectRefOut, status_code=201)
def upsert_subject(body: SubjectIn, db: Session = Depends(get_db)) -> SubjectRefOut:
    subject, created = ing.upsert_subject(db, body.name, body.description)
    db.commit()
    return ing.make_subject_ref(subject, created)


@router.post("/concepts", response_model=ConceptRefOut, status_code=201)
def upsert_concept(body: ConceptIn, db: Session = Depends(get_db)) -> ConceptRefOut:
    subject = _require_subject(db, body.subject)
    concept, created = ing.upsert_concept(
        db, subject, body.name,
        slug=body.slug, importance=body.importance,
        intuition=body.intuition, definition=body.definition,
        notes=body.notes, viz_spec=body.viz_spec,
    )
    db.commit()
    return ing.make_concept_ref(concept, created)


@router.post("/relationships", response_model=RelationshipOut, status_code=201)
def add_relationship(body: RelationshipIn, db: Session = Depends(get_db)) -> RelationshipOut:
    subject = _require_subject(db, body.subject)
    source = _require_concept(db, subject, body.source)
    target = _require_concept(db, subject, body.target)
    try:
        rel, created = ing.add_relationship(db, subject, source, target, body.type, body.strength)
    except ing.IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return ing.make_relationship_ref(rel, created)


@router.post("/recall", response_model=IngestOutcomeOut, status_code=201)
def log_recall(body: RecallIn, db: Session = Depends(get_db)) -> IngestOutcomeOut:
    try:
        outcome = ing.log_recall(
            db, body.concept, body.prompt,
            grade=body.grade, score=body.score,
            learner_answer=body.learner_answer, rationale=body.rationale,
            assessed_by=body.assessed_by, occurred_at=body.occurred_at,
            subject=body.subject, create_if_missing=body.create_if_missing,
        )
    except ing.IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return outcome


@router.post("/problem", response_model=IngestOutcomeOut, status_code=201)
def log_problem(body: ProblemIn, db: Session = Depends(get_db)) -> IngestOutcomeOut:
    try:
        outcome = ing.log_problem(
            db, body.concept, body.prompt, body.is_correct,
            partial=body.partial, occurred_at=body.occurred_at,
            subject=body.subject, create_if_missing=body.create_if_missing,
        )
    except ing.IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return outcome


@router.post("/explanation", response_model=IngestOutcomeOut, status_code=201)
def log_explanation(body: ExplanationIn, db: Session = Depends(get_db)) -> IngestOutcomeOut:
    try:
        outcome = ing.log_explanation(
            db, body.concept, body.content,
            quality=body.quality, direction=body.direction,
            occurred_at=body.occurred_at,
            subject=body.subject, create_if_missing=body.create_if_missing,
        )
    except ing.IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return outcome


@router.post("/sessions", response_model=SessionOutcomeOut, status_code=201)
def sync_session(body: SessionIn, db: Session = Depends(get_db)) -> SessionOutcomeOut:
    try:
        outcome = ing.sync_session(db, body)
    except ing.IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return outcome

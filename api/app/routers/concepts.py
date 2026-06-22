import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import concept_service as cs
from .. import dashboard_service as svc
from ..db import get_db
from ..schemas import (
    ConceptDetailOut,
    DependencyOut,
    InsightOut,
    RecallCardOut,
    WeakConceptOut,
)

router = APIRouter(prefix="/concepts", tags=["concepts"])


# Literal route declared before the `/{concept_id}` param route so it wins.
@router.get("/weak", response_model=list[WeakConceptOut])
def weak(limit: int = Query(5, ge=1, le=50), db: Session = Depends(get_db)) -> list[WeakConceptOut]:
    return svc.weak_concepts(db, limit=limit)


@router.get("/{concept_id}", response_model=ConceptDetailOut)
def concept_detail(concept_id: uuid.UUID, db: Session = Depends(get_db)) -> ConceptDetailOut:
    detail = cs.get_concept_detail(db, concept_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    return detail


@router.get("/{concept_id}/recall", response_model=RecallCardOut)
def concept_recall(concept_id: uuid.UUID, db: Session = Depends(get_db)) -> RecallCardOut:
    return cs.get_recall_card(db, concept_id)


@router.get("/{concept_id}/dependencies", response_model=list[DependencyOut])
def concept_dependencies(concept_id: uuid.UUID, db: Session = Depends(get_db)) -> list[DependencyOut]:
    return cs.get_dependencies(db, concept_id)


@router.get("/{concept_id}/insight", response_model=InsightOut)
def concept_insight(concept_id: uuid.UUID, db: Session = Depends(get_db)) -> InsightOut:
    insight = cs.get_insight(db, concept_id)
    if insight is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    return insight

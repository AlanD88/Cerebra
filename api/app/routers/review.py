import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import review_service as rs
from ..db import get_db
from ..schemas import AssessIn, AssessResultOut, CreateSessionIn, ReviewSessionOut

router = APIRouter(prefix="/review", tags=["review"])


@router.post("/sessions", response_model=ReviewSessionOut, status_code=201)
def create_session(body: CreateSessionIn, db: Session = Depends(get_db)) -> ReviewSessionOut:
    session = rs.create_session(db, concept_id=body.concept_id)
    db.commit()
    return session


@router.get("/{session_id}", response_model=ReviewSessionOut)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db)) -> ReviewSessionOut:
    session = rs.get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/assess", response_model=AssessResultOut)
def assess(
    session_id: uuid.UUID, body: AssessIn, db: Session = Depends(get_db)
) -> AssessResultOut:
    result = rs.assess(db, session_id, body.item_id, body.learner_answer)
    if result is None:
        raise HTTPException(status_code=404, detail="Item not found in session")
    db.commit()
    return result

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import dashboard_service as svc
from .. import graph_service as gs
from ..db import get_db
from ..schemas import SubjectOut, SubjectProgressOut

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)) -> list[SubjectOut]:
    return gs.list_subjects(db)


@router.get("/progress", response_model=list[SubjectProgressOut])
def progress(db: Session = Depends(get_db)) -> list[SubjectProgressOut]:
    return svc.subject_progress(db)

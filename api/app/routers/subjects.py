from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import dashboard_service as svc
from ..db import get_db
from ..schemas import SubjectProgressOut

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("/progress", response_model=list[SubjectProgressOut])
def progress(db: Session = Depends(get_db)) -> list[SubjectProgressOut]:
    return svc.subject_progress(db)

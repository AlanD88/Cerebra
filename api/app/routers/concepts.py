from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import dashboard_service as svc
from ..db import get_db
from ..schemas import WeakConceptOut

router = APIRouter(prefix="/concepts", tags=["concepts"])


@router.get("/weak", response_model=list[WeakConceptOut])
def weak(limit: int = Query(5, ge=1, le=50), db: Session = Depends(get_db)) -> list[WeakConceptOut]:
    return svc.weak_concepts(db, limit=limit)

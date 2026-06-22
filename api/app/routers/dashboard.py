from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import dashboard_service as svc
from ..db import get_db
from ..schemas import (
    DueSummaryOut,
    HeatRowOut,
    LearningHealthOut,
    RetentionTrendsOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/due-summary", response_model=DueSummaryOut)
def due_summary(db: Session = Depends(get_db)) -> DueSummaryOut:
    return svc.due_summary(db)


@router.get("/retention", response_model=RetentionTrendsOut)
def retention(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)) -> RetentionTrendsOut:
    return svc.retention_trends(db, days=days)


@router.get("/health", response_model=LearningHealthOut)
def health(db: Session = Depends(get_db)) -> LearningHealthOut:
    return svc.learning_health(db)


@router.get("/heatmap", response_model=list[HeatRowOut])
def heatmap(db: Session = Depends(get_db)) -> list[HeatRowOut]:
    return svc.knowledge_heatmap(db)

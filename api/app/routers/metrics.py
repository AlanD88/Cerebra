from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Concept, ConceptMetric
from ..schemas import SmokeMetricOut

router = APIRouter(tags=["metrics"])


@router.get("/_smoke/metrics", response_model=list[SmokeMetricOut])
def smoke_metrics(db: Session = Depends(get_db)) -> list[SmokeMetricOut]:
    """Read the projection table only — never aggregates raw events live."""
    rows = db.execute(
        select(ConceptMetric, Concept.name)
        .join(Concept, Concept.id == ConceptMetric.concept_id)
        .order_by(Concept.name)
    ).all()
    return [
        SmokeMetricOut(
            concept_id=cm.concept_id,
            name=name,
            mastery=cm.mastery,
            heat_state=cm.heat_state,
        )
        for cm, name in rows
    ]

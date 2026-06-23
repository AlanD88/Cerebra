import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import graph_service as gs
from ..db import get_db
from ..schemas import GraphEdgeOut, GraphLayoutOut, GraphNodeOut, LayoutPatchIn

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/{subject_id}/layout", response_model=list[GraphLayoutOut])
def layout(subject_id: uuid.UUID, db: Session = Depends(get_db)) -> list[GraphLayoutOut]:
    return gs.get_layout(db, subject_id)


@router.get("/{subject_id}/nodes", response_model=list[GraphNodeOut])
def nodes(subject_id: uuid.UUID, db: Session = Depends(get_db)) -> list[GraphNodeOut]:
    return gs.get_nodes(db, subject_id)


@router.get("/{subject_id}/edges", response_model=list[GraphEdgeOut])
def edges(subject_id: uuid.UUID, db: Session = Depends(get_db)) -> list[GraphEdgeOut]:
    return gs.get_edges(db, subject_id)


@router.patch("/{subject_id}/layout", response_model=list[GraphLayoutOut])
def patch_layout(
    subject_id: uuid.UUID, body: LayoutPatchIn, db: Session = Depends(get_db)
) -> list[GraphLayoutOut]:
    result = gs.patch_layout(db, subject_id, body.positions)
    db.commit()
    return result

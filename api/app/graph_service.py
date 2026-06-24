"""Knowledge Graph reads/writes (graph-frontend.md §2/§3). Node positions and the
knowledge graph are TWO INDEPENDENT concerns: positions come from graph_layouts,
heat/edges from concept_metrics + concept_relationships. A layout write never
touches a relationship and vice-versa."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .enums import HeatState
from .models import (
    Concept,
    ConceptMetric,
    ConceptRelationship,
    GraphLayout,
    Subject,
)
from .schemas import GraphEdgeOut, GraphLayoutOut, GraphNodeOut, SubjectOut

LAYOUT_VERSION = 1


def list_subjects(db: Session) -> list[SubjectOut]:
    """All subjects (alphabetical) — backs the graph's subject switcher."""
    rows = db.scalars(select(Subject).order_by(Subject.name.asc())).all()
    return [SubjectOut(id=s.id, name=s.name) for s in rows]


def get_layout(db: Session, subject_id) -> list[GraphLayoutOut]:
    """Saved node positions for a subject — the *presentation* half of the graph,
    independent of the knowledge (nodes/edges) read below."""
    rows = db.scalars(
        select(GraphLayout).where(
            GraphLayout.subject_id == subject_id,
            GraphLayout.layout_version == LAYOUT_VERSION,
        )
    ).all()
    return [GraphLayoutOut(concept_id=r.concept_id, x=r.x, y=r.y, pinned=r.pinned) for r in rows]


def get_nodes(db: Session, subject_id) -> list[GraphNodeOut]:
    """A subject's concepts joined to their heat/mastery projection (never-reviewed
    concepts read as frozen / 0). The *knowledge* half — carries no position."""
    rows = db.execute(
        select(
            Concept.id,
            Concept.name,
            Concept.importance,
            ConceptMetric.heat_state,
            ConceptMetric.mastery,
        )
        .outerjoin(ConceptMetric, ConceptMetric.concept_id == Concept.id)
        .where(Concept.subject_id == subject_id)
        .order_by(Concept.importance.desc(), Concept.name.asc())
    ).all()
    return [
        GraphNodeOut(
            concept_id=cid,
            name=name,
            importance=importance,
            heat_state=heat or HeatState.frozen,
            mastery=mastery if mastery is not None else 0.0,
        )
        for cid, name, importance, heat, mastery in rows
    ]


def get_edges(db: Session, subject_id) -> list[GraphEdgeOut]:
    """A subject's concept relationships (prerequisite / related / extends). Read
    independently of layout, so editing a relationship never moves a node."""
    rows = db.scalars(
        select(ConceptRelationship).where(ConceptRelationship.subject_id == subject_id)
    ).all()
    return [
        GraphEdgeOut(
            source=r.source_concept_id,
            target=r.target_concept_id,
            type=r.type.value,
            strength=r.strength,
        )
        for r in rows
    ]


def patch_layout(db: Session, subject_id, positions) -> list[GraphLayoutOut]:
    """Persist dragged positions only — pins them, never touches relationships."""
    for pos in positions:
        existing = db.scalar(
            select(GraphLayout).where(
                GraphLayout.concept_id == pos.concept_id,
                GraphLayout.layout_version == LAYOUT_VERSION,
            )
        )
        if existing is None:
            existing = GraphLayout(
                subject_id=subject_id,
                concept_id=pos.concept_id,
                layout_version=LAYOUT_VERSION,
            )
            db.add(existing)
        existing.x = pos.x
        existing.y = pos.y
        existing.pinned = True
    db.flush()
    return get_layout(db, subject_id)

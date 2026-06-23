from datetime import datetime, timezone

from sqlalchemy import func, select

from app import graph_service as gs
from app.models import Concept, ConceptRelationship, GraphLayout, Subject
from app.schemas import LayoutPosIn
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _subject(db) -> Subject:
    return db.scalar(select(Subject))


def test_nodes_carry_heat_and_importance(db):
    seed(db, now=NOW)
    nodes = gs.get_nodes(db, _subject(db).id)
    assert len(nodes) == 4
    vectors = next(n for n in nodes if n.name == "Vectors")
    assert vectors.importance == 5
    svd = next(n for n in nodes if n.name == "Singular Value Decomposition")
    assert svd.heat_state.value == "frozen"


def test_edges_come_from_relationships(db):
    seed(db, now=NOW)
    edges = gs.get_edges(db, _subject(db).id)
    # seed has 4 relationships
    assert len(edges) == 4
    assert all(e.type in {"prerequisite", "related", "extends"} for e in edges)


def test_layout_and_nodes_are_independent_reads(db):
    seed(db, now=NOW)
    sid = _subject(db).id
    layout = gs.get_layout(db, sid)
    nodes = gs.get_nodes(db, sid)
    # both keyed by concept_id, but sourced from different tables
    assert {l.concept_id for l in layout} == {n.concept_id for n in nodes}


def test_drag_persists_position_without_touching_relationships(db):
    seed(db, now=NOW)
    sid = _subject(db).id
    concept = db.scalar(select(Concept).where(Concept.name == "Vectors"))

    rel_count_before = db.scalar(select(func.count()).select_from(ConceptRelationship))

    gs.patch_layout(db, sid, [LayoutPosIn(conceptId=concept.id, x=123.0, y=-45.0)])

    moved = db.scalar(
        select(GraphLayout).where(
            GraphLayout.concept_id == concept.id, GraphLayout.layout_version == 1
        )
    )
    assert (moved.x, moved.y) == (123.0, -45.0)
    assert moved.pinned is True

    # the knowledge graph is untouched by a layout move
    rel_count_after = db.scalar(select(func.count()).select_from(ConceptRelationship))
    assert rel_count_after == rel_count_before


def test_editing_a_relationship_does_not_move_a_node(db):
    seed(db, now=NOW)
    sid = _subject(db).id
    concept = db.scalar(select(Concept).where(Concept.name == "Vectors"))
    layout_before = db.scalar(
        select(GraphLayout).where(GraphLayout.concept_id == concept.id)
    )
    pos_before = (layout_before.x, layout_before.y)

    # add a new relationship
    other = db.scalar(select(Concept).where(Concept.name == "Singular Value Decomposition"))
    db.add(
        ConceptRelationship(
            subject_id=sid,
            source_concept_id=concept.id,
            target_concept_id=other.id,
            type=__import__("app.enums", fromlist=["RelationshipType"]).RelationshipType.related,
        )
    )
    db.flush()

    layout_after = db.scalar(select(GraphLayout).where(GraphLayout.concept_id == concept.id))
    assert (layout_after.x, layout_after.y) == pos_before


def test_subjects_list(db):
    seed(db, now=NOW)
    subjects = gs.list_subjects(db)
    assert len(subjects) == 1
    assert subjects[0].name == "Linear Algebra"

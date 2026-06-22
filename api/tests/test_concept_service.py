from datetime import datetime, timezone

from sqlalchemy import func, select

from app import concept_service as cs
from app.enums import HeatState
from app.models import Concept, RecallState
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _concept(db, name: str) -> Concept:
    return db.scalar(select(Concept).where(Concept.name == name))


def test_concept_detail_joins_metrics_and_viz_spec(db):
    seed(db, now=NOW)
    eigen = _concept(db, "Eigenvector")
    detail = cs.get_concept_detail(db, eigen.id)
    assert detail is not None
    assert detail.name == "Eigenvector"
    assert detail.subject == "Linear Algebra"
    assert detail.heat_state is HeatState.cold
    assert detail.review_count == 3
    assert detail.viz_spec is not None
    assert detail.viz_spec["kind"] == "eigen"


def test_concept_detail_missing_returns_none(db):
    import uuid

    assert cs.get_concept_detail(db, uuid.uuid4()) is None


def test_recall_card_returns_latest_score_per_prompt(db):
    seed(db, now=NOW)
    matrix = _concept(db, "Matrix")
    card = cs.get_recall_card(db, matrix.id, now=NOW)
    # 4 distinct prompts seeded for Matrix
    assert len(card.items) == 4
    prompts = {i.prompt for i in card.items}
    assert "What is the identity matrix?" in prompts


def test_recall_states_are_rebuilt_by_projection(db):
    seed(db, now=NOW)
    # seed has 4 + 4 + 3 distinct prompts -> 11 recall_state rows
    assert db.scalar(select(func.count()).select_from(RecallState)) == 11


def test_dependencies_flag_root_weakness(db):
    seed(db, now=NOW)
    svd = _concept(db, "Singular Value Decomposition")
    deps = cs.get_dependencies(db, svd.id)
    # SVD has one prerequisite edge (Eigenvector -> SVD)
    names = {d.name for d in deps}
    assert "Eigenvector" in names
    root = [d for d in deps if d.is_root_weakness]
    assert len(root) == 1
    # the lowest-mastery prerequisite is the root weakness
    assert root[0].mastery == min(d.mastery for d in deps)


def test_dependencies_empty_for_root_concept(db):
    seed(db, now=NOW)
    vectors = _concept(db, "Vectors")
    assert cs.get_dependencies(db, vectors.id) == []


def test_insight_points_at_cold_prerequisite(db):
    seed(db, now=NOW)
    svd = _concept(db, "Singular Value Decomposition")
    insight = cs.get_insight(db, svd.id)
    assert insight is not None
    # Eigenvector (cold) is SVD's prerequisite and the suggested next review
    eigen = _concept(db, "Eigenvector")
    assert insight.suggested_concept_id == eigen.id
    assert "Eigenvector" in insight.cta

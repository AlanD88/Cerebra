from datetime import datetime, timezone

from sqlalchemy import func, select

from app.enums import HeatState
from app.models import Concept, ConceptMetric, Subject
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _metric(db, name: str) -> ConceptMetric:
    concept = db.scalar(select(Concept).where(Concept.name == name))
    return db.get(ConceptMetric, concept.id)


def test_seed_creates_subject_with_four_concepts(db):
    seed(db, now=NOW)
    assert db.scalar(select(func.count()).select_from(Subject)) == 1
    assert db.scalar(select(func.count()).select_from(Concept)) == 4


def test_seed_projects_every_concept(db):
    seed(db, now=NOW)
    assert db.scalar(select(func.count()).select_from(ConceptMetric)) == 4


def test_unreviewed_concept_is_frozen(db):
    seed(db, now=NOW)
    svd = _metric(db, "Singular Value Decomposition")
    assert svd.review_count == 0
    assert svd.heat_state is HeatState.frozen
    assert svd.mastery == 0.0


def test_well_practiced_concept_is_warm_to_mastered(db):
    seed(db, now=NOW)
    vectors = _metric(db, "Vectors")
    assert vectors.review_count == 4
    assert vectors.heat_state in {HeatState.warm, HeatState.hot, HeatState.mastered}
    assert vectors.mastery > 0.5


def test_struggling_concept_is_cold(db):
    seed(db, now=NOW)
    eigen = _metric(db, "Eigenvector")
    assert eigen.heat_state is HeatState.cold


def test_seed_is_not_duplicated_on_second_run(db):
    seed(db, now=NOW)
    seed(db, now=NOW)  # force=False -> no-op
    assert db.scalar(select(func.count()).select_from(Subject)) == 1

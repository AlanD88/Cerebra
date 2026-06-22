from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app import review_service as rs
from app.models import Concept, ConceptMetric, RecallEvent, ReviewSchedule
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _concept(db, name: str) -> Concept:
    return db.scalar(select(Concept).where(Concept.name == name))


def test_single_concept_session_has_one_item(db):
    seed(db, now=NOW)
    eigen = _concept(db, "Eigenvector")
    session = rs.create_session(db, concept_id=eigen.id, now=NOW)
    assert session.total == 1
    assert session.concept_name == "Eigenvector"
    assert session.items[0].prompt


def test_due_session_includes_only_due_concepts(db):
    seed(db, now=NOW)
    # Far future: nothing is due yet.
    future = NOW + timedelta(days=1)
    empty = rs.create_session(db, now=future - timedelta(days=400))
    assert empty.total == 0

    # Long after: everything seeded is overdue.
    later = NOW + timedelta(days=400)
    full = rs.create_session(db, now=later)
    assert full.total >= 1


def test_assess_appends_event_and_updates_schedule(db):
    seed(db, now=NOW)
    eigen = _concept(db, "Eigenvector")
    before_events = db.scalar(
        select(func.count()).select_from(RecallEvent).where(RecallEvent.concept_id == eigen.id)
    )
    before_schedule = db.get(ReviewSchedule, eigen.id)
    before_reps = before_schedule.repetitions

    session = rs.create_session(db, concept_id=eigen.id, now=NOW)
    item = session.items[0]

    result = rs.assess(
        db,
        session.session_id,
        item.item_id,
        "An eigenvector is a direction left unchanged in orientation, only scaled by an "
        "eigenvalue lambda under the transformation.",
        now=NOW + timedelta(days=1),
    )
    assert result is not None
    assert 0 <= result.score <= 3

    after_events = db.scalar(
        select(func.count()).select_from(RecallEvent).where(RecallEvent.concept_id == eigen.id)
    )
    assert after_events == before_events + 1

    after_schedule = db.get(ReviewSchedule, eigen.id)
    # a passing score advances repetitions; the interval/due move forward
    if result.score >= 2:
        assert after_schedule.repetitions == before_reps + 1
    assert result.next_interval_days == after_schedule.interval_days


def test_assess_updates_metrics_projection(db):
    seed(db, now=NOW)
    eigen = _concept(db, "Eigenvector")
    session = rs.create_session(db, concept_id=eigen.id, now=NOW)
    item = session.items[0]

    before = db.get(ConceptMetric, eigen.id).review_count
    rs.assess(db, session.session_id, item.item_id, "eigenvector direction scaled lambda", now=NOW)
    after = db.get(ConceptMetric, eigen.id).review_count
    assert after == before + 1


def test_assess_unknown_item_returns_none(db):
    import uuid

    seed(db, now=NOW)
    session = rs.create_session(db, concept_id=_concept(db, "Vectors").id, now=NOW)
    assert rs.assess(db, session.session_id, uuid.uuid4(), "x", now=NOW) is None


def test_get_missing_session_returns_none(db):
    import uuid

    assert rs.get_session(db, uuid.uuid4()) is None

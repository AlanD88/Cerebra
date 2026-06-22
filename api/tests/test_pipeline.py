"""Phase 1 exit: seeding events + running projections yields correct metrics and
schedule, verified against hand-computed expectations, and rebuilds identically
from the event log alone."""

from datetime import datetime, timedelta, timezone

import pytest

from app.enums import HeatState
from app.models import Concept, ConceptMetric, RecallEvent, ReviewSchedule, Subject
from app.projections import ensure_utc, run_projection

BASE = datetime(2026, 5, 1, tzinfo=timezone.utc)


def _coerce(dt):
    return ensure_utc(dt) if dt is not None else None


@pytest.fixture()
def concept(db):
    subject = Subject(name="Hand Calc", description="fixture")
    db.add(subject)
    db.flush()
    c = Concept(subject_id=subject.id, name="Vectors", slug="vectors", importance=5)
    db.add(c)
    db.flush()
    # scores 3, 3, 2 at day 0, 1, 7
    db.add_all(
        [
            RecallEvent(concept_id=c.id, prompt="q1", score=3, occurred_at=BASE),
            RecallEvent(concept_id=c.id, prompt="q2", score=3, occurred_at=BASE + timedelta(days=1)),
            RecallEvent(concept_id=c.id, prompt="q3", score=2, occurred_at=BASE + timedelta(days=7)),
        ]
    )
    db.flush()
    return c


def test_schedule_matches_hand_computed_sm2(db, concept):
    now = BASE + timedelta(days=7)
    run_projection(db, concept.id, now=now)

    rs = db.get(ReviewSchedule, concept.id)
    # fold: q3 -> (int 1, ef 2.6); q3 -> (int 6, ef 2.7); q2 -> round(6*2.7)=16, ef 2.7
    assert rs.interval_days == 16.0
    assert rs.repetitions == 3
    assert rs.last_score == 2
    assert rs.ease_factor == pytest.approx(2.7)
    assert _coerce(rs.last_reviewed_at) == BASE + timedelta(days=7)
    assert _coerce(rs.due_at) == BASE + timedelta(days=7 + 16)


def test_metrics_match_hand_computed_values(db, concept):
    now = BASE + timedelta(days=7)  # Δt = 0 at last review -> retention 1.0
    run_projection(db, concept.id, now=now)

    cm = db.get(ConceptMetric, concept.id)
    # recency-weighted recall accuracy with λ = ln2/30 over ages 7, 6, 0 days:
    #   (w7·1 + w6·1 + 1·(2/3)) / (w7 + w6 + 1) ≈ 0.877433
    assert cm.recall_accuracy == pytest.approx(0.877433, rel=1e-4)
    assert cm.problem_accuracy == 0.0
    assert cm.retention == pytest.approx(1.0)
    # mastery = 0.45·0.877433 + 0.25·0 + 0.30·1.0 ≈ 0.694845
    assert cm.mastery == pytest.approx(0.694845, rel=1e-4)
    assert cm.heat_state is HeatState.warm
    assert cm.stability == pytest.approx(16.0 * 2.7, rel=1e-6)
    assert cm.review_count == 3


def _snapshot(cm: ConceptMetric, rs: ReviewSchedule) -> dict:
    return {
        "mastery": cm.mastery,
        "retention": cm.retention,
        "recall_accuracy": cm.recall_accuracy,
        "problem_accuracy": cm.problem_accuracy,
        "heat_state": cm.heat_state,
        "stability": cm.stability,
        "review_count": cm.review_count,
        "interval_days": rs.interval_days,
        "ease_factor": rs.ease_factor,
        "repetitions": rs.repetitions,
        "last_score": rs.last_score,
        "due_at": _coerce(rs.due_at),
    }


def test_projection_is_idempotent(db, concept):
    now = BASE + timedelta(days=10)
    run_projection(db, concept.id, now=now)
    first = _snapshot(db.get(ConceptMetric, concept.id), db.get(ReviewSchedule, concept.id))

    run_projection(db, concept.id, now=now)
    second = _snapshot(db.get(ConceptMetric, concept.id), db.get(ReviewSchedule, concept.id))

    assert first == second


def test_projection_replays_identically_from_event_log(db, concept):
    now = BASE + timedelta(days=10)
    run_projection(db, concept.id, now=now)
    before = _snapshot(db.get(ConceptMetric, concept.id), db.get(ReviewSchedule, concept.id))

    # Drop projections entirely, then rebuild from the immutable event log.
    db.delete(db.get(ConceptMetric, concept.id))
    db.delete(db.get(ReviewSchedule, concept.id))
    db.flush()
    assert db.get(ConceptMetric, concept.id) is None

    run_projection(db, concept.id, now=now)
    after = _snapshot(db.get(ConceptMetric, concept.id), db.get(ReviewSchedule, concept.id))

    assert before == after

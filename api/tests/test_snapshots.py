"""metric_snapshots is a projection: replayable and idempotent."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models import MetricSnapshot, RecallEvent
from app.projections import ensure_utc, regenerate_snapshots
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _rollup_rows(db):
    return db.scalars(
        select(MetricSnapshot)
        .where(MetricSnapshot.concept_id.is_(None), MetricSnapshot.subject_id.is_(None))
        .order_by(MetricSnapshot.as_of.asc())
    ).all()


def test_window_produces_one_rollup_row_per_day(db):
    seed(db, now=NOW)
    rows = _rollup_rows(db)
    assert len(rows) == 30
    assert rows[-1].as_of == NOW.date()


def test_snapshots_are_idempotent(db):
    seed(db, now=NOW)
    before = [(r.as_of, r.mastery, r.retention, r.reviews) for r in _rollup_rows(db)]
    regenerate_snapshots(db, now=NOW)
    after = [(r.as_of, r.mastery, r.retention, r.reviews) for r in _rollup_rows(db)]
    assert before == after
    # rebuilding must not accumulate duplicate rollup rows
    assert db.scalar(
        select(func.count()).select_from(MetricSnapshot).where(MetricSnapshot.concept_id.is_(None))
    ) == 30


def test_reviews_per_day_sum_matches_in_window_recall_events(db):
    seed(db, now=NOW)
    rows = _rollup_rows(db)
    window_start = NOW.date() - timedelta(days=29)
    recalls = db.scalars(select(RecallEvent)).all()
    expected = sum(
        1 for r in recalls if window_start <= ensure_utc(r.occurred_at).date() <= NOW.date()
    )
    assert sum(r.reviews for r in rows) == expected
    # seed has 11 recall events; the one at exactly -30d falls just outside the window
    assert expected == 10


def test_window_size_is_configurable(db):
    seed(db, now=NOW)
    regenerate_snapshots(db, now=NOW, window_days=7)
    assert len(_rollup_rows(db)) == 7

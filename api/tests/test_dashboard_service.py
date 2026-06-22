"""Service-level tests for the dashboard aggregations, with an injected clock so
due/overdue counts are deterministic."""

from datetime import datetime, timedelta, timezone

import pytest

from app import dashboard_service as svc
from app.enums import HeatState
from app.models import Concept, ConceptMetric, ReviewSchedule, Subject
from app.projections import run_projection
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _subject_with_schedule(db, dues: list[tuple[str, datetime | None]]) -> Subject:
    subject = Subject(name="S")
    db.add(subject)
    db.flush()
    for i, (name, due_at) in enumerate(dues):
        c = Concept(subject_id=subject.id, name=name, slug=f"c{i}", importance=3)
        db.add(c)
        db.flush()
        db.add(ReviewSchedule(concept_id=c.id, due_at=due_at, interval_days=1.0))
    db.flush()
    return subject


def test_due_summary_splits_overdue_and_today(db):
    _subject_with_schedule(
        db,
        [
            ("yesterday", NOW - timedelta(days=1)),
            ("earlier today", NOW.replace(hour=2)),
            ("later today", NOW.replace(hour=23)),
            ("tomorrow", NOW + timedelta(days=1)),
            ("none", None),
        ],
    )
    out = svc.due_summary(db, now=NOW.replace(hour=12))
    assert out.overdue == 1  # yesterday
    assert out.due_today == 2  # earlier + later today
    assert out.total == 3
    assert out.subjects == 1


def test_weak_excludes_unreviewed_and_orders_ascending(db):
    seed(db, now=NOW)
    weak = svc.weak_concepts(db, limit=10)
    names = [w.name for w in weak]
    assert "Singular Value Decomposition" not in names  # never reviewed
    masteries = [w.mastery for w in weak]
    assert masteries == sorted(masteries)


def test_learning_health_only_counts_reviewed(db):
    seed(db, now=NOW)
    health = svc.learning_health(db, now=NOW)
    assert health.tracked == 3
    assert 0.0 <= health.avg_mastery <= 1.0


def test_subject_progress_heat_matches_avg(db):
    seed(db, now=NOW)
    progress = svc.subject_progress(db)
    assert len(progress) == 1
    sp = progress[0]
    # heat_from_mastery on the same average must agree
    from app.projections import heat_from_mastery

    assert sp.heat_state == heat_from_mastery(sp.avg_mastery)


def test_heatmap_orders_cells_by_mastery_desc(db):
    seed(db, now=NOW)
    rows = svc.knowledge_heatmap(db)
    cells = rows[0].cells
    masteries = [c.mastery for c in cells]
    assert masteries == sorted(masteries, reverse=True)


def test_empty_health_is_zeroed(db):
    out = svc.learning_health(db, now=NOW)
    assert out.tracked == 0
    assert out.avg_mastery == 0.0
    assert out.retention == 0.0


def test_unreviewed_subject_progress_is_frozen(db):
    subject = Subject(name="Empty")
    db.add(subject)
    db.flush()
    c = Concept(subject_id=subject.id, name="New", slug="new", importance=3)
    db.add(c)
    db.flush()
    run_projection(db, c.id, now=NOW)  # no events -> mastery 0
    out = svc.subject_progress(db)
    assert out[0].avg_mastery == 0.0
    assert out[0].heat_state is HeatState.frozen

"""Ingest service: upsert idempotency, grade mapping, event → projection, and the
batch sync_session path. Runs against the in-memory SQLite engine (no mocks)."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app import ingest_service as ing
from app.models import Concept, ConceptMetric, ConceptRelationship, RecallEvent, ReviewSchedule, Subject
from app.schemas import SessionEventIn, SessionIn, SessionTopicIn

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_slugify():
    assert ing.slugify("Eigenvectors") == "eigenvectors"
    assert ing.slugify("Singular Value Decomposition") == "singular-value-decomposition"
    assert ing.slugify("  Gradient/Descent!! ") == "gradient-descent"


def test_grade_to_score_mapping():
    assert ing.grade_to_score("full") == 3
    assert ing.grade_to_score("Partial") == 1
    assert ing.grade_to_score("forgotten") == 0
    assert ing.grade_to_score(None, score=2) == 2
    with pytest.raises(ing.IngestError):
        ing.grade_to_score("kinda")
    with pytest.raises(ing.IngestError):
        ing.grade_to_score(None, score=7)


def test_upsert_subject_is_idempotent(db):
    s1, c1 = ing.upsert_subject(db, "Linear Algebra", "vectors etc")
    s2, c2 = ing.upsert_subject(db, "Linear Algebra", "updated blurb")
    db.flush()
    assert c1 is True and c2 is False
    assert s1.id == s2.id
    assert s2.description == "updated blurb"
    assert db.scalar(select(func.count()).select_from(Subject)) == 1


def test_upsert_concept_idempotent_and_updates(db):
    subject, _ = ing.upsert_subject(db, "Linear Algebra")
    c1, created1 = ing.upsert_concept(db, subject, "Eigenvectors", intuition="first")
    c2, created2 = ing.upsert_concept(db, subject, "Eigenvectors", intuition="second")
    assert created1 is True and created2 is False
    assert c1.id == c2.id
    assert c1.slug == "eigenvectors"
    assert c2.intuition == "second"
    assert db.scalar(select(func.count()).select_from(Concept)) == 1


def test_log_recall_drives_projection(db):
    out = ing.log_recall(
        db, "Eigenvectors", "Define an eigenvector", grade="full",
        learner_answer="a direction only scaled by A",
        subject="Linear Algebra", create_if_missing=True, occurred_at=NOW,
    )
    assert out.score == 3
    # event was appended and a projection row now exists
    assert db.scalar(select(func.count()).select_from(RecallEvent)) == 1
    metric = db.get(ConceptMetric, out.concept_id)
    schedule = db.get(ReviewSchedule, out.concept_id)
    assert metric.review_count == 1
    assert metric.mastery > 0.0
    assert schedule.due_at is not None
    assert out.mastery == metric.mastery


def test_log_recall_unresolved_without_create_raises(db):
    ing.upsert_subject(db, "Linear Algebra")
    with pytest.raises(ing.IngestError):
        ing.log_recall(db, "Nonexistent", "p", grade="full", subject="Linear Algebra")


def test_add_relationship_idempotent_on_triple(db):
    subject, _ = ing.upsert_subject(db, "Linear Algebra")
    vec, _ = ing.upsert_concept(db, subject, "Vectors")
    eig, _ = ing.upsert_concept(db, subject, "Eigenvectors")
    _, c1 = ing.add_relationship(db, subject, vec, eig, "prerequisite")
    _, c2 = ing.add_relationship(db, subject, vec, eig, "prerequisite")
    assert c1 is True and c2 is False
    assert db.scalar(select(func.count()).select_from(ConceptRelationship)) == 1


def test_sync_session_projects_once_per_concept(db):
    payload = SessionIn(
        subject="Linear Algebra",
        topics=[
            SessionTopicIn(name="Vectors"),
            SessionTopicIn(name="Eigenvectors", prerequisites=["Vectors"]),
        ],
        events=[
            SessionEventIn(type="recall", concept="Eigenvectors", prompt="define it", grade="partial"),
            SessionEventIn(type="recall", concept="Eigenvectors", prompt="again", grade="full"),
            SessionEventIn(type="problem", concept="Vectors", prompt="add two vectors", is_correct=True),
            SessionEventIn(type="explanation", concept="Vectors", content="a magnitude+direction", quality=3),
        ],
    )
    outcome = ing.sync_session(db, payload)

    # two distinct concepts touched, three recall/problem/explanation events on them
    assert {c.name for c in outcome.concepts} == {"Vectors", "Eigenvectors"}
    assert db.scalar(select(func.count()).select_from(RecallEvent)) == 2
    # prerequisite edge was created
    assert db.scalar(select(func.count()).select_from(ConceptRelationship)) == 1
    # both concepts have projection rows
    for c in outcome.concepts:
        assert db.get(ConceptMetric, c.concept_id) is not None
    eig = next(c for c in outcome.concepts if c.name == "Eigenvectors")
    assert eig.review_count == 2  # both recall events counted, exactly once
    assert eig.score == 3  # last recall score surfaced


def test_sync_session_unknown_event_concept_raises(db):
    payload = SessionIn(
        subject="Linear Algebra",
        topics=[SessionTopicIn(name="Vectors")],
        events=[SessionEventIn(type="recall", concept="Ghost", prompt="p", grade="full")],
    )
    with pytest.raises(ing.IngestError):
        ing.sync_session(db, payload)

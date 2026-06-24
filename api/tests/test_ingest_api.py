"""Ingest API: HTTP round-trips through the routers, camelCase DTOs, the 422 on
unresolved references, and the GET /review/due read."""

from datetime import datetime, timezone

from sqlalchemy import select

from app.models import Concept
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_upsert_subject_and_concept(client):
    s = client.post("/api/v1/ingest/subjects", json={"name": "Calculus"})
    assert s.status_code == 201
    assert s.json()["created"] is True

    c = client.post(
        "/api/v1/ingest/concepts",
        json={"subject": "Calculus", "name": "Derivative", "intuition": "instantaneous rate"},
    )
    assert c.status_code == 201
    body = c.json()
    assert set(body) >= {"conceptId", "subjectId", "name", "slug", "created"}
    assert body["slug"] == "derivative"

    # idempotent re-upsert
    again = client.post("/api/v1/ingest/concepts", json={"subject": "Calculus", "name": "Derivative"})
    assert again.json()["created"] is False
    assert again.json()["conceptId"] == body["conceptId"]


def test_log_recall_returns_camelcase_outcome(client):
    client.post("/api/v1/ingest/subjects", json={"name": "Calculus"})
    res = client.post(
        "/api/v1/ingest/recall",
        json={
            "subject": "Calculus",
            "concept": "Derivative",
            "prompt": "What is a derivative?",
            "grade": "full",
            "createIfMissing": True,
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["score"] == 3
    assert set(body) >= {"conceptId", "name", "score", "mastery", "heatState", "dueAt", "nextIntervalDays"}
    assert body["mastery"] > 0


def test_recall_unresolved_concept_is_422(client):
    client.post("/api/v1/ingest/subjects", json={"name": "Calculus"})
    res = client.post(
        "/api/v1/ingest/recall",
        json={"subject": "Calculus", "concept": "Ghost", "prompt": "p", "grade": "full"},
    )
    assert res.status_code == 422


def test_sync_session_end_to_end(client, db):
    payload = {
        "subject": "Calculus",
        "topics": [
            {"name": "Limit"},
            {"name": "Derivative", "prerequisites": ["Limit"]},
        ],
        "events": [
            {"type": "recall", "concept": "Derivative", "prompt": "define", "grade": "partial"},
            {"type": "problem", "concept": "Limit", "prompt": "evaluate", "isCorrect": True},
        ],
    }
    res = client.post("/api/v1/ingest/sessions", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["subjectName"] == "Calculus"
    assert {c["name"] for c in body["concepts"]} == {"Derivative", "Limit"}

    # the concept now shows up via the existing weak-concepts projection read
    weak = client.get("/api/v1/concepts/weak").json()
    assert any(w["name"] == "Derivative" for w in weak)


def test_due_reviews_read(client, db):
    seed(db, now=NOW)
    # seeded data has due schedules; the read returns them without a session row
    res = client.get("/api/v1/review/due")
    assert res.status_code == 200
    rows = res.json()
    assert isinstance(rows, list)
    if rows:
        assert set(rows[0]) >= {"conceptId", "name", "subject", "mastery", "heatState", "dueAt"}


def test_due_reviews_reflects_a_fresh_recall(client):
    # A failed recall (forgotten → reset to interval 1d) becomes due ~1 day later;
    # logging it well in the past makes it due now.
    past = "2024-01-01T00:00:00+00:00"
    client.post(
        "/api/v1/ingest/recall",
        json={
            "subject": "Physics",
            "concept": "Inertia",
            "prompt": "state Newton's first law",
            "grade": "forgotten",
            "createIfMissing": True,
            "occurredAt": past,
        },
    )
    rows = client.get("/api/v1/review/due").json()
    assert any(r["name"] == "Inertia" for r in rows)

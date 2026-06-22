from datetime import datetime, timezone

from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_due_summary_shape(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/dashboard/due-summary")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"total", "overdue", "dueToday", "subjects"}
    assert body["total"] == body["overdue"] + body["dueToday"]


def test_weak_concepts_camelcase_and_order(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/concepts/weak?limit=5")
    assert res.status_code == 200
    rows = res.json()
    assert rows, "expected at least one weak concept"
    masteries = [r["mastery"] for r in rows]
    assert masteries == sorted(masteries)  # ascending
    assert {"conceptId", "name", "subject", "mastery", "heatState"} <= set(rows[0])
    # never-reviewed SVD must not appear (review_count == 0)
    assert "Singular Value Decomposition" not in {r["name"] for r in rows}


def test_retention_returns_requested_window(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/dashboard/retention?days=30")
    assert res.status_code == 200
    body = res.json()
    assert len(body["points"]) == 30
    assert len(body["reviews"]) == 30
    assert all(0.0 <= p <= 1.0 for p in body["points"])


def test_learning_health(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/dashboard/health")
    assert res.status_code == 200
    body = res.json()
    assert {"avgMastery", "retention", "retentionDelta", "tracked", "subjects"} == set(body)
    assert body["tracked"] == 3  # Vectors, Matrix, Eigenvector (SVD unreviewed)
    assert body["subjects"] == 1


def test_heatmap_groups_by_subject(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/dashboard/heatmap")
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 1
    assert rows[0]["subject"] == "Linear Algebra"
    assert len(rows[0]["cells"]) == 4


def test_subject_progress(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/subjects/progress")
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 1
    assert {"subjectId", "name", "avgMastery", "heatState"} == set(rows[0])


def test_endpoints_empty_when_unseeded(client):
    assert client.get("/api/v1/concepts/weak").json() == []
    assert client.get("/api/v1/dashboard/heatmap").json() == []
    assert client.get("/api/v1/dashboard/due-summary").json()["total"] == 0

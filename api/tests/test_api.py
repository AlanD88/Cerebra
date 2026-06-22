from datetime import datetime, timezone

from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_smoke_metrics_reads_projection(client, db):
    seed(db, now=NOW)

    res = client.get("/api/v1/_smoke/metrics")
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 4

    names = {r["name"] for r in rows}
    assert {"Vectors", "Matrix", "Eigenvector", "Singular Value Decomposition"} == names

    for r in rows:
        assert 0.0 <= r["mastery"] <= 1.0
        assert r["heat_state"] in {"mastered", "hot", "warm", "cold", "frozen"}


def test_smoke_metrics_empty_when_unseeded(client):
    res = client.get("/api/v1/_smoke/metrics")
    assert res.status_code == 200
    assert res.json() == []

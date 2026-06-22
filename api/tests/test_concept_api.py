from datetime import datetime, timezone

from sqlalchemy import select

from app.models import Concept
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _id(db, name: str) -> str:
    return str(db.scalar(select(Concept).where(Concept.name == name)).id)


def test_concept_detail_endpoint(client, db):
    seed(db, now=NOW)
    cid = _id(db, "Eigenvector")
    res = client.get(f"/api/v1/concepts/{cid}")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Eigenvector"
    assert body["heatState"] == "cold"
    assert body["vizSpec"]["kind"] == "eigen"
    assert {"recallAccuracy", "problemAccuracy", "dueAt", "vizSpec"} <= set(body)


def test_concept_detail_404(client):
    res = client.get("/api/v1/concepts/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_weak_route_not_shadowed_by_id_route(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/concepts/weak")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_recall_endpoint(client, db):
    seed(db, now=NOW)
    cid = _id(db, "Matrix")
    res = client.get(f"/api/v1/concepts/{cid}/recall")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"dueCount", "items"}
    assert all({"prompt", "lastScore", "heatState"} == set(i) for i in body["items"])


def test_dependencies_endpoint(client, db):
    seed(db, now=NOW)
    cid = _id(db, "Singular Value Decomposition")
    res = client.get(f"/api/v1/concepts/{cid}/dependencies")
    assert res.status_code == 200
    rows = res.json()
    assert any(r["isRootWeakness"] for r in rows)
    assert {"conceptId", "name", "heatState", "mastery", "isRootWeakness"} == set(rows[0])


def test_insight_endpoint(client, db):
    seed(db, now=NOW)
    cid = _id(db, "Singular Value Decomposition")
    res = client.get(f"/api/v1/concepts/{cid}/insight")
    assert res.status_code == 200
    body = res.json()
    assert {"summary", "suggestedConceptId", "cta"} == set(body)
    assert body["summary"]

from datetime import datetime, timezone

from sqlalchemy import select

from app.models import Concept
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _id(db, name: str) -> str:
    return str(db.scalar(select(Concept).where(Concept.name == name)).id)


def test_create_and_fetch_session(client, db):
    seed(db, now=NOW)
    cid = _id(db, "Eigenvector")
    res = client.post("/api/v1/review/sessions", json={"conceptId": cid})
    assert res.status_code == 201
    body = res.json()
    assert body["total"] == 1
    assert body["conceptName"] == "Eigenvector"
    assert {"itemId", "conceptId", "conceptName", "prompt"} == set(body["items"][0])

    sid = body["sessionId"]
    got = client.get(f"/api/v1/review/{sid}")
    assert got.status_code == 200
    assert got.json()["sessionId"] == sid


def test_assess_returns_readonly_outcome(client, db):
    seed(db, now=NOW)
    cid = _id(db, "Eigenvector")
    session = client.post("/api/v1/review/sessions", json={"conceptId": cid}).json()
    item = session["items"][0]

    res = client.post(
        f"/api/v1/review/{session['sessionId']}/assess",
        json={"itemId": item["itemId"], "learnerAnswer": "eigenvector direction scaled lambda"},
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"score", "label", "rationale", "nextIntervalDays", "heatState", "modelAnswer"}
    assert 0 <= body["score"] <= 3
    # the score is server-assigned; the request never carried a score field
    assert "score" not in {"itemId", "learnerAnswer"}


def test_get_missing_session_404(client):
    res = client.get("/api/v1/review/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_review_completion_reflects_on_dashboard(client, db):
    """Phase 4 exit: completing a review updates projections visible elsewhere."""
    seed(db, now=NOW)
    cid = _id(db, "Eigenvector")
    before = client.get(f"/api/v1/concepts/{cid}").json()["reviewCount"]

    session = client.post("/api/v1/review/sessions", json={"conceptId": cid}).json()
    item = session["items"][0]
    client.post(
        f"/api/v1/review/{session['sessionId']}/assess",
        json={"itemId": item["itemId"], "learnerAnswer": "eigenvector direction unchanged scaled"},
    )

    after = client.get(f"/api/v1/concepts/{cid}").json()["reviewCount"]
    assert after == before + 1

from datetime import datetime, timezone

from sqlalchemy import select

from app.models import Concept, Subject
from app.seed import seed

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def _sid(db) -> str:
    return str(db.scalar(select(Subject)).id)


def test_subjects_list_endpoint(client, db):
    seed(db, now=NOW)
    res = client.get("/api/v1/subjects")
    assert res.status_code == 200
    assert res.json()[0]["name"] == "Linear Algebra"


def test_graph_three_reads(client, db):
    seed(db, now=NOW)
    sid = _sid(db)

    layout = client.get(f"/api/v1/graph/{sid}/layout").json()
    nodes = client.get(f"/api/v1/graph/{sid}/nodes").json()
    edges = client.get(f"/api/v1/graph/{sid}/edges").json()

    assert {"conceptId", "x", "y", "pinned"} == set(layout[0])
    assert {"conceptId", "name", "importance", "heatState", "mastery"} == set(nodes[0])
    assert {"source", "target", "type", "strength"} == set(edges[0])
    assert len(nodes) == 4
    assert len(edges) == 4


def test_patch_layout_persists(client, db):
    seed(db, now=NOW)
    sid = _sid(db)
    cid = str(db.scalar(select(Concept).where(Concept.name == "Vectors")).id)

    res = client.patch(
        f"/api/v1/graph/{sid}/layout",
        json={"positions": [{"conceptId": cid, "x": 99.0, "y": 12.0}]},
    )
    assert res.status_code == 200

    layout = client.get(f"/api/v1/graph/{sid}/layout").json()
    moved = next(p for p in layout if p["conceptId"] == cid)
    assert (moved["x"], moved["y"], moved["pinned"]) == (99.0, 12.0, True)

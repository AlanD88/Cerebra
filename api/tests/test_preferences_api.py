"""Preferences API — GET seeds defaults, PATCH merges + persists, validation 422."""


def test_get_returns_camel_default_modes(client):
    res = client.get("/api/v1/preferences")
    assert res.status_code == 200
    assert res.json() == {"modes": {"concept": "default", "graph": "default", "review": "default"}}


def test_patch_flips_a_single_mode_and_persists(client):
    res = client.patch("/api/v1/preferences", json={"modes": {"concept": "focus"}})
    assert res.status_code == 200
    assert res.json()["modes"]["concept"] == "focus"

    # Survives a fresh read (write committed).
    again = client.get("/api/v1/preferences").json()
    assert again["modes"]["concept"] == "focus"
    assert again["modes"]["graph"] == "default"


def test_patch_is_additive_across_calls(client):
    client.patch("/api/v1/preferences", json={"modes": {"graph": "immersive"}})
    client.patch("/api/v1/preferences", json={"modes": {"review": "tutor"}})
    modes = client.get("/api/v1/preferences").json()["modes"]
    assert modes == {"concept": "default", "graph": "immersive", "review": "tutor"}


def test_patch_invalid_mode_is_rejected(client):
    res = client.patch("/api/v1/preferences", json={"modes": {"review": "immersive"}})
    assert res.status_code == 422


def test_patch_unknown_surface_is_rejected(client):
    res = client.patch("/api/v1/preferences", json={"modes": {"settings": "focus"}})
    assert res.status_code == 422

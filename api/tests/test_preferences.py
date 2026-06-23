"""Preferences service — defaults, merge semantics, validation, idempotent row."""

import pytest
from sqlalchemy import select

from app.models import UserPreference
from app.preferences_service import (
    DEFAULT_MODES,
    get_preferences,
    update_modes,
)


def test_defaults_when_unset(db):
    prefs = get_preferences(db)
    assert prefs.modes == DEFAULT_MODES
    # Every default is the canonical direction.
    assert set(prefs.modes.values()) == {"default"}


def test_get_is_idempotent_singleton(db):
    get_preferences(db)
    get_preferences(db)
    assert db.scalar(select(UserPreference)) is not None
    assert len(db.scalars(select(UserPreference)).all()) == 1


def test_update_merges_partial_patch(db):
    update_modes(db, {"concept": "focus"})
    prefs = get_preferences(db)
    # The patched surface flips; the others stay at their default.
    assert prefs.modes["concept"] == "focus"
    assert prefs.modes["graph"] == "default"
    assert prefs.modes["review"] == "default"


def test_update_persists_across_reads(db):
    update_modes(db, {"graph": "immersive", "review": "tutor"})
    prefs = get_preferences(db)
    assert prefs.modes["graph"] == "immersive"
    assert prefs.modes["review"] == "tutor"
    # A second update doesn't clobber the first.
    update_modes(db, {"concept": "focus"})
    prefs = get_preferences(db)
    assert prefs.modes == {"concept": "focus", "graph": "immersive", "review": "tutor"}


def test_can_reset_a_mode_back_to_default(db):
    update_modes(db, {"concept": "focus"})
    update_modes(db, {"concept": "default"})
    assert get_preferences(db).modes["concept"] == "default"


def test_rejects_unknown_surface(db):
    with pytest.raises(ValueError, match="unknown surface"):
        update_modes(db, {"dashboard": "focus"})


def test_rejects_invalid_mode_for_surface(db):
    with pytest.raises(ValueError, match="invalid mode"):
        update_modes(db, {"concept": "immersive"})  # immersive belongs to graph

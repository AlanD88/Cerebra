"""User preferences — the Phase 6 optional-mode switches (polish-frontend.md §2).

A mode is a *presentational* choice (layout/tone), never a data binding or a
locked invariant, so the store is deliberately tiny: a singleton row holding a
{surface: mode} map. Unknown surfaces or modes are rejected so a stale client
can never push the UI into an undefined state."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import UserPreference
from .schemas import PreferencesOut

# The canonical direction is the default everywhere; alternates are opt-in.
DEFAULT_MODES: dict[str, str] = {
    "concept": "default",
    "graph": "default",
    "review": "default",
}

# Allowed values per surface (the third option in each pair is the alt mode).
ALLOWED_MODES: dict[str, set[str]] = {
    "concept": {"default", "focus"},
    "graph": {"default", "immersive"},
    "review": {"default", "tutor"},
}


def _row(db: Session) -> UserPreference:
    """The singleton preferences row, created with defaults on first read."""
    row = db.scalar(select(UserPreference).order_by(UserPreference.created_at.asc()))
    if row is None:
        row = UserPreference(modes=dict(DEFAULT_MODES))
        db.add(row)
        db.flush()
    return row


def get_preferences(db: Session) -> PreferencesOut:
    row = _row(db)
    return PreferencesOut(modes={**DEFAULT_MODES, **(row.modes or {})})


def update_modes(db: Session, patch: dict[str, str]) -> PreferencesOut:
    """Merge a partial {surface: mode} patch over the stored modes.

    Raises ValueError on an unknown surface or an invalid mode for that surface.
    """
    row = _row(db)
    merged = {**DEFAULT_MODES, **(row.modes or {})}
    for surface, mode in patch.items():
        allowed = ALLOWED_MODES.get(surface)
        if allowed is None:
            raise ValueError(f"unknown surface: {surface!r}")
        if mode not in allowed:
            raise ValueError(f"invalid mode {mode!r} for surface {surface!r}")
        merged[surface] = mode
    # Reassign (not in-place mutate) so SQLAlchemy flags the JSON column dirty.
    row.modes = merged
    db.flush()
    return PreferencesOut(modes=merged)

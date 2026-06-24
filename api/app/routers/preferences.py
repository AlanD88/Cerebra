"""Preferences routes: read the optional-mode map and merge a partial update.
Invalid surface/mode → 422. Presentation only — never a learning metric."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import preferences_service as svc
from ..db import get_db
from ..schemas import PreferencesOut, PreferencesPatchIn

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("", response_model=PreferencesOut)
def get_preferences(db: Session = Depends(get_db)) -> PreferencesOut:
    result = svc.get_preferences(db)
    db.commit()
    return result


@router.patch("", response_model=PreferencesOut)
def patch_preferences(
    body: PreferencesPatchIn, db: Session = Depends(get_db)
) -> PreferencesOut:
    try:
        result = svc.update_modes(db, body.modes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return result

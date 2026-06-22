"""Pydantic API schemas. Read schemas reflect projection tables only."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from .enums import HeatState


class SmokeMetricOut(BaseModel):
    """Phase 0/1 read-path proof: a projection row joined to its concept name."""

    model_config = ConfigDict(from_attributes=True)

    concept_id: uuid.UUID
    name: str
    mastery: float
    heat_state: HeatState

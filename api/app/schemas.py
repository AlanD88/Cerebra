"""Pydantic API schemas. Read schemas reflect projection tables only and are
serialized as camelCase DTOs (FastAPI emits by alias for response models)."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from .enums import HeatState


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


# --- Dashboard read DTOs (dashboard-frontend.md §2) ------------------------- #
class DueSummaryOut(CamelModel):
    total: int
    overdue: int
    due_today: int
    subjects: int


class WeakConceptOut(CamelModel):
    concept_id: uuid.UUID
    name: str
    subject: str
    mastery: float
    heat_state: HeatState


class ReviewCountPoint(CamelModel):
    day: date
    count: int


class RetentionTrendsOut(CamelModel):
    points: list[float]
    reviews: list[ReviewCountPoint]


class LearningHealthOut(CamelModel):
    avg_mastery: float
    retention: float
    retention_delta: float
    tracked: int
    subjects: int


class HeatCellOut(CamelModel):
    concept_id: uuid.UUID
    name: str
    heat_state: HeatState
    mastery: float


class HeatRowOut(CamelModel):
    subject: str
    cells: list[HeatCellOut]


class SubjectProgressOut(CamelModel):
    subject_id: uuid.UUID
    name: str
    avg_mastery: float
    heat_state: HeatState

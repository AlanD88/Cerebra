"""Pydantic API schemas. Read schemas reflect projection tables only and are
serialized as camelCase DTOs (FastAPI emits by alias for response models)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

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


# --- Concept Page read DTOs (concept-page-frontend.md §2) ------------------- #
class ConceptDetailOut(CamelModel):
    concept_id: uuid.UUID
    name: str
    subject: str
    breadcrumb: str
    importance: int
    mastery: float
    retention: float
    recall_accuracy: float
    problem_accuracy: float
    heat_state: HeatState
    review_count: int
    due_at: Optional[datetime]
    intuition: Optional[str]
    definition: Optional[str]
    notes: Optional[str]
    viz_spec: Optional[dict]


class RecallItemOut(CamelModel):
    prompt: str
    last_score: int
    heat_state: HeatState


class RecallCardOut(CamelModel):
    due_count: int
    items: list[RecallItemOut]


class DependencyOut(CamelModel):
    concept_id: uuid.UUID
    name: str
    heat_state: HeatState
    mastery: float
    is_root_weakness: bool


class InsightOut(CamelModel):
    summary: str
    suggested_concept_id: Optional[uuid.UUID]
    cta: str


# --- Review read/write DTOs (review-frontend.md §3) ------------------------- #
class ReviewItemOut(CamelModel):
    item_id: uuid.UUID
    concept_id: uuid.UUID
    concept_name: str
    prompt: str


class ReviewSessionOut(CamelModel):
    session_id: uuid.UUID
    total: int
    concept_name: Optional[str]
    items: list[ReviewItemOut]


class CreateSessionIn(CamelModel):
    concept_id: Optional[uuid.UUID] = None


class AssessIn(CamelModel):
    item_id: uuid.UUID
    learner_answer: str


class AssessResultOut(CamelModel):
    score: int
    label: str
    rationale: str
    next_interval_days: float
    heat_state: HeatState
    model_answer: Optional[str]


# --- Knowledge Graph DTOs (graph-frontend.md §2/§3) ------------------------- #
class SubjectOut(CamelModel):
    id: uuid.UUID
    name: str


class GraphLayoutOut(CamelModel):
    concept_id: uuid.UUID
    x: float
    y: float
    pinned: bool


class GraphNodeOut(CamelModel):
    concept_id: uuid.UUID
    name: str
    importance: int
    heat_state: HeatState
    mastery: float


class GraphEdgeOut(CamelModel):
    source: uuid.UUID
    target: uuid.UUID
    type: str
    strength: Optional[float]


class LayoutPosIn(CamelModel):
    concept_id: uuid.UUID
    x: float
    y: float


class LayoutPatchIn(CamelModel):
    positions: list[LayoutPosIn]


# --- Preferences DTOs (polish-frontend.md §2) ------------------------------- #
# `modes` maps a surface ("concept"|"graph"|"review") to its presentational
# variant. Presentation only — never a data binding or a learning metric.
class PreferencesOut(CamelModel):
    modes: dict[str, str]


class PreferencesPatchIn(CamelModel):
    modes: dict[str, str]

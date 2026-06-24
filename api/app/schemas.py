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


# --- Ingest write DTOs (deep-learn → Cerebra bridge) ------------------------ #
# A thin authoring/event-logging surface used by the MCP bridge. Every write
# still flows through the projection pipeline; reads stay on projection tables.
# `subject`/`concept` references accept a name OR a UUID string (resolved server
# side). Outcomes are read-only — the score is server-assigned, never proposed.
class SubjectIn(CamelModel):
    name: str
    description: Optional[str] = None


class SubjectRefOut(CamelModel):
    id: uuid.UUID
    name: str
    created: bool


class ConceptIn(CamelModel):
    subject: str  # name or UUID
    name: str
    slug: Optional[str] = None
    importance: int = 3
    intuition: Optional[str] = None
    definition: Optional[str] = None
    notes: Optional[str] = None
    viz_spec: Optional[dict] = None


class ConceptRefOut(CamelModel):
    concept_id: uuid.UUID
    subject_id: uuid.UUID
    name: str
    slug: str
    created: bool


class RelationshipIn(CamelModel):
    subject: str  # name or UUID
    source: str  # prerequisite — name or UUID
    target: str  # dependent — name or UUID
    type: str = "prerequisite"
    strength: Optional[float] = None


class RelationshipOut(CamelModel):
    id: uuid.UUID
    source: uuid.UUID
    target: uuid.UUID
    type: str
    created: bool


class RecallIn(CamelModel):
    subject: Optional[str] = None  # required only when createIfMissing
    concept: str  # name or UUID
    prompt: str
    grade: Optional[str] = None  # full | partial | forgotten
    score: Optional[int] = None  # 0–3, alternative to grade
    learner_answer: Optional[str] = None
    rationale: Optional[str] = None
    assessed_by: str = "deep-learn"
    occurred_at: Optional[datetime] = None
    create_if_missing: bool = False


class ProblemIn(CamelModel):
    subject: Optional[str] = None
    concept: str
    prompt: str
    is_correct: bool
    partial: Optional[float] = None
    occurred_at: Optional[datetime] = None
    create_if_missing: bool = False


class ExplanationIn(CamelModel):
    subject: Optional[str] = None
    concept: str
    content: str
    quality: Optional[int] = None  # 0–3, feeds the mastery bonus
    direction: str = "learner_to_ai"
    occurred_at: Optional[datetime] = None
    create_if_missing: bool = False


class IngestOutcomeOut(CamelModel):
    """Read-only projection snapshot returned after an event is logged."""

    concept_id: uuid.UUID
    name: str
    score: Optional[int] = None  # set for recall events only
    mastery: float
    retention: float
    heat_state: HeatState
    review_count: int
    due_at: Optional[datetime]
    next_interval_days: float


class SessionTopicIn(CamelModel):
    name: str
    slug: Optional[str] = None
    importance: int = 3
    intuition: Optional[str] = None
    definition: Optional[str] = None
    notes: Optional[str] = None
    viz_spec: Optional[dict] = None
    prerequisites: list[str] = []  # names of prerequisite topics in this subject


class SessionEventIn(CamelModel):
    type: str  # recall | problem | explanation
    concept: str  # topic name or UUID
    # recall
    prompt: Optional[str] = None
    grade: Optional[str] = None
    score: Optional[int] = None
    learner_answer: Optional[str] = None
    rationale: Optional[str] = None
    # problem
    is_correct: Optional[bool] = None
    partial: Optional[float] = None
    # explanation
    content: Optional[str] = None
    quality: Optional[int] = None
    direction: str = "learner_to_ai"
    occurred_at: Optional[datetime] = None


class SessionIn(CamelModel):
    subject: str  # name or UUID
    description: Optional[str] = None
    topics: list[SessionTopicIn] = []
    events: list[SessionEventIn] = []


class SessionOutcomeOut(CamelModel):
    subject_id: uuid.UUID
    subject_name: str
    concepts: list[IngestOutcomeOut]


class DueReviewOut(CamelModel):
    concept_id: uuid.UUID
    name: str
    subject: str
    mastery: float
    heat_state: HeatState
    due_at: Optional[datetime]


# --- Preferences DTOs (polish-frontend.md §2) ------------------------------- #
# `modes` maps a surface ("concept"|"graph"|"review") to its presentational
# variant. Presentation only — never a data binding or a learning metric.
class PreferencesOut(CamelModel):
    modes: dict[str, str]


class PreferencesPatchIn(CamelModel):
    modes: dict[str, str]

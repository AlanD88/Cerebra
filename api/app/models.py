"""SQLAlchemy ORM models — the nine Cerebra entities (data-architecture.md §2).

Written to be dialect-agnostic: UUID PKs are Python-generated, timestamps are
tz-aware, and enums are stored as portable VARCHAR + CHECK so the same models
run on PostgreSQL (production) and SQLite (dev/test).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .enums import ExplanationDirection, HeatState, RelationshipType


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _enum(py_enum: type) -> SAEnum:
    """Portable enum column: stores the member *value* as text + CHECK."""
    return SAEnum(
        py_enum,
        native_enum=False,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
    )


# --------------------------------------------------------------------------- #
# Core group — authored / structural
# --------------------------------------------------------------------------- #
class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    accent: Mapped[Optional[str]] = mapped_column(String(9))  # hex override
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    concepts: Mapped[list["Concept"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan"
    )


class Concept(Base):
    __tablename__ = "concepts"
    __table_args__ = (
        UniqueConstraint("subject_id", "slug", name="uq_concept_slug_per_subject"),
        CheckConstraint("importance >= 1 AND importance <= 5", name="ck_concept_importance"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[int] = mapped_column(SmallInteger, default=3)  # 1–5, graph node size
    intuition: Mapped[Optional[str]] = mapped_column(Text)
    definition: Mapped[Optional[str]] = mapped_column(Text)  # KaTeX source
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    subject: Mapped["Subject"] = relationship(back_populates="concepts")
    metrics: Mapped[Optional["ConceptMetric"]] = relationship(
        back_populates="concept", cascade="all, delete-orphan", uselist=False
    )
    schedule: Mapped[Optional["ReviewSchedule"]] = relationship(
        back_populates="concept", cascade="all, delete-orphan", uselist=False
    )


class ConceptRelationship(Base):
    __tablename__ = "concept_relationships"
    __table_args__ = (
        UniqueConstraint(
            "source_concept_id", "target_concept_id", "type", name="uq_relationship_triple"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # directed: source = prerequisite, target = dependent
    source_concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False
    )
    target_concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[RelationshipType] = mapped_column(_enum(RelationshipType), nullable=False)
    strength: Mapped[Optional[float]] = mapped_column(Float)  # 0–1 edge weight
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# --------------------------------------------------------------------------- #
# Events group — append-only, immutable (no updated_at)
# --------------------------------------------------------------------------- #
class RecallEvent(Base):
    __tablename__ = "recall_events"
    __table_args__ = (CheckConstraint("score >= 0 AND score <= 3", name="ck_recall_score"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    learner_answer: Mapped[Optional[str]] = mapped_column(Text)
    model_answer: Mapped[Optional[str]] = mapped_column(Text)
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0–3, AI-assigned
    rationale: Mapped[Optional[str]] = mapped_column(Text)
    assessed_by: Mapped[Optional[str]] = mapped_column(String(120))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )


class ProblemAttempt(Base):
    __tablename__ = "problem_attempts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    learner_answer: Mapped[Optional[str]] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    partial: Mapped[Optional[float]] = mapped_column(Float)  # 0–1 partial credit
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )


class ExplanationEvent(Base):
    __tablename__ = "explanation_events"
    __table_args__ = (
        CheckConstraint("quality IS NULL OR (quality >= 0 AND quality <= 3)", name="ck_expl_quality"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    direction: Mapped[ExplanationDirection] = mapped_column(
        _enum(ExplanationDirection), nullable=False
    )
    quality: Mapped[Optional[int]] = mapped_column(SmallInteger)  # 0–3, only for learner_to_ai
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )


# --------------------------------------------------------------------------- #
# Projections group — derived; UI reads ONLY these
# --------------------------------------------------------------------------- #
class ConceptMetric(Base):
    __tablename__ = "concept_metrics"

    concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True
    )
    mastery: Mapped[float] = mapped_column(Float, default=0.0)
    retention: Mapped[float] = mapped_column(Float, default=0.0)
    recall_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    problem_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    heat_state: Mapped[HeatState] = mapped_column(_enum(HeatState), default=HeatState.frozen)
    stability: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    projection_version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    concept: Mapped["Concept"] = relationship(back_populates="metrics")


class ReviewSchedule(Base):
    __tablename__ = "review_schedule"

    concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    interval_days: Mapped[float] = mapped_column(Float, default=0.0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    last_score: Mapped[Optional[int]] = mapped_column(SmallInteger)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    concept: Mapped["Concept"] = relationship(back_populates="schedule")


# --------------------------------------------------------------------------- #
# Layout group — presentation; decoupled from relationships
# --------------------------------------------------------------------------- #
class GraphLayout(Base):
    __tablename__ = "graph_layouts"
    __table_args__ = (
        UniqueConstraint("concept_id", "layout_version", name="uq_layout_per_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    concept_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False
    )
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    layout_version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

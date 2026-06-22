"""Seed dataset — one subject (Linear Algebra) with four concepts, a prerequisite
chain, a spread of learning events, and graph positions. Running projections over
the seed yields a realistic mix of heat states (mastered → frozen).

Usage:  python -m app.seed        # creates tables + seeds the default DB
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .enums import ExplanationDirection, RelationshipType
from .models import (
    Concept,
    ConceptRelationship,
    ExplanationEvent,
    GraphLayout,
    ProblemAttempt,
    RecallEvent,
    Subject,
)
from .projections import run_all_projections


def _recall(concept: Concept, score: int, when: datetime, prompt: str) -> RecallEvent:
    return RecallEvent(
        concept_id=concept.id,
        prompt=prompt,
        learner_answer="(seed)",
        model_answer="(seed reference)",
        score=score,
        rationale="seed event",
        assessed_by="seed",
        occurred_at=when,
    )


def seed(db: Session, now: datetime | None = None, *, force: bool = False) -> Subject:
    now = now or datetime.now(timezone.utc)
    base = now - timedelta(days=30)

    existing = db.scalar(select(Subject).where(Subject.name == "Linear Algebra"))
    if existing is not None and not force:
        return existing

    subject = Subject(
        name="Linear Algebra",
        description="Vectors, matrices, and the structure of linear maps.",
        accent="#61715A",
    )
    db.add(subject)
    db.flush()

    vectors = Concept(
        subject_id=subject.id,
        name="Vectors",
        slug="vectors",
        importance=5,
        intuition="A vector is a quantity with both magnitude and direction.",
        definition=r"\vec{v} \in \mathbb{R}^n",
        notes="Foundational object for the whole subject.",
    )
    matrix = Concept(
        subject_id=subject.id,
        name="Matrix",
        slug="matrix",
        importance=4,
        intuition="A matrix encodes a linear transformation between vector spaces.",
        definition=r"A \in \mathbb{R}^{m \times n}",
        notes="Acts on vectors by multiplication.",
    )
    eigenvector = Concept(
        subject_id=subject.id,
        name="Eigenvector",
        slug="eigenvector",
        importance=4,
        intuition="A direction left unchanged (up to scale) by a transformation.",
        definition=r"A\vec{v} = \lambda \vec{v}",
        notes="Eigenvalue lambda is the scaling factor.",
    )
    svd = Concept(
        subject_id=subject.id,
        name="Singular Value Decomposition",
        slug="svd",
        importance=3,
        intuition="Any matrix factors into rotate · scale · rotate.",
        definition=r"A = U \Sigma V^{\top}",
        notes="Newly added — not yet reviewed.",
    )
    db.add_all([vectors, matrix, eigenvector, svd])
    db.flush()

    # Prerequisite chain + one related edge. (Layout is added separately below.)
    db.add_all(
        [
            ConceptRelationship(
                subject_id=subject.id,
                source_concept_id=vectors.id,
                target_concept_id=matrix.id,
                type=RelationshipType.prerequisite,
                strength=0.9,
            ),
            ConceptRelationship(
                subject_id=subject.id,
                source_concept_id=matrix.id,
                target_concept_id=eigenvector.id,
                type=RelationshipType.prerequisite,
                strength=0.85,
            ),
            ConceptRelationship(
                subject_id=subject.id,
                source_concept_id=eigenvector.id,
                target_concept_id=svd.id,
                type=RelationshipType.prerequisite,
                strength=0.7,
            ),
            ConceptRelationship(
                subject_id=subject.id,
                source_concept_id=matrix.id,
                target_concept_id=svd.id,
                type=RelationshipType.related,
                strength=0.5,
            ),
        ]
    )

    def at(day: int) -> datetime:
        return base + timedelta(days=day)

    # Vectors: well-practiced and recent → high mastery.
    db.add_all(
        [
            _recall(vectors, 2, at(0), "Define a vector."),
            _recall(vectors, 3, at(7), "Add two vectors geometrically."),
            _recall(vectors, 3, at(16), "What is a unit vector?"),
            _recall(vectors, 3, at(28), "Project one vector onto another."),
        ]
    )
    # Matrix: improving, mid-range.
    db.add_all(
        [
            _recall(matrix, 1, at(2), "What does matrix multiplication compute?"),
            _recall(matrix, 2, at(9), "Compute a 2x2 product."),
            _recall(matrix, 3, at(18), "What is the identity matrix?"),
            _recall(matrix, 2, at(27), "When is a matrix invertible?"),
        ]
    )
    # Eigenvector: struggling → cold.
    db.add_all(
        [
            _recall(eigenvector, 0, at(5), "Define an eigenvector."),
            _recall(eigenvector, 1, at(12), "Find eigenvalues of a 2x2."),
            _recall(eigenvector, 1, at(20), "Geometric meaning of eigenvectors?"),
        ]
    )
    # SVD: no recall events → frozen.

    db.add_all(
        [
            ProblemAttempt(
                concept_id=vectors.id,
                prompt="Compute the dot product of (1,2,3) and (4,5,6).",
                learner_answer="32",
                is_correct=True,
                occurred_at=at(16),
            ),
            ProblemAttempt(
                concept_id=matrix.id,
                prompt="Invert a singular matrix.",
                learner_answer="(attempted)",
                is_correct=False,
                partial=0.4,
                occurred_at=at(18),
            ),
        ]
    )
    db.add(
        ExplanationEvent(
            concept_id=vectors.id,
            content="A vector is like an arrow: it has length and points somewhere.",
            direction=ExplanationDirection.learner_to_ai,
            quality=3,
            occurred_at=at(28),
        )
    )

    # Graph layout (decoupled from relationships) — fixed positions for a tidy atlas.
    positions = {vectors.id: (0.0, 0.0), matrix.id: (220.0, -40.0), eigenvector.id: (440.0, 30.0), svd.id: (640.0, -10.0)}
    db.add_all(
        [
            GraphLayout(subject_id=subject.id, concept_id=cid, x=x, y=y, layout_version=1)
            for cid, (x, y) in positions.items()
        ]
    )

    db.flush()
    run_all_projections(db, now=now)
    db.commit()
    return subject


def main() -> None:  # pragma: no cover - operational entrypoint
    from .db import Base, SessionLocal, engine

    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db, force=False)
    print("Seeded Linear Algebra subject.")


if __name__ == "__main__":  # pragma: no cover
    main()

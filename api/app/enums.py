import enum


class RelationshipType(str, enum.Enum):
    prerequisite = "prerequisite"
    related = "related"
    extends = "extends"


class ExplanationDirection(str, enum.Enum):
    learner_to_ai = "learner_to_ai"  # Feynman: learner explains to the AI
    ai_to_learner = "ai_to_learner"


class HeatState(str, enum.Enum):
    mastered = "mastered"
    hot = "hot"
    warm = "warm"
    cold = "cold"
    frozen = "frozen"

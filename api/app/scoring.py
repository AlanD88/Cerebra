"""Server-side answer assessment — the "AI" assigns the score (agent-rules: no
self-grading). This default is a deterministic heuristic over key-term coverage,
so the app runs with no external model and tests stay hermetic. A real model
call can be swapped in behind the same `assess_answer` signature; the contract
(learner sends an answer, server returns a 0–3 score + rationale) is unchanged.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .models import Concept

_WORD = re.compile(r"[a-zA-Z]{3,}")
_STOP = {
    "the", "and", "for", "with", "that", "this", "are", "was", "its", "only",
    "into", "when", "they", "them", "has", "have", "all", "any", "but", "not",
    "you", "your", "one", "two", "get", "gets", "got", "their", "out", "off",
    "same", "way", "acts", "act", "rare", "most", "each", "called", "factor",
}

LABELS = {0: "Forgot", 1: "Partial", 2: "Mostly correct", 3: "Perfect"}

_RATIONALE = {
    3: "Complete and precise — you named the defining relationship.",
    2: "Mostly there — you captured the core idea; state the formal relationship to reach Perfect.",
    1: "Partial — you touched the idea but key elements are missing.",
    0: "Not recalled — review the definition, then try again.",
}


@dataclass(frozen=True)
class Assessment:
    score: int
    label: str
    rationale: str
    assessed_by: str


def key_terms(concept: Concept) -> set[str]:
    """The concept's salient terms (name + intuition, minus short and stop words) —
    the heuristic's stand-in for 'what a good answer should mention'."""
    text = f"{concept.name} {concept.intuition or ''}"
    return {w for w in _WORD.findall(text.lower()) if w not in _STOP}


def assess_answer(concept: Concept, learner_answer: str) -> Assessment:
    """Score 0–3 by the fraction of the concept's key terms the answer covers
    (empty → 0). Deterministic by design, so the review loop runs with no model
    and the tests stay hermetic."""
    answer = (learner_answer or "").strip()
    if not answer:
        return Assessment(0, LABELS[0], _RATIONALE[0], "heuristic-v1")

    terms = key_terms(concept)
    answer_words = {w for w in _WORD.findall(answer.lower())}
    coverage = (len(terms & answer_words) / len(terms)) if terms else 0.0

    if coverage >= 0.5:
        score = 3
    elif coverage >= 0.3:
        score = 2
    elif coverage >= 0.12:
        score = 1
    else:
        score = 0

    return Assessment(score, LABELS[score], _RATIONALE[score], "heuristic-v1")

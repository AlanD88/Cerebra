"""SM-2 spaced-repetition scheduler, adapted to Cerebra's 0–3 score scale.

Pure functions over a plain dataclass — no DB, no clock — so the policy is
exhaustively unit-testable. Reference: data-architecture.md §4.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

EASE_DEFAULT = 2.5
EASE_MIN = 1.3


@dataclass(frozen=True)
class ScheduleState:
    interval_days: float
    ease_factor: float
    repetitions: int
    last_score: int | None


@dataclass(frozen=True)
class ScheduleStep:
    state: ScheduleState
    due_at: datetime
    stability: float


def initial_state() -> ScheduleState:
    return ScheduleState(interval_days=0.0, ease_factor=EASE_DEFAULT, repetitions=0, last_score=None)


def sm2_update(prev: ScheduleState, score: int, reviewed_at: datetime) -> ScheduleStep:
    """Apply one recall outcome.

    score (q): 0 Forgot · 1 Partial · 2 Mostly Correct · 3 Perfect.
    Returns the new state, the next due date, and the memory stability used by
    the retention estimate.
    """
    if not 0 <= score <= 3:
        raise ValueError(f"score must be in 0..3, got {score}")

    q = score
    ease = prev.ease_factor
    reps = prev.repetitions
    prev_interval = prev.interval_days

    if q <= 1:  # failed recall — reset
        reps = 0
        interval = 1.0
    else:
        reps += 1
        if reps == 1:
            interval = 1.0
        elif reps == 2:
            interval = 6.0
        else:
            interval = float(round(prev_interval * ease))

    # Ease update (3 is best here, vs 5 in classic SM-2).
    ease = ease + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
    ease = max(ease, EASE_MIN)

    due_at = reviewed_at + timedelta(days=interval)
    stability = interval * ease

    return ScheduleStep(
        state=ScheduleState(
            interval_days=interval, ease_factor=ease, repetitions=reps, last_score=q
        ),
        due_at=due_at,
        stability=stability,
    )

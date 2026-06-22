import math
from datetime import datetime, timedelta, timezone

import pytest

from app.enums import HeatState
from app.projections import (
    DORMANT_DAYS,
    EXPLANATION_BONUS_CAP,
    RECENCY_LAMBDA,
    ExplanationSample,
    ProblemSample,
    RecallSample,
    compute_metrics,
    compute_schedule,
    derive_heat,
    recency_weighted_average,
)

NOW = datetime(2026, 6, 1, tzinfo=timezone.utc)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


# --- recency weighting ------------------------------------------------------ #
def test_weighted_average_of_empty_is_zero():
    assert recency_weighted_average([]) == 0.0


def test_recent_samples_dominate_older_ones():
    # A perfect recent score and a zero old score should sit above the midpoint.
    recent_high = recency_weighted_average([(1.0, 0.0), (0.0, 60.0)])
    recent_low = recency_weighted_average([(0.0, 0.0), (1.0, 60.0)])
    assert recent_high > 0.5 > recent_low


def test_weight_matches_half_life():
    # At one half-life the weight should be 0.5.
    half_life = math.log(2) / RECENCY_LAMBDA
    avg = recency_weighted_average([(1.0, 0.0), (1.0, half_life)])
    # both values are 1.0 so the average is 1.0 regardless; check the weight directly
    assert math.exp(-RECENCY_LAMBDA * half_life) == pytest.approx(0.5)
    assert avg == pytest.approx(1.0)


# --- heat derivation -------------------------------------------------------- #
def test_heat_frozen_when_never_reviewed():
    assert derive_heat(0.0, 0.0, None, reviewed=False) is HeatState.frozen


def test_heat_frozen_when_dormant():
    assert derive_heat(0.9, 0.9, DORMANT_DAYS + 1, reviewed=True) is HeatState.frozen


def test_heat_mastered_requires_high_mastery_and_retention():
    assert derive_heat(0.9, 0.85, 1.0, reviewed=True) is HeatState.mastered


def test_high_mastery_but_low_retention_is_cold():
    assert derive_heat(0.9, 0.4, 1.0, reviewed=True) is HeatState.cold


def test_heat_hot_band():
    assert derive_heat(0.75, 0.6, 1.0, reviewed=True) is HeatState.hot


def test_heat_warm_band():
    assert derive_heat(0.55, 0.6, 1.0, reviewed=True) is HeatState.warm


def test_low_mastery_is_cold_even_with_good_retention():
    assert derive_heat(0.3, 0.95, 1.0, reviewed=True) is HeatState.cold


# --- metrics ---------------------------------------------------------------- #
def test_problem_accuracy_uses_partial_credit():
    schedule = compute_schedule([])
    m = compute_metrics(
        recalls=[],
        problems=[ProblemSample(is_correct=False, partial=0.5, occurred_at=days_ago(0))],
        explanations=[],
        schedule=schedule,
        now=NOW,
    )
    assert m.problem_accuracy == pytest.approx(0.5)


def test_problem_accuracy_treats_missing_partial_as_zero():
    schedule = compute_schedule([])
    m = compute_metrics(
        recalls=[],
        problems=[ProblemSample(is_correct=False, partial=None, occurred_at=days_ago(0))],
        explanations=[],
        schedule=schedule,
        now=NOW,
    )
    assert m.problem_accuracy == 0.0


def test_retention_decays_with_time_since_review():
    recalls = [RecallSample(score=3, occurred_at=days_ago(0))]
    schedule = compute_schedule(recalls)
    # one perfect review: interval 1, ease 2.6 -> stability 2.6
    m = compute_metrics([], [], [], schedule, now=NOW)
    # schedule has last_reviewed at days_ago(0) == NOW -> retention 1.0
    assert m.retention == pytest.approx(1.0)

    later = NOW + timedelta(days=2.6)
    m2 = compute_metrics([], [], [], schedule, now=later)
    assert m2.retention == pytest.approx(math.exp(-2.6 / schedule.stability))


def test_explanation_bonus_only_counts_learner_to_ai_and_is_capped():
    recalls = [RecallSample(score=3, occurred_at=days_ago(0))]
    schedule = compute_schedule(recalls)
    base = compute_metrics(recalls, [], [], schedule, now=NOW)

    boosted = compute_metrics(
        recalls,
        [],
        [
            ExplanationSample(quality=3, direction="learner_to_ai", occurred_at=days_ago(0)),
            ExplanationSample(quality=3, direction="ai_to_learner", occurred_at=days_ago(0)),
            ExplanationSample(quality=None, direction="learner_to_ai", occurred_at=days_ago(0)),
        ],
        schedule,
        now=NOW,
    )
    # full-quality learner explanation adds the cap; ai_to_learner + null ignored
    assert boosted.mastery - base.mastery == pytest.approx(EXPLANATION_BONUS_CAP, abs=1e-9)


def test_mastery_is_clamped_to_unit_interval():
    recalls = [RecallSample(score=3, occurred_at=days_ago(0)) for _ in range(3)]
    schedule = compute_schedule(recalls)
    m = compute_metrics(
        recalls,
        [ProblemSample(is_correct=True, partial=None, occurred_at=days_ago(0))],
        [ExplanationSample(quality=3, direction="learner_to_ai", occurred_at=days_ago(0))],
        schedule,
        now=NOW,
    )
    assert 0.0 <= m.mastery <= 1.0


def test_no_events_yields_zero_metrics_and_frozen():
    schedule = compute_schedule([])
    m = compute_metrics([], [], [], schedule, now=NOW)
    assert m.mastery == 0.0
    assert m.retention == 0.0
    assert m.review_count == 0
    assert m.heat_state is HeatState.frozen

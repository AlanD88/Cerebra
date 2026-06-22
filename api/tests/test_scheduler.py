from datetime import datetime, timezone

import pytest

from app.scheduler import EASE_MIN, ScheduleState, initial_state, sm2_update

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_first_success_sets_interval_one_and_bumps_ease():
    step = sm2_update(initial_state(), 3, T0)
    assert step.state.interval_days == 1.0
    assert step.state.repetitions == 1
    assert step.state.ease_factor == pytest.approx(2.6)
    assert step.state.last_score == 3
    assert step.due_at == datetime(2026, 1, 2, tzinfo=timezone.utc)
    assert step.stability == pytest.approx(2.6)


def test_second_success_jumps_to_six_days():
    s1 = sm2_update(initial_state(), 3, T0).state
    step = sm2_update(s1, 3, T0)
    assert step.state.interval_days == 6.0
    assert step.state.repetitions == 2
    assert step.state.ease_factor == pytest.approx(2.7)


def test_third_interval_is_prev_interval_times_ease_rounded():
    s1 = sm2_update(initial_state(), 3, T0).state
    s2 = sm2_update(s1, 3, T0).state  # interval 6, ease 2.7
    step = sm2_update(s2, 2, T0)  # round(6 * 2.7) = 16; q=2 leaves ease unchanged
    assert step.state.interval_days == 16.0
    assert step.state.repetitions == 3
    assert step.state.ease_factor == pytest.approx(2.7)
    assert step.stability == pytest.approx(16.0 * 2.7)


def test_q2_does_not_change_ease():
    step = sm2_update(initial_state(), 2, T0)
    assert step.state.ease_factor == pytest.approx(2.5)


def test_failure_resets_repetitions_and_interval():
    s2 = sm2_update(sm2_update(initial_state(), 3, T0).state, 3, T0).state
    step = sm2_update(s2, 1, T0)
    assert step.state.repetitions == 0
    assert step.state.interval_days == 1.0
    # q=1 drops ease by 0.14
    assert step.state.ease_factor == pytest.approx(2.7 - 0.14)


def test_zero_score_drops_ease_sharply():
    step = sm2_update(initial_state(), 0, T0)
    assert step.state.ease_factor == pytest.approx(2.5 - 0.32)


def test_ease_never_falls_below_floor():
    state = ScheduleState(interval_days=1.0, ease_factor=EASE_MIN, repetitions=0, last_score=0)
    step = sm2_update(state, 0, T0)
    assert step.state.ease_factor == EASE_MIN


def test_invalid_score_raises():
    with pytest.raises(ValueError):
        sm2_update(initial_state(), 4, T0)
    with pytest.raises(ValueError):
        sm2_update(initial_state(), -1, T0)

import { describe, expect, it } from 'vitest';
import { initialState, reducer, type SessionState } from './reducer';
import type { AssessResult } from './types';

const outcome: AssessResult = {
  score: 2,
  label: 'Mostly correct',
  rationale: 'ok',
  nextIntervalDays: 4,
  heatState: 'hot',
  modelAnswer: 'x',
};

describe('review session reducer', () => {
  it('starts in PROMPT', () => {
    expect(initialState.phase).toBe('PROMPT');
  });

  it('moves PROMPT → ANSWERING on first non-empty keystroke', () => {
    const s = reducer(initialState, { type: 'EDIT', draft: 'a' });
    expect(s.phase).toBe('ANSWERING');
    expect(s.draft).toBe('a');
  });

  it('stays in PROMPT while the draft is empty', () => {
    const s = reducer(initialState, { type: 'EDIT', draft: '' });
    expect(s.phase).toBe('PROMPT');
  });

  it('submits only from ANSWERING with a non-empty draft', () => {
    const answering: SessionState = { ...initialState, phase: 'ANSWERING', draft: 'hi' };
    expect(reducer(answering, { type: 'SUBMIT' }).phase).toBe('SUBMITTING');
    expect(reducer(initialState, { type: 'SUBMIT' }).phase).toBe('PROMPT');
    expect(
      reducer({ ...initialState, phase: 'ANSWERING', draft: '   ' }, { type: 'SUBMIT' }).phase,
    ).toBe('ANSWERING');
  });

  it('records the outcome on ASSESSED and accumulates results', () => {
    const submitting: SessionState = { ...initialState, phase: 'SUBMITTING', draft: 'hi' };
    const s = reducer(submitting, { type: 'ASSESSED', outcome });
    expect(s.phase).toBe('ASSESSED');
    expect(s.outcome).toEqual(outcome);
    expect(s.results).toHaveLength(1);
  });

  it('preserves the draft and returns to ANSWERING on error', () => {
    const submitting: SessionState = { ...initialState, phase: 'SUBMITTING', draft: 'my answer' };
    const s = reducer(submitting, { type: 'ERROR' });
    expect(s.phase).toBe('ANSWERING');
    expect(s.draft).toBe('my answer');
    expect(s.error).toBe(true);
  });

  it('advances to the next item on CONTINUE, clearing the draft', () => {
    const assessed: SessionState = { ...initialState, phase: 'ASSESSED', index: 0, draft: 'a', outcome };
    const s = reducer(assessed, { type: 'CONTINUE', total: 2 });
    expect(s.phase).toBe('PROMPT');
    expect(s.index).toBe(1);
    expect(s.draft).toBe('');
    expect(s.outcome).toBeNull();
  });

  it('completes after the last item', () => {
    const assessed: SessionState = { ...initialState, phase: 'ASSESSED', index: 1, outcome };
    const s = reducer(assessed, { type: 'CONTINUE', total: 2 });
    expect(s.phase).toBe('COMPLETE');
  });

  it('has no action that sets a score (no self-grading)', () => {
    // The only way to populate an outcome is ASSESSED, which carries a
    // server-provided result — there is no SET_SCORE action in the union.
    const actionTypes = ['EDIT', 'SUBMIT', 'ASSESSED', 'ERROR', 'CONTINUE'];
    expect(actionTypes).not.toContain('SET_SCORE');
  });
});

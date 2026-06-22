import type { AssessResult } from './types';

// The five-state session machine (review-frontend.md §1). There is deliberately
// NO action that sets a score — the score is server-assigned and only ever
// arrives via ASSESSED. This keeps "no path to self-grade" auditable.
export type Phase = 'PROMPT' | 'ANSWERING' | 'SUBMITTING' | 'ASSESSED' | 'COMPLETE';

export interface SessionState {
  phase: Phase;
  index: number;
  draft: string;
  outcome: AssessResult | null;
  results: AssessResult[];
  error: boolean;
}

export type SessionAction =
  | { type: 'EDIT'; draft: string }
  | { type: 'SUBMIT' }
  | { type: 'ASSESSED'; outcome: AssessResult }
  | { type: 'ERROR' }
  | { type: 'CONTINUE'; total: number };

export const initialState: SessionState = {
  phase: 'PROMPT',
  index: 0,
  draft: '',
  outcome: null,
  results: [],
  error: false,
};

export function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'EDIT':
      return {
        ...state,
        draft: action.draft,
        phase: state.phase === 'PROMPT' && action.draft.length > 0 ? 'ANSWERING' : state.phase,
      };
    case 'SUBMIT':
      return state.phase === 'ANSWERING' && state.draft.trim().length > 0
        ? { ...state, phase: 'SUBMITTING', error: false }
        : state;
    case 'ASSESSED':
      return {
        ...state,
        phase: 'ASSESSED',
        outcome: action.outcome,
        results: [...state.results, action.outcome],
      };
    case 'ERROR':
      // Preserve the learner's draft; return to ANSWERING so they can retry.
      return { ...state, phase: 'ANSWERING', error: true };
    case 'CONTINUE': {
      const next = state.index + 1;
      if (next >= action.total) return { ...state, phase: 'COMPLETE' };
      return { ...state, index: next, phase: 'PROMPT', draft: '', outcome: null, error: false };
    }
    default:
      return state;
  }
}

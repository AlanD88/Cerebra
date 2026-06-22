import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { HeatDot } from '../../components/HeatDot';
import { Tex } from '../../components/Tex';
import { ErrorState } from '../../components/feedback';
import { initialState, reducer } from './reducer';
import { reviewQueries } from './queries';
import type { AssessResult, ReviewItem } from './types';

function ReviewChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex min-h-screen max-w-[660px] flex-col px-6 py-10">{children}</div>
    </div>
  );
}

export function ReviewSession() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQ = useQuery(reviewQueries.session(sessionId));
  const [state, dispatch] = useReducer(reducer, initialState);

  const answerRef = useRef<HTMLTextAreaElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const items = sessionQ.data?.items ?? [];
  const total = items.length;
  const current: ReviewItem | undefined = items[state.index];

  const assessMut = useMutation({
    mutationFn: (vars: { itemId: string; answer: string }) =>
      api.post<AssessResult>(`/review/${sessionId}/assess`, {
        itemId: vars.itemId,
        learnerAnswer: vars.answer,
      }),
    onSuccess: (outcome) => {
      dispatch({ type: 'ASSESSED', outcome });
      if (current) {
        // The server already re-projected; refresh everything that read it.
        queryClient.invalidateQueries({ queryKey: ['concept', current.conceptId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
    onError: () => dispatch({ type: 'ERROR' }),
  });

  const handleSubmit = useCallback(() => {
    if (state.phase !== 'ANSWERING' || !state.draft.trim() || !current) return;
    dispatch({ type: 'SUBMIT' });
    assessMut.mutate({ itemId: current.itemId, answer: state.draft });
  }, [state.phase, state.draft, current, assessMut]);

  const handleContinue = useCallback(() => dispatch({ type: 'CONTINUE', total }), [total]);

  const handleExit = useCallback(() => {
    if (window.confirm('Exit this review session? Your progress so far is saved.')) {
      navigate('/');
    }
  }, [navigate]);

  // Focus moves deliberately: answer on each new prompt, Continue on each outcome.
  useEffect(() => {
    if (state.phase === 'ASSESSED') continueRef.current?.focus();
    else if (state.phase === 'PROMPT' || state.phase === 'ANSWERING') answerRef.current?.focus();
  }, [state.phase, state.index]);

  // Esc exits from anywhere. Enter→Continue is handled natively by the focused button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleExit]);

  if (sessionQ.isLoading) {
    return (
      <ReviewChrome>
        <div className="m-auto text-body text-charcoal/60">Preparing your session…</div>
      </ReviewChrome>
    );
  }

  if (sessionQ.isError) {
    return (
      <ReviewChrome>
        <div className="m-auto max-w-sm text-center">
          <ErrorState onRetry={() => sessionQ.refetch()} message="Couldn't load this session." />
        </div>
      </ReviewChrome>
    );
  }

  if (total === 0) {
    return (
      <ReviewChrome>
        <div className="m-auto max-w-sm text-center">
          <p className="font-display text-h2 text-charcoal">Nothing due right now</p>
          <p className="mt-2 text-body text-charcoal/60">You're caught up.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-5 rounded-xl bg-forest px-4 py-2.5 text-body font-semibold text-cream"
          >
            Back to dashboard
          </button>
        </div>
      </ReviewChrome>
    );
  }

  if (state.phase === 'COMPLETE') {
    return <SessionSummary results={state.results} onExit={() => navigate('/')} />;
  }

  const conceptName = sessionQ.data?.conceptName ?? current?.conceptName ?? 'Review';
  const assessing = state.phase === 'SUBMITTING';
  const assessed = state.phase === 'ASSESSED';

  return (
    <ReviewChrome>
      <ProgressIndicator
        index={state.index}
        total={total}
        conceptName={conceptName}
        onExit={handleExit}
      />

      <div className="mt-8 flex-1">
        <p className="eyebrow">Prompt</p>
        <div className="mt-2 font-display text-h2 leading-snug text-charcoal">{current?.prompt}</div>

        <div className="mt-7">
          <label htmlFor="recall-answer" className="eyebrow">
            Your recall
          </label>
          <textarea
            id="recall-answer"
            ref={answerRef}
            value={state.draft}
            disabled={assessing || assessed}
            onChange={(e) => dispatch({ type: 'EDIT', draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Answer in your own words…"
            rows={5}
            className="mt-2 w-full resize-none rounded-xl border border-forest/15 bg-paper p-4 text-body-lg leading-relaxed text-charcoal outline-none transition-colors duration-fast focus:border-moss disabled:opacity-70"
            style={{ background: '#FBF9F3' }}
          />
          {state.error && (
            <p className="mt-2 text-caption text-clay">
              Assessment failed — your answer is preserved. Try submitting again.
            </p>
          )}
        </div>

        {!assessed && (
          <div className="mt-4 flex items-center justify-between">
            <span className="font-mono text-[11px] text-charcoal/40">⌘/Ctrl + Enter to submit</span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!state.draft.trim() || assessing}
              className="rounded-xl bg-forest px-5 py-2.5 text-body font-semibold text-cream transition-colors duration-fast hover:bg-forest/90 disabled:opacity-40"
            >
              {assessing ? 'Assessing your answer…' : 'Submit'}
            </button>
          </div>
        )}

        {assessed && state.outcome && (
          <AssessmentReveal
            outcome={state.outcome}
            isLast={state.index + 1 >= total}
            onContinue={handleContinue}
            continueRef={continueRef}
          />
        )}
      </div>
    </ReviewChrome>
  );
}

function ProgressIndicator({
  index,
  total,
  conceptName,
  onExit,
}: {
  index: number;
  total: number;
  conceptName: string;
  onExit: () => void;
}) {
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/55">
          Recall · {index + 1} / {total}
          <span className="ml-2 text-charcoal/35">{conceptName}</span>
        </span>
        <button
          type="button"
          onClick={onExit}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-charcoal/45 transition-colors duration-fast hover:text-charcoal"
        >
          ✕ Exit
        </button>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-forest/10">
        <div
          className="h-full rounded-full bg-moss transition-[width] duration-normal"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// The assessment bar is a READ-ONLY outcome. The only actionable element is
// Continue; there is no scoring control (agent-rules: no self-grading).
function AssessmentReveal({
  outcome,
  isLast,
  onContinue,
  continueRef,
}: {
  outcome: AssessResult;
  isLast: boolean;
  onContinue: () => void;
  continueRef: React.RefObject<HTMLButtonElement>;
}) {
  return (
    <div className="card-reveal mt-7">
      {outcome.modelAnswer && (
        <div className="surface-paper p-5">
          <p className="eyebrow">Model answer</p>
          <div className="mt-2 overflow-x-auto">
            <Tex display tex={outcome.modelAnswer} className="text-charcoal" />
          </div>
        </div>
      )}

      <div className="surface-glass mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <HeatDot state={outcome.heatState} showLabel={false} />
            <span className="text-body-lg font-semibold text-charcoal">{outcome.label}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-charcoal/45">
              AI-assessed · score {outcome.score}
            </span>
          </span>
          <span className="font-mono text-caption text-charcoal/55">
            next review · in {Math.max(1, Math.round(outcome.nextIntervalDays))} day
            {Math.round(outcome.nextIntervalDays) === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-3 text-body leading-relaxed text-charcoal/80">{outcome.rationale}</p>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          ref={continueRef}
          type="button"
          onClick={onContinue}
          className="rounded-xl bg-forest px-5 py-2.5 text-body font-semibold text-cream transition-colors duration-fast hover:bg-forest/90"
        >
          {isLast ? 'Finish →' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}

function SessionSummary({ results, onExit }: { results: AssessResult[]; onExit: () => void }) {
  const avg =
    results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  return (
    <ReviewChrome>
      <div className="m-auto max-w-sm text-center">
        <p className="eyebrow">Session complete</p>
        <h1 className="mt-2 font-display text-display text-charcoal">
          {results.length} concept{results.length === 1 ? '' : 's'} reviewed
        </h1>
        <p className="mt-2 text-body text-charcoal/60">
          Average score {avg.toFixed(1)} / 3. Your schedule and mastery are updated.
        </p>
        <ul className="mt-5 space-y-1.5 text-left">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-body">
              <HeatDot state={r.heatState} showLabel={false} />
              <span className="text-charcoal/80">{r.label}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onExit}
          className="mt-6 rounded-xl bg-forest px-5 py-2.5 text-body font-semibold text-cream"
        >
          Back to dashboard
        </button>
      </div>
    </ReviewChrome>
  );
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, stubFetchByPath } from '../../test/utils';
import { ConceptPage } from '../concept/ConceptPage';
import { GraphPage } from '../graph/GraphPage';
import { ReviewSession } from '../review/ReviewSession';

const prefs = (modes: Record<string, string>) => ({
  modes: { concept: 'default', graph: 'default', review: 'default', ...modes },
});

const CONCEPT = {
  conceptId: 'c1',
  name: 'Eigenvector',
  subject: 'Linear Algebra',
  breadcrumb: 'Linear Algebra',
  importance: 4,
  mastery: 0.68,
  retention: 0.61,
  recallAccuracy: 0.74,
  problemAccuracy: 0.5,
  heatState: 'warm',
  reviewCount: 5,
  dueAt: null,
  intuition: 'A direction left unchanged, only scaled, by the transformation.',
  definition: 'A\\mathbf{v}=\\lambda\\mathbf{v}',
  notes: '',
  vizSpec: null,
};

const CONCEPT_SATELLITES = {
  '/recall': { dueCount: 0, items: [] },
  '/dependencies': [],
  '/insight': { summary: 'Keep practicing.', suggestedConceptId: null, cta: 'Practice recall' },
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderConcept() {
  return renderWithProviders(
    <Routes>
      <Route path="/concepts/:conceptId" element={<ConceptPage />} />
    </Routes>,
    { route: '/concepts/c1' },
  );
}

describe('Concept focus mode', () => {
  it('keeps the visualization mounted and moves the body into an L3 drawer', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({
        '/preferences': prefs({ concept: 'focus' }),
        ...CONCEPT_SATELLITES,
        'concepts/c1': CONCEPT,
      }),
    );
    renderConcept();

    // The visualization is ALWAYS present — focus mode must never tab-gate it.
    expect(await screen.findByLabelText('Concept visualization')).toBeInTheDocument();

    // Once focus mode resolves, the body collapses behind a drawer trigger…
    const open = await screen.findByRole('button', { name: /Open notes/i });
    expect(screen.queryByText('Intuition')).not.toBeInTheDocument();

    // …and opening the drawer reveals the same body cards (same data bindings).
    fireEvent.click(open);
    expect(await screen.findByRole('dialog', { name: 'Concept details' })).toBeInTheDocument();
    expect(await screen.findByText('Intuition')).toBeInTheDocument();
  });

  it('default mode renders the body inline with no drawer', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({
        '/preferences': prefs({}),
        ...CONCEPT_SATELLITES,
        'concepts/c1': CONCEPT,
      }),
    );
    renderConcept();

    expect(await screen.findByText('Intuition')).toBeInTheDocument();
    expect(screen.getByLabelText('Concept visualization')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open notes/i })).not.toBeInTheDocument();
  });
});

describe('Graph immersive mode', () => {
  const graphData = {
    '/subjects': [{ id: 's1', name: 'Linear Algebra' }],
    '/layout': [],
    '/nodes': [{ conceptId: 'a', name: 'Vectors', importance: 5, heatState: 'mastered', mastery: 0.9 }],
    '/edges': [],
  };

  it('drops the page header and floats the controls full-bleed', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({ '/preferences': prefs({ graph: 'immersive' }), ...graphData }),
    );
    renderWithProviders(<GraphPage />, { route: '/graph' });

    // canvas + its floating controls still render…
    expect(await screen.findByLabelText('Search concepts')).toBeInTheDocument();
    const sw = await screen.findByRole('switch', { name: 'Immersive mode' });
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));
    // …but the page chrome ("Knowledge Graph" heading) is gone in immersive mode.
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Knowledge Graph' })).not.toBeInTheDocument(),
    );
  });
});

describe('Review tutor tone', () => {
  const SINGLE = {
    sessionId: 's1',
    total: 1,
    conceptName: 'Eigenvector',
    items: [
      { itemId: 'i1', conceptId: 'c1', conceptName: 'Eigenvector', prompt: 'What makes a vector an eigenvector?' },
    ],
  };
  const OUTCOME = {
    score: 2,
    label: 'Mostly correct',
    rationale: 'Captured the core idea.',
    nextIntervalDays: 4,
    heatState: 'hot',
    modelAnswer: 'A\\mathbf{v} = \\lambda\\mathbf{v}',
  };

  it('warms the microcopy while keeping the score AI-assigned and read-only', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({
        '/preferences': prefs({ review: 'tutor' }),
        '/assess': OUTCOME,
        'review/s1': SINGLE,
      }),
    );
    renderWithProviders(
      <Routes>
        <Route path="/review/:sessionId" element={<ReviewSession />} />
      </Routes>,
      { route: '/review/s1' },
    );

    expect(await screen.findByText('What makes a vector an eigenvector?')).toBeInTheDocument();
    // tutor microcopy
    const area = await screen.findByLabelText('In your own words');
    expect(screen.getByRole('button', { name: 'Share my answer' })).toBeInTheDocument();

    // there is NO score-selection control anywhere (no self-grading invariant)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    fireEvent.change(area, { target: { value: 'a direction only scaled by lambda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share my answer' }));

    // score is still shown read-only, attributed to the (AI) tutor
    expect(await screen.findByText('Mostly correct')).toBeInTheDocument();
    expect(screen.getByText(/Your tutor · score 2/)).toBeInTheDocument();
    expect(screen.getByText('Mostly correct').closest('button')).toBeNull();
  });
});

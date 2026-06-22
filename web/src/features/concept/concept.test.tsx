import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, stubFetchByPath } from '../../test/utils';
import { ConceptHeader } from './ConceptHeader';
import { ConceptMetricsBar } from './ConceptMetricsBar';
import { VisualizationPanel } from './VisualizationPanel';
import { LeftColumn } from './LeftColumn';
import { RightColumn } from './RightColumn';
import { ConceptPage } from './ConceptPage';
import type { ConceptDetail, VizSpec } from './types';

const EIGEN_SPEC: VizSpec = {
  kind: 'eigen',
  showGuides: true,
  presets: [
    { key: 'symmetric', label: '\\begin{bmatrix}2&1\\\\1&2\\end{bmatrix}', m: [[2, 1], [1, 2]], eigs: [{ val: 3, d: [0.70711, 0.70711] }, { val: 1, d: [0.70711, -0.70711] }] },
    { key: 'stretch', label: '\\begin{bmatrix}2&0\\\\0&0.5\\end{bmatrix}', m: [[2, 0], [0, 0.5]], eigs: [{ val: 2, d: [1, 0] }, { val: 0.5, d: [0, 1] }] },
  ],
};

function makeDetail(overrides: Partial<ConceptDetail> = {}): ConceptDetail {
  return {
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
    dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    intuition: 'A direction left unchanged, only scaled, by the transformation.',
    definition: 'A\\mathbf{v} = \\lambda\\mathbf{v}',
    notes: 'Symmetric matrices have orthogonal eigenvectors.',
    vizSpec: EIGEN_SPEC,
    ...overrides,
  };
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('ConceptHeader', () => {
  it('shows breadcrumb, title, heat, mastery and the due label', () => {
    renderWithProviders(<ConceptHeader detail={makeDetail()} />);
    expect(screen.getByRole('heading', { name: 'Eigenvector' })).toBeInTheDocument();
    expect(screen.getByText('Warm')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText(/Next review in 2 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice recall' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in graph' })).toBeInTheDocument();
  });
});

describe('ConceptMetricsBar', () => {
  it('renders four stat cards from the projection', () => {
    renderWithProviders(<ConceptMetricsBar detail={makeDetail()} />);
    expect(screen.getByText('Mastery')).toBeInTheDocument();
    expect(screen.getByText('Retention')).toBeInTheDocument();
    expect(screen.getByText('Recall accuracy')).toBeInTheDocument();
    expect(screen.getByText('Problem accuracy')).toBeInTheDocument();
  });

  it('teaches an empty state before any reviews', () => {
    renderWithProviders(<ConceptMetricsBar detail={makeDetail({ reviewCount: 0 })} />);
    expect(screen.getByText(/practice recall to start tracking mastery/i)).toBeInTheDocument();
  });
});

describe('VisualizationPanel', () => {
  it('is always rendered (never tab-gated) and snaps Av parallel on align', () => {
    renderWithProviders(<VisualizationPanel vizSpec={EIGEN_SPEC} />);
    expect(screen.getByLabelText('Concept visualization')).toBeInTheDocument();
    expect(screen.getByTestId('viz-status')).toHaveTextContent(/Drag the tip onto a dashed guide/);
    fireEvent.click(screen.getByRole('button', { name: 'Align to λ = 3' }));
    expect(screen.getByTestId('viz-status')).toHaveTextContent(/lies on an eigen-direction/);
  });

  it('switches matrix presets', () => {
    renderWithProviders(<VisualizationPanel vizSpec={EIGEN_SPEC} />);
    fireEvent.click(screen.getByRole('button', { name: 'stretch' }));
    // stretch preset has an eigenvalue of 0.5
    expect(screen.getByRole('button', { name: 'Align to λ = 0.5' })).toBeInTheDocument();
  });

  it('falls back to a static frame when there is no viz spec', () => {
    renderWithProviders(<VisualizationPanel vizSpec={null} />);
    expect(screen.getByText(/visualization coming soon/i)).toBeInTheDocument();
  });
});

describe('LeftColumn', () => {
  it('renders intuition prose and a KaTeX-typeset definition', () => {
    const { container } = renderWithProviders(<LeftColumn detail={makeDetail()} />);
    expect(screen.getByText(/direction left unchanged/i)).toBeInTheDocument();
    expect(container.querySelector('.katex')).not.toBeNull(); // KaTeX, not an image
  });
});

describe('RightColumn', () => {
  const ok = () =>
    stubFetchByPath({
      '/recall': { dueCount: 1, items: [{ prompt: 'Define an eigenvector', lastScore: 2, heatState: 'hot' }] },
      '/dependencies': [{ conceptId: 'd1', name: 'Matrix', heatState: 'cold', mastery: 0.2, isRootWeakness: true }],
      '/insight': { summary: 'Recall is strong, but problem accuracy trails.', suggestedConceptId: 'd1', cta: 'Review Matrix' },
    });

  it('shows recall items, problem accuracy, root-weakness deps and the AI insight', async () => {
    vi.stubGlobal('fetch', ok());
    renderWithProviders(<RightColumn conceptId="c1" detail={makeDetail()} />);

    expect(await screen.findByText('Define an eigenvector')).toBeInTheDocument();
    expect(screen.getByText('Mostly')).toBeInTheDocument(); // score 2 label
    expect(screen.getByText('due now')).toBeInTheDocument();

    expect(screen.getByText('50')).toBeInTheDocument(); // problem accuracy %

    const depLink = await screen.findByRole('link', { name: /Matrix/ });
    expect(depLink).toHaveAttribute('href', '/concepts/d1');
    expect(screen.getByText('root weakness')).toBeInTheDocument();

    expect(await screen.findByText(/problem accuracy trails/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review Matrix/ })).toBeInTheDocument();
  });

  it('renders an inline error in the insight card when the model call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/insight')) return new Response('boom', { status: 500 });
        if (url.includes('/recall')) return new Response(JSON.stringify({ dueCount: 0, items: [] }), { status: 200 });
        if (url.includes('/dependencies')) return new Response('[]', { status: 200 });
        return new Response('{}', { status: 200 });
      }),
    );
    renderWithProviders(<RightColumn conceptId="c1" detail={makeDetail()} />);
    // the insight query retries once (retry: 1), so allow for the backoff
    expect(await screen.findByText(/Couldn't generate an insight/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('ConceptPage integration', () => {
  it('renders header, metrics, visualization and all body cards from queries', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({
        '/recall': { dueCount: 0, items: [] },
        '/dependencies': [{ conceptId: 'd1', name: 'Matrix', heatState: 'cold', mastery: 0.2, isRootWeakness: true }],
        '/insight': { summary: 'Keep practicing to deepen retention.', suggestedConceptId: null, cta: 'Practice recall' },
        'concepts/c1': makeDetail(),
      }),
    );
    renderWithProviders(
      <Routes>
        <Route path="/concepts/:conceptId" element={<ConceptPage />} />
      </Routes>,
      { route: '/concepts/c1' },
    );

    expect(await screen.findByRole('heading', { name: 'Eigenvector' })).toBeInTheDocument();
    expect(screen.getByLabelText('Concept visualization')).toBeInTheDocument();
    expect(screen.getByText('Intuition')).toBeInTheDocument();
    expect(screen.getByText('Definition')).toBeInTheDocument();
    expect(await screen.findByText(/caught up on this concept/i)).toBeInTheDocument();
  });

  it('shows a full-page error when the core concept query fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    renderWithProviders(
      <Routes>
        <Route path="/concepts/:conceptId" element={<ConceptPage />} />
      </Routes>,
      { route: '/concepts/c1' },
    );
    expect(await screen.findByText(/Couldn't load this concept/i)).toBeInTheDocument();
  });
});

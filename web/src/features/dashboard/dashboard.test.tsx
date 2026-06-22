import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, stubFetchByPath } from '../../test/utils';
import { DueReviewsHero } from './DueReviewsHero';
import { WeakConcepts } from './WeakConcepts';
import { RetentionTrends } from './RetentionTrends';
import { LearningHealth } from './LearningHealth';
import { KnowledgeHeatMap } from './KnowledgeHeatMap';
import { SubjectProgress } from './SubjectProgress';
import { DashboardPage } from './DashboardPage';

function setFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', impl);
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('DueReviewsHero', () => {
  it('shows the total, subject count and overdue/today pills', async () => {
    setFetch(stubFetchByPath({ 'due-summary': { total: 18, overdue: 7, dueToday: 11, subjects: 3 } }));
    renderWithProviders(<DueReviewsHero />);
    expect(await screen.findByText('18')).toBeInTheDocument();
    expect(screen.getByText(/across 3 subjects/)).toBeInTheDocument();
    expect(screen.getByText('7 overdue')).toBeInTheDocument();
    expect(screen.getByText('11 due today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Begin review/ })).toBeInTheDocument();
  });

  it('teaches an empty state when nothing is due', async () => {
    setFetch(stubFetchByPath({ 'due-summary': { total: 0, overdue: 0, dueToday: 0, subjects: 0 } }));
    renderWithProviders(<DueReviewsHero />);
    expect(await screen.findByText(/your schedule is clear/i)).toBeInTheDocument();
  });

  it('renders an inline error with a Retry that refetches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('due-summary')) return new Response('boom', { status: 500 });
      return new Response('[]', { status: 200 });
    });
    setFetch(fetchMock);
    renderWithProviders(<DueReviewsHero />);
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});

describe('WeakConcepts', () => {
  const rows = [
    { conceptId: 'c1', name: 'Characteristic polynomial', subject: 'Linear Algebra', mastery: 0.18, heatState: 'frozen' },
    { conceptId: 'c2', name: 'SVD', subject: 'Linear Algebra', mastery: 0.2, heatState: 'frozen' },
  ];

  it('lists concepts with percent and a visible heat label (never color alone)', async () => {
    setFetch(stubFetchByPath({ '/concepts/weak': rows }));
    renderWithProviders(<WeakConcepts />);
    expect(await screen.findByText('Characteristic polynomial')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument();
    expect(screen.getAllByText('Frozen').length).toBe(2); // label present per row
  });

  it('links each row to its concept page', async () => {
    setFetch(stubFetchByPath({ '/concepts/weak': rows }));
    renderWithProviders(<WeakConcepts />);
    const link = await screen.findByRole('link', { name: /Characteristic polynomial/ });
    expect(link).toHaveAttribute('href', '/concepts/c1');
  });

  it('shows a loading skeleton before data arrives', () => {
    setFetch(vi.fn(() => new Promise<Response>(() => {})));
    const { container } = renderWithProviders(<WeakConcepts />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('teaches an empty state', async () => {
    setFetch(stubFetchByPath({ '/concepts/weak': [] }));
    renderWithProviders(<WeakConcepts />);
    expect(await screen.findByText(/Start reviewing to surface/i)).toBeInTheDocument();
  });
});

describe('RetentionTrends', () => {
  const data = {
    points: [0.4, 0.55, 0.7],
    reviews: [
      { day: '2026-05-30', count: 2 },
      { day: '2026-05-31', count: 1 },
      { day: '2026-06-01', count: 3 },
    ],
  };

  it('shows the latest retention and updates on hover', async () => {
    setFetch(stubFetchByPath({ retention: data }));
    renderWithProviders(<RetentionTrends />);
    expect(await screen.findByText('70%')).toBeInTheDocument(); // last point by default
    fireEvent.mouseEnter(screen.getByTestId('retention-seg-0'));
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('teaches an empty state when there is no retention yet', async () => {
    setFetch(stubFetchByPath({ retention: { points: [0, 0], reviews: [] } }));
    renderWithProviders(<RetentionTrends />);
    expect(await screen.findByText(/Trends appear after/i)).toBeInTheDocument();
  });
});

describe('LearningHealth', () => {
  it('renders the mastery ring and retention stat', async () => {
    setFetch(
      stubFetchByPath({
        health: { avgMastery: 0.61, retention: 0.74, retentionDelta: 0.04, tracked: 12, subjects: 3 },
      }),
    );
    renderWithProviders(<LearningHealth />);
    expect(await screen.findByText('61')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
    expect(screen.getByText('+4%')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('teaches an empty state when nothing is tracked', async () => {
    setFetch(
      stubFetchByPath({
        health: { avgMastery: 0, retention: 0, retentionDelta: 0, tracked: 0, subjects: 0 },
      }),
    );
    renderWithProviders(<LearningHealth />);
    expect(await screen.findByText(/Add your first concept/i)).toBeInTheDocument();
  });
});

describe('KnowledgeHeatMap', () => {
  const data = [
    {
      subject: 'Linear Algebra',
      cells: [
        { conceptId: 'a', name: 'Vectors', heatState: 'mastered', mastery: 0.92 },
        { conceptId: 'b', name: 'SVD', heatState: 'frozen', mastery: 0.2 },
      ],
    },
  ];

  it('renders cells with a heat-labelled accessible name and reveals it on hover', async () => {
    setFetch(stubFetchByPath({ heatmap: data }));
    renderWithProviders(<KnowledgeHeatMap />);
    const cell = await screen.findByLabelText(/Vectors · Mastered \(92%\)/);
    expect(cell).toHaveAttribute('href', '/concepts/a');
    fireEvent.mouseEnter(cell);
    expect(screen.getAllByText(/Vectors · Mastered \(92%\)/).length).toBeGreaterThan(0);
  });

  it('teaches an empty state', async () => {
    setFetch(stubFetchByPath({ heatmap: [] }));
    renderWithProviders(<KnowledgeHeatMap />);
    expect(await screen.findByText(/Create concepts to build/i)).toBeInTheDocument();
  });
});

describe('SubjectProgress', () => {
  it('renders a labelled progress bar per subject', async () => {
    setFetch(
      stubFetchByPath({
        progress: [{ subjectId: 's1', name: 'Linear Algebra', avgMastery: 0.68, heatState: 'warm' }],
      }),
    );
    renderWithProviders(<SubjectProgress />);
    const bar = await screen.findByRole('progressbar', { name: /Linear Algebra mastery/ });
    expect(bar).toHaveAttribute('aria-valuenow', '68');
    expect(screen.getByText('68%')).toBeInTheDocument();
    expect(screen.getByText('Warm')).toBeInTheDocument();
  });

  it('teaches an empty state', async () => {
    setFetch(stubFetchByPath({ progress: [] }));
    renderWithProviders(<SubjectProgress />);
    expect(await screen.findByText(/No subjects yet/i)).toBeInTheDocument();
  });
});

describe('DashboardPage integration', () => {
  it('renders all six cards from projection queries', async () => {
    setFetch(
      stubFetchByPath({
        'due-summary': { total: 18, overdue: 7, dueToday: 11, subjects: 3 },
        '/concepts/weak': [
          { conceptId: 'c1', name: 'SVD', subject: 'Linear Algebra', mastery: 0.2, heatState: 'frozen' },
        ],
        retention: { points: [0.4, 0.7], reviews: [{ day: '2026-05-31', count: 1 }, { day: '2026-06-01', count: 2 }] },
        health: { avgMastery: 0.61, retention: 0.74, retentionDelta: 0.04, tracked: 12, subjects: 3 },
        heatmap: [{ subject: 'Linear Algebra', cells: [{ conceptId: 'a', name: 'Vectors', heatState: 'mastered', mastery: 0.92 }] }],
        progress: [{ subjectId: 's1', name: 'Linear Algebra', avgMastery: 0.68, heatState: 'warm' }],
      }),
    );
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('18')).toBeInTheDocument();
    expect(screen.getByText('Weakest concepts')).toBeInTheDocument();
    expect(screen.getByText('Retention trend')).toBeInTheDocument();
    expect(screen.getByText('Learning health')).toBeInTheDocument();
    expect(screen.getByText('Knowledge heat')).toBeInTheDocument();
    expect(screen.getByText('Subject progress')).toBeInTheDocument();
  });
});

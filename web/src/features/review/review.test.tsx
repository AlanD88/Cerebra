import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, stubFetchByPath } from '../../test/utils';
import { ReviewSession } from './ReviewSession';

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
  rationale: 'Captured the core idea; state the relationship to reach Perfect.',
  nextIntervalDays: 4,
  heatState: 'hot',
  modelAnswer: 'A\\mathbf{v} = \\lambda\\mathbf{v}',
};

function renderSession() {
  return renderWithProviders(
    <Routes>
      <Route path="/review/:sessionId" element={<ReviewSession />} />
    </Routes>,
    { route: '/review/s1' },
  );
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('ReviewSession', () => {
  it('shows a loading state while preparing', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    renderSession();
    expect(screen.getByText(/Preparing your session/i)).toBeInTheDocument();
  });

  it('teaches the empty-queue state', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({ 'review/s1': { sessionId: 's1', total: 0, conceptName: null, items: [] } }),
    );
    renderSession();
    expect(await screen.findByText(/Nothing due right now/i)).toBeInTheDocument();
  });

  it('runs prompt → submit → read-only assessment → finish', async () => {
    vi.stubGlobal('fetch', stubFetchByPath({ '/assess': OUTCOME, 'review/s1': SINGLE }));
    renderSession();

    expect(await screen.findByText('What makes a vector an eigenvector?')).toBeInTheDocument();
    expect(screen.getByText('Recall · 1 / 1')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Your recall'), {
      target: { value: 'A direction left unchanged, only scaled by lambda.' },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    // read-only outcome
    expect(await screen.findByText('Mostly correct')).toBeInTheDocument();
    expect(screen.getByText(/AI-assessed · score 2/)).toBeInTheDocument();
    expect(screen.getByText(/next review · in 4 days/)).toBeInTheDocument();
    expect(screen.getByText(/Captured the core idea/)).toBeInTheDocument();

    // the score is shown, never as a control
    expect(screen.getByText('Mostly correct').closest('button')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(await screen.findByText(/1 concept reviewed/i)).toBeInTheDocument();
  });

  it('submits with Cmd/Ctrl+Enter', async () => {
    vi.stubGlobal('fetch', stubFetchByPath({ '/assess': OUTCOME, 'review/s1': SINGLE }));
    renderSession();

    const area = await screen.findByLabelText('Your recall');
    fireEvent.change(area, { target: { value: 'eigen direction scaled' } });
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });

    expect(await screen.findByText('Mostly correct')).toBeInTheDocument();
  });

  it('preserves the answer and returns to ANSWERING when assessment fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/assess')) return new Response('boom', { status: 500 });
        return new Response(JSON.stringify(SINGLE), { status: 200 });
      }),
    );
    renderSession();

    const area = (await screen.findByLabelText('Your recall')) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'my preserved answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/Assessment failed/i)).toBeInTheDocument();
    expect(area.value).toBe('my preserved answer'); // never lose the learner's text
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('advances through a multi-item queue on Continue', async () => {
    const two = {
      sessionId: 's1',
      total: 2,
      conceptName: null,
      items: [
        { itemId: 'i1', conceptId: 'c1', conceptName: 'Vectors', prompt: 'First prompt?' },
        { itemId: 'i2', conceptId: 'c2', conceptName: 'Matrix', prompt: 'Second prompt?' },
      ],
    };
    vi.stubGlobal('fetch', stubFetchByPath({ '/assess': OUTCOME, 'review/s1': two }));
    renderSession();

    expect(await screen.findByText('First prompt?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your recall'), { target: { value: 'answer one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByText('Mostly correct');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    await waitFor(() => expect(screen.getByText('Second prompt?')).toBeInTheDocument());
    expect(screen.getByText('Recall · 2 / 2')).toBeInTheDocument();
  });
});

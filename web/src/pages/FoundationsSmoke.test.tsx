import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { FoundationsSmoke, type SmokeMetric } from './FoundationsSmoke';
import { renderWithClient } from '../test/utils';

const SAMPLE: SmokeMetric[] = [
  { concept_id: 'a', name: 'Vectors', mastery: 0.92, heat_state: 'mastered' },
  { concept_id: 'b', name: 'Eigenvector', mastery: 0.41, heat_state: 'cold' },
];

describe('FoundationsSmoke', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(impl: () => Promise<Response>) {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(impl);
  }

  it('renders projection rows with name, mastery percent and heat label', async () => {
    mockFetch(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    renderWithClient(<FoundationsSmoke />);

    expect(await screen.findByText('Vectors')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Eigenvector')).toBeInTheDocument();
    expect(screen.getByText('Cold')).toBeInTheDocument();
  });

  it('queries the projection endpoint, not a raw-event endpoint', async () => {
    mockFetch(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    renderWithClient(<FoundationsSmoke />);

    await screen.findByText('Vectors');
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/_smoke/metrics');
  });

  it('teaches an empty state when there are no concepts', async () => {
    mockFetch(async () => new Response(JSON.stringify([]), { status: 200 }));
    renderWithClient(<FoundationsSmoke />);

    expect(await screen.findByText(/Seed a subject/i)).toBeInTheDocument();
  });

  it('surfaces an error state when the API is unreachable', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }));
    renderWithClient(<FoundationsSmoke />);

    await waitFor(() =>
      expect(screen.getByText(/Could not reach the projection API/i)).toBeInTheDocument(),
    );
  });
});

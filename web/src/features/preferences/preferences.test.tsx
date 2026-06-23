import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { ModeToggle } from '../../components/ModeToggle';

const tick = () => new Promise((r) => setTimeout(r, 5));

// A stateful preferences server: GET returns current modes, PATCH merges + echoes.
// PATCH is deferred a tick so the optimistic (pre-server) state is observable.
function statefulPrefsFetch(initial?: Record<string, string>) {
  let modes = { concept: 'default', graph: 'default', review: 'default', ...initial };
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'PATCH') {
      await tick();
      const body = JSON.parse(init!.body as string) as { modes: Record<string, string> };
      modes = { ...modes, ...body.modes };
    }
    return new Response(JSON.stringify({ modes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('ModeToggle + useMode', () => {
  it('starts off (default mode) and is announced as a switch', async () => {
    vi.stubGlobal('fetch', statefulPrefsFetch());
    renderWithProviders(<ModeToggle surface="concept" />);
    const sw = await screen.findByRole('switch', { name: 'Focus mode' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('flips optimistically and persists the new mode via PATCH', async () => {
    const fetchMock = statefulPrefsFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ModeToggle surface="concept" />);

    const sw = await screen.findByRole('switch', { name: 'Focus mode' });
    fireEvent.click(sw);
    // optimistic flip lands before the deferred PATCH resolves
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/preferences'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    // server echoed focus, so it stays on after reconciliation
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('rolls back when the write fails', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PATCH') {
        await tick();
        return new Response('boom', { status: 500 });
      }
      return new Response(
        JSON.stringify({ modes: { concept: 'default', graph: 'default', review: 'default' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ModeToggle surface="graph" />);

    const sw = await screen.findByRole('switch', { name: 'Immersive mode' });
    fireEvent.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true')); // optimistic
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false')); // rolled back
  });

  it('reflects a stored non-default mode from the server', async () => {
    vi.stubGlobal('fetch', statefulPrefsFetch({ concept: 'focus' }));
    renderWithProviders(<ModeToggle surface="concept" />);
    const sw = await screen.findByRole('switch', { name: 'Focus mode' });
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));
  });
});

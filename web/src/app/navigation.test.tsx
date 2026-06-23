import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { makeTestQueryClient, stubFetchByPath } from '../test/utils';
import { routes } from './router';

// Mounts the REAL route tree at a given path — the regression guard for the
// sidebar destinations that previously had no route and threw a 404 error.
function renderAt(path: string) {
  const client = makeTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const noModes = { modes: { concept: 'default', graph: 'default', review: 'default' } };

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('sidebar navigation routes resolve', () => {
  it('/subjects renders the Subjects page (was a 404 error)', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetchByPath({
        '/subjects/progress': [
          { subjectId: 's1', name: 'Linear Algebra', avgMastery: 0.62, heatState: 'warm' },
        ],
      }),
    );
    renderAt('/subjects');

    expect(await screen.findByRole('heading', { name: 'Subjects' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: /Linear Algebra/ });
    expect(link).toHaveAttribute('href', '/graph/s1');
  });

  it('/settings renders the Settings page with all three mode toggles (was a 404 error)', async () => {
    vi.stubGlobal('fetch', stubFetchByPath({ '/preferences': noModes }));
    renderAt('/settings');

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: 'Focus mode' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Immersive mode' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Tutor mode' })).toBeInTheDocument();
  });

  it('an unknown in-shell path renders the calm 404, not a raw error', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

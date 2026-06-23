import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { NotFound } from './NotFound';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { SubjectsPage } from '../features/subjects/SubjectsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

// Exported so tests can mount the real route tree via createMemoryRouter.
// The Dashboard, Subjects and Settings surfaces are eager (light, no heavy deps).
// The Concept Page (KaTeX) and Knowledge Graph (React Flow) are the heavy bundles,
// and Review pulls KaTeX too, so they are code-split per route — the Dashboard
// never pays for them (polish-frontend §4). `lazy` awaits the chunk before render.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'subjects', element: <SubjectsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        path: 'concepts/:conceptId',
        lazy: async () => ({ Component: (await import('../features/concept/ConceptPage')).ConceptPage }),
      },
      {
        path: 'graph',
        lazy: async () => ({ Component: (await import('../features/graph/GraphPage')).GraphPage }),
      },
      {
        path: 'graph/:subjectId',
        lazy: async () => ({ Component: (await import('../features/graph/GraphPage')).GraphPage }),
      },
      // Any other in-shell path degrades to a calm 404 instead of an error screen.
      { path: '*', element: <NotFound /> },
    ],
  },
  // Review renders OUTSIDE the AppShell (full-screen, no sidebar).
  {
    path: '/review',
    lazy: async () => ({ Component: (await import('../features/review/ReviewLauncher')).ReviewLauncher }),
  },
  {
    path: '/review/:sessionId',
    lazy: async () => ({ Component: (await import('../features/review/ReviewSession')).ReviewSession }),
  },
];

export const router = createBrowserRouter(routes);

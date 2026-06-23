import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';

// The Dashboard is eager (the landing surface). The Concept Page (KaTeX) and
// Knowledge Graph (React Flow) are the heavy bundles, and Review pulls KaTeX too,
// so they are code-split per route — the Dashboard never pays for them
// (polish-frontend §4). React Router's `lazy` awaits the chunk before rendering.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
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
]);

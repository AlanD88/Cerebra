import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ConceptPage } from '../features/concept/ConceptPage';
import { ReviewLauncher } from '../features/review/ReviewLauncher';
import { ReviewSession } from '../features/review/ReviewSession';
import { GraphPage } from '../features/graph/GraphPage';

// Review renders OUTSIDE the AppShell (full-screen, no sidebar).
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'concepts/:conceptId', element: <ConceptPage /> },
      { path: 'graph', element: <GraphPage /> },
      { path: 'graph/:subjectId', element: <GraphPage /> },
    ],
  },
  { path: '/review', element: <ReviewLauncher /> },
  { path: '/review/:sessionId', element: <ReviewSession /> },
]);

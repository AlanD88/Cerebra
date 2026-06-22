import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ConceptPage } from '../features/concept/ConceptPage';

// Routes grow phase-by-phase. Review (Phase 4) renders OUTSIDE the AppShell.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'concepts/:conceptId', element: <ConceptPage /> },
    ],
  },
]);

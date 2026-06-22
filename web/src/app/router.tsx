import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';

// Routes grow phase-by-phase. Review (Phase 4) renders OUTSIDE the AppShell.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
]);

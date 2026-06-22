import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { FoundationsSmoke } from '../pages/FoundationsSmoke';

// Routes grow phase-by-phase. Review (Phase 4) renders OUTSIDE the AppShell.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [{ index: true, element: <FoundationsSmoke /> }],
  },
]);

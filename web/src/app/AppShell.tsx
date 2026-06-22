import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

/**
 * Global shell: 52px Forest sidebar (fixed, hover-expand, overlays so content
 * does not shift) + Cream L0 canvas with 1400px centered content.
 * Present on every surface except Review.
 */
export function AppShell() {
  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <Sidebar />
      <div className="pl-[52px]">
        <main className="mx-auto w-full max-w-content px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

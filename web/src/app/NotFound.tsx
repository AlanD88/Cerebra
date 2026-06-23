import { Link } from 'react-router-dom';

// Rendered inside the AppShell for any unmatched path, so a stray link degrades
// to a calm, navigable page instead of React Router's raw error screen.
export function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/45">404</p>
      <h1 className="mt-2 font-display text-h1 text-charcoal">Page not found</h1>
      <p className="mt-2 text-body text-charcoal/60">That page doesn't exist yet.</p>
      <Link to="/" className="mt-4 inline-block text-body font-semibold text-forest underline">
        Back to dashboard
      </Link>
    </div>
  );
}

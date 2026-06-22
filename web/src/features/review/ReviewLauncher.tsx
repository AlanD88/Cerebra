import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { ErrorState } from '../../components/feedback';
import type { ReviewSessionDto } from './types';

/**
 * Bootstraps a review session, then redirects to /review/:sessionId. A due
 * session by default, or a single-concept session via ?concept=:id (the Concept
 * Page "Practice recall" action). Renders outside the AppShell.
 */
export function ReviewLauncher() {
  const [params] = useSearchParams();
  const conceptId = params.get('concept');
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (started.current) return; // guard StrictMode double-invoke
    started.current = true;
    api
      .post<ReviewSessionDto>('/review/sessions', conceptId ? { conceptId } : {})
      .then((s) => navigate(`/review/${s.sessionId}`, { replace: true }))
      .catch(() => setError(true));
  }, [conceptId, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      {error ? (
        <div className="max-w-sm">
          <ErrorState onRetry={() => window.location.reload()} message="Couldn't start a session." />
        </div>
      ) : (
        <p className="text-body text-charcoal/60">Preparing your session…</p>
      )}
    </div>
  );
}

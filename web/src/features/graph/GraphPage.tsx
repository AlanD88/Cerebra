import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState, Skeleton } from '../../components/feedback';
import { GraphCanvas } from './GraphCanvas';
import { graphQueries } from './queries';

/**
 * Knowledge Graph surface (Variation B — "constellation atlas"). Resolves the
 * active subject from the route (defaulting to the first), then hands a single
 * subjectId to the canvas, which independently fetches layout/nodes/edges and
 * merges them client-side. The graph is never tab-gated and reads only
 * projections (graph-frontend §1).
 */
export function GraphPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const subjectsQ = useQuery(graphQueries.subjects());

  if (subjectsQ.isLoading) {
    return (
      <div>
        <GraphHeader />
        <Skeleton className="h-[calc(100vh-9rem)] min-h-[480px] w-full rounded-xl" />
      </div>
    );
  }

  if (subjectsQ.isError) {
    return (
      <div>
        <GraphHeader />
        <div className="max-w-sm">
          <ErrorState onRetry={() => subjectsQ.refetch()} message="Couldn't load your subjects." />
        </div>
      </div>
    );
  }

  const subjects = subjectsQ.data ?? [];

  if (subjects.length === 0) {
    return (
      <div>
        <GraphHeader />
        <div className="flex h-[calc(100vh-9rem)] min-h-[480px] items-center justify-center rounded-xl border border-forest/10 bg-cream">
          <p className="max-w-sm text-center text-body text-charcoal/60">
            Your atlas is empty. Add a subject and a few concepts, and they'll appear here as a
            constellation you can explore.
          </p>
        </div>
      </div>
    );
  }

  const active = subjects.find((s) => s.id === subjectId) ?? subjects[0];

  return (
    <div>
      <GraphHeader>
        {subjects.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/graph/${s.id}`)}
                aria-pressed={s.id === active.id}
                className={`rounded-full px-3 py-1 text-caption transition-colors duration-fast ${
                  s.id === active.id
                    ? 'bg-forest text-cream'
                    : 'border border-forest/20 text-charcoal/70 hover:bg-forest/5'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </GraphHeader>

      <GraphCanvas key={active.id} subjectId={active.id} subjectName={active.name} />
    </div>
  );
}

function GraphHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/50">Atlas</p>
        <h1 className="mt-1 font-display text-h1 font-medium text-charcoal">Knowledge Graph</h1>
      </div>
      {children}
    </header>
  );
}

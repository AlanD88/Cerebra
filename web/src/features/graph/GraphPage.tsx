import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState, Skeleton } from '../../components/feedback';
import { ModeToggle } from '../../components/ModeToggle';
import { useMode } from '../preferences/useMode';
import { GraphCanvas } from './GraphCanvas';
import { graphQueries } from './queries';
import type { SubjectLite } from './types';

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
  const { mode } = useMode('graph');
  const immersive = mode === 'immersive';

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
  const switcher = subjects.length > 1 && (
    <SubjectSwitcher subjects={subjects} activeId={active.id} onPick={(id) => navigate(`/graph/${id}`)} />
  );

  // Immersive mode: the page header drops away and the canvas goes full-bleed
  // (breaking out of the AppShell padding); chrome floats over the graph.
  if (immersive) {
    return (
      <div className="-mx-8 -my-8">
        <GraphCanvas
          key={active.id}
          subjectId={active.id}
          subjectName={active.name}
          immersive
          overlay={
            <div className="surface-floating flex items-center gap-3 px-4 py-2">
              {switcher}
              <ModeToggle surface="graph" />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <GraphHeader>
        {switcher}
        <ModeToggle surface="graph" />
      </GraphHeader>

      <GraphCanvas key={active.id} subjectId={active.id} subjectName={active.name} />
    </div>
  );
}

function SubjectSwitcher({
  subjects,
  activeId,
  onPick,
}: {
  subjects: SubjectLite[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {subjects.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          aria-pressed={s.id === activeId}
          className={`rounded-full px-3 py-1 text-caption transition-colors duration-fast ${
            s.id === activeId
              ? 'bg-forest text-cream'
              : 'border border-forest/20 text-charcoal/70 hover:bg-forest/5'
          }`}
        >
          {s.name}
        </button>
      ))}
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
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}

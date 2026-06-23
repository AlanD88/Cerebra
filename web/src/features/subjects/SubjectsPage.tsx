import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { HeatDot } from '../../components/HeatDot';
import { ErrorState, Skeleton } from '../../components/feedback';
import { heatColor } from '../../lib/heat';
import { pct } from '../../lib/format';
import { dashboardQueries } from '../dashboard/queries';

// A library index over the same projection the dashboard's Subject Progress card
// reads (/subjects/progress). Each card opens the subject in the graph.
export function SubjectsPage() {
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.subjectProgress());

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/50">Library</p>
        <h1 className="mt-1 font-display text-h1 font-medium text-charcoal">Subjects</h1>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="max-w-sm">
          <ErrorState onRetry={() => refetch()} message="Couldn't load your subjects." />
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-body text-charcoal/60">
          No subjects yet — seed the demo data or create one to get started.
        </p>
      )}

      {data && data.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((s) => (
            <li key={s.subjectId}>
              <Link
                to={`/graph/${s.subjectId}`}
                className="surface-paper block p-5 transition-colors duration-fast hover:border-forest/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-lg font-semibold text-charcoal">{s.name}</span>
                  <HeatDot state={s.heatState} />
                </div>
                <div className="mt-4 flex items-center justify-between text-caption text-charcoal/60">
                  <span>Average mastery</span>
                  <span className="font-mono text-charcoal/80">{pct(s.avgMastery)}%</span>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-forest/10"
                  role="progressbar"
                  aria-valuenow={pct(s.avgMastery)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${s.name} mastery`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-normal"
                    style={{ width: `${pct(s.avgMastery)}%`, backgroundColor: heatColor(s.heatState) }}
                  />
                </div>
                <span className="mt-4 inline-block text-caption font-semibold text-forest">
                  Open in graph →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

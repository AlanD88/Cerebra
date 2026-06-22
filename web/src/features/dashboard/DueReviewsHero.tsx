import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { dashboardQueries } from './queries';

export function DueReviewsHero() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.dueSummary());

  return (
    <section
      className="card-reveal surface-floating min-h-[184px] p-7 text-cream"
      style={{ background: '#30433D' }}
      aria-label="Due for review"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cream/55">
        Due for review
      </p>

      {isLoading && (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-12 w-28 bg-cream/15" />
          <Skeleton className="h-4 w-40 bg-cream/15" />
        </div>
      )}

      {isError && (
        <div className="mt-4">
          <ErrorState tone="dark" onRetry={() => refetch()} message="Couldn't load your queue." />
        </div>
      )}

      {data && data.total === 0 && (
        <div className="mt-3">
          <EmptyState tone="dark">
            Nothing due — your schedule is clear. Explore the graph or add a concept.
          </EmptyState>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="mt-2 flex items-end justify-between gap-6">
          <div className="flex items-end gap-5">
            <span className="font-display text-[64px] font-medium leading-none">{data.total}</span>
            <span className="pb-2 text-body-lg leading-snug text-cream/80">
              concepts
              <br />
              across {data.subjects} subject{data.subjects === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/review')}
            className="rounded-xl bg-sand px-5 py-3 text-body font-semibold text-forest transition-colors duration-fast hover:bg-sand/90"
          >
            Begin review →
          </button>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="mt-5 flex gap-2.5">
          <Pill color="#B17457" label={`${data.overdue} overdue`} />
          <Pill color="#D9C8A9" label={`${data.dueToday} due today`} />
        </div>
      )}
    </section>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-cream/10 px-3 py-1.5 text-caption text-cream/90">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

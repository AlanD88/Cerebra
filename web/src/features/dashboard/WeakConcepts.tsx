import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeading } from '../../components/Card';
import { HeatDot } from '../../components/HeatDot';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { pct } from '../../lib/format';
import { dashboardQueries } from './queries';

export function WeakConcepts() {
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.weak(5));

  return (
    <Card className="min-h-[200px]">
      <CardHeading
        title="Weakest concepts"
        hint="what you're forgetting"
        right={
          data && data.length > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clay">
              attention needed
            </span>
          ) : undefined
        }
      />

      {isLoading && (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-6 w-full" />
            </li>
          ))}
        </ul>
      )}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState>Start reviewing to surface what you're forgetting.</EmptyState>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-forest/10">
          {data.map((c, i) => (
            <li key={c.conceptId}>
              <Link
                to={`/concepts/${c.conceptId}`}
                className="flex items-center gap-3 py-2.5 transition-colors duration-fast hover:bg-forest/[0.03]"
              >
                <span className="w-5 text-right font-mono text-caption text-charcoal/40">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-lg text-charcoal">{c.name}</span>
                  <span className="block truncate text-caption text-charcoal/50">{c.subject}</span>
                </span>
                <span className="font-mono text-caption text-charcoal/60">{pct(c.mastery)}%</span>
                <HeatDot state={c.heatState} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

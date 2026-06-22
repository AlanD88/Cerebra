import { useQuery } from '@tanstack/react-query';
import { Card, CardHeading } from '../../components/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { HEAT_LABEL, heatColor } from '../../lib/heat';
import { pct } from '../../lib/format';
import { dashboardQueries } from './queries';

export function SubjectProgress() {
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.subjectProgress());

  return (
    <Card className="min-h-[160px]">
      <CardHeading title="Subject progress" />

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState>No subjects yet — create one to get started.</EmptyState>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3.5">
          {data.map((s) => (
            <li key={s.subjectId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-body font-semibold text-charcoal">{s.name}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-charcoal/45">
                    {HEAT_LABEL[s.heatState]}
                  </span>
                  <span className="font-mono text-caption text-charcoal/60">{pct(s.avgMastery)}%</span>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-forest/10"
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
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

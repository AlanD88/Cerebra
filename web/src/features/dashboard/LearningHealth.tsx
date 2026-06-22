import { useQuery } from '@tanstack/react-query';
import { Card, CardHeading } from '../../components/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { pct, signedPct } from '../../lib/format';
import { dashboardQueries } from './queries';

export function LearningHealth() {
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.health());

  return (
    <Card surface="glass" className="min-h-[180px]">
      <CardHeading title="Learning health" />
      {isLoading && <Skeleton className="h-24 w-full" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.tracked === 0 && (
        <EmptyState>Add your first concept to begin tracking learning health.</EmptyState>
      )}
      {data && data.tracked > 0 && (
        <div className="flex items-center gap-5">
          <Ring fraction={data.avgMastery} />
          <dl className="flex-1 space-y-2.5">
            <Stat
              label="Retention"
              value={`${pct(data.retention)}%`}
              delta={signedPct(data.retentionDelta)}
              deltaUp={data.retentionDelta >= 0}
            />
            <Stat label="Concepts tracked" value={String(data.tracked)} sub={`across ${data.subjects}`} />
          </dl>
        </div>
      )}
    </Card>
  );
}

function Ring({ fraction }: { fraction: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, fraction)) * c;
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(48,67,61,0.12)" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="#30433D"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-display font-medium leading-none text-forest">
          {pct(fraction)}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-sage">avg mastery</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  delta,
  deltaUp,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaUp?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-caption text-charcoal/55">{label}</dt>
      <dd className="flex items-baseline gap-2">
        {sub && <span className="text-caption text-charcoal/40">{sub}</span>}
        <span className="font-display text-body-lg text-charcoal">{value}</span>
        {delta && (
          <span className={`font-mono text-[10px] ${deltaUp ? 'text-moss' : 'text-clay'}`}>
            {delta}
          </span>
        )}
      </dd>
    </div>
  );
}

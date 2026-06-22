import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeading } from '../../components/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { pct } from '../../lib/format';
import { dashboardQueries } from './queries';
import type { RetentionTrends as RetentionTrendsData } from './types';

const W = 320;
const H = 96;
const PAD_Y = 8;

export function RetentionTrends() {
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.retention(30));

  const hasData = data && data.points.some((p) => p > 0);

  return (
    <Card className="min-h-[180px]">
      <CardHeading title="Retention trend" hint="30 days" />
      {isLoading && <Skeleton className="h-24 w-full" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && !hasData && <EmptyState>Trends appear after a few days of review.</EmptyState>}
      {hasData && <Chart data={data} />}
    </Card>
  );
}

function Chart({ data }: { data: RetentionTrendsData }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.points;
  const n = pts.length;

  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - PAD_Y - v * (H - 2 * PAD_Y);

  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  const active = hover ?? n - 1;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-display text-forest">{pct(pts[active])}%</span>
        <span className="font-mono text-caption text-charcoal/50">
          retention · {fmtDay(data.reviews[active]?.day)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="img"
        aria-label="Retention over the last 30 days"
        preserveAspectRatio="none"
      >
        <path d={area} fill="#61715A" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="#61715A" strokeWidth={1.6} />
        <circle cx={x(active)} cy={y(pts[active])} r={3} fill="#30433D" />
        {/* per-day hover hit areas */}
        {pts.map((_, i) => (
          <rect
            key={i}
            x={i === 0 ? 0 : x(i - 0.5)}
            y={0}
            width={n <= 1 ? W : W / (n - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            data-testid={`retention-seg-${i}`}
          />
        ))}
      </svg>
    </div>
  );
}

function fmtDay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

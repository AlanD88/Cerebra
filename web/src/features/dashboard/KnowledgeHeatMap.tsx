import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeading } from '../../components/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { HEAT_LABEL, heatColor } from '../../lib/heat';
import { pct } from '../../lib/format';
import { dashboardQueries } from './queries';

export function KnowledgeHeatMap() {
  const { data, isLoading, isError, refetch } = useQuery(dashboardQueries.heatmap());
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  return (
    <Card className="min-h-[160px]">
      <CardHeading
        title="Knowledge heat"
        right={
          hoverLabel ? (
            <span className="font-mono text-[10px] text-charcoal/60">{hoverLabel}</span>
          ) : undefined
        }
      />

      {isLoading && <Skeleton className="h-20 w-full" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState>Create concepts to build your knowledge heat map.</EmptyState>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((row) => (
            <div key={row.subject}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-charcoal/45">
                {row.subject}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.cells.map((cell) => {
                  const label = `${cell.name} · ${HEAT_LABEL[cell.heatState]} (${pct(cell.mastery)}%)`;
                  return (
                    <Link
                      key={cell.conceptId}
                      to={`/concepts/${cell.conceptId}`}
                      title={label}
                      aria-label={label}
                      onMouseEnter={() => setHoverLabel(label)}
                      onMouseLeave={() => setHoverLabel(null)}
                      onFocus={() => setHoverLabel(label)}
                      onBlur={() => setHoverLabel(null)}
                      className="h-6 w-6 rounded-[5px] ring-1 ring-inset ring-forest/10 transition-transform duration-fast hover:scale-110"
                      style={{ backgroundColor: heatColor(cell.heatState) }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

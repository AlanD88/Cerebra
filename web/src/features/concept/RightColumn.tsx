import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeading } from '../../components/Card';
import { HeatDot } from '../../components/HeatDot';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { pct } from '../../lib/format';
import { conceptQueries } from './queries';
import { SCORE_LABEL, type ConceptDetail } from './types';

export function RightColumn({ conceptId, detail }: { conceptId: string; detail?: ConceptDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <RecallCard conceptId={conceptId} />
      <ProblemsCard detail={detail} />
      <DependenciesCard conceptId={conceptId} />
      <AIInsightsCard conceptId={conceptId} />
    </div>
  );
}

function RecallCard({ conceptId }: { conceptId: string }) {
  const { data, isLoading, isError, refetch } = useQuery(conceptQueries.recall(conceptId));
  return (
    <Card>
      <CardHeading
        title="Recall"
        right={
          data && data.dueCount > 0 ? (
            <span className="rounded-full bg-clay/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-clay">
              due now
            </span>
          ) : undefined
        }
      />
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState>Nothing scheduled — you're caught up on this concept.</EmptyState>
      )}
      {data && data.items.length > 0 && (
        <ul className="space-y-2.5">
          {data.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <HeatDot state={item.heatState} showLabel={false} />
              <span className="min-w-0 flex-1 truncate text-body text-charcoal/90">{item.prompt}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-charcoal/45">
                {SCORE_LABEL[item.lastScore]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProblemsCard({ detail }: { detail?: ConceptDetail }) {
  return (
    <Card>
      <CardHeading title="Problems" />
      {!detail ? (
        <Skeleton className="h-10 w-24" />
      ) : detail.problemAccuracy === 0 ? (
        <EmptyState>No problems attempted yet.</EmptyState>
      ) : (
        <div>
          <p className="font-display text-display font-medium text-charcoal">
            {pct(detail.problemAccuracy)}
            <span className="ml-1 text-body text-charcoal/40">% accuracy</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-forest/10">
            <div
              className="h-full rounded-full bg-moss transition-[width] duration-normal"
              style={{ width: `${pct(detail.problemAccuracy)}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function DependenciesCard({ conceptId }: { conceptId: string }) {
  const { data, isLoading, isError, refetch } = useQuery(conceptQueries.deps(conceptId));
  return (
    <Card>
      <CardHeading title="Dependencies" />
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState>No prerequisites mapped — add relationships in the graph.</EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2.5">
          {data.map((dep) => (
            <li key={dep.conceptId}>
              <Link
                to={`/concepts/${dep.conceptId}`}
                className="flex items-center justify-between gap-2 rounded-md py-1 transition-colors duration-fast hover:bg-forest/[0.03]"
              >
                <span className="flex items-center gap-2">
                  <span className="text-body text-charcoal/90">{dep.name}</span>
                  {dep.isRootWeakness && (
                    <span className="rounded-full bg-clay/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-clay">
                      root weakness
                    </span>
                  )}
                </span>
                <HeatDot state={dep.heatState} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AIInsightsCard({ conceptId }: { conceptId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = useQuery(conceptQueries.insight(conceptId));

  return (
    <section className="card-reveal surface-floating p-5 text-cream" style={{ background: '#30433D' }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cream/55">AI insight</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream/60 transition-colors duration-fast hover:text-cream"
        >
          {isFetching ? 'Refreshing…' : 'Refresh insight'}
        </button>
      </div>

      {isLoading && <p className="animate-pulse text-body text-cream/70">Analyzing your performance…</p>}
      {isError && <ErrorState tone="dark" onRetry={() => refetch()} message="Couldn't generate an insight." />}
      {data && !data.summary && <EmptyState tone="dark">Insight appears after a few reviews.</EmptyState>}
      {data && data.summary && (
        <div>
          <p className="text-body leading-relaxed text-cream/90">{data.summary}</p>
          <button
            type="button"
            onClick={() => navigate(data.suggestedConceptId ? `/concepts/${data.suggestedConceptId}` : '/review')}
            className="mt-4 rounded-lg bg-sand px-4 py-2 text-body font-semibold text-forest transition-colors duration-fast hover:bg-sand/90"
          >
            {data.cta} →
          </button>
        </div>
      )}
    </section>
  );
}

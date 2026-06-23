import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HeatDot } from '../../components/HeatDot';
import { ErrorState, Skeleton } from '../../components/feedback';
import { pct } from '../../lib/format';
import { conceptQueries } from '../concept/queries';

// L3 floating inspector. Reuses the Phase 3 ['concept', id] + deps queries so
// selecting a node warms the same cache the Concept Page uses.
export function ConceptInspector({
  conceptId,
  subjectName,
  onClose,
  onShowPath,
}: {
  conceptId: string;
  subjectName?: string;
  onClose: () => void;
  onShowPath: () => void;
}) {
  const navigate = useNavigate();
  const detailQ = useQuery(conceptQueries.detail(conceptId));
  const depsQ = useQuery(conceptQueries.deps(conceptId));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const detail = detailQ.data;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Concept inspector"
      className="surface-floating absolute right-5 top-5 z-20 w-[300px] p-5 outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-charcoal/45">
          Inspector
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-charcoal/40">{subjectName ?? detail?.subject}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="text-charcoal/40 transition-colors duration-fast hover:text-charcoal"
          >
            ✕
          </button>
        </span>
      </div>

      {detailQ.isLoading && (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {detailQ.isError && (
        <div className="mt-3">
          <ErrorState onRetry={() => detailQ.refetch()} message="Couldn't load this concept." />
        </div>
      )}

      {detail && (
        <>
          <h2 className="mt-1 font-display text-h2 text-charcoal">{detail.name}</h2>
          <div className="mt-1">
            <HeatDot state={detail.heatState} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label="Mastery" value={pct(detail.mastery)} />
            <Mini label="Retention" value={pct(detail.retention)} />
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-charcoal/45">
            Prerequisites
          </p>
          {depsQ.data && depsQ.data.length === 0 && (
            <p className="mt-2 text-caption text-charcoal/55">
              This concept is foundational — no prerequisites.
            </p>
          )}
          {depsQ.data && depsQ.data.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {depsQ.data.map((d) => (
                <li key={d.conceptId} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-body text-charcoal/85">
                    <HeatDot state={d.heatState} showLabel={false} />
                    {d.name}
                  </span>
                  <span className="font-mono text-caption text-charcoal/50">{pct(d.mastery)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onShowPath}
              className="rounded-lg border border-forest/20 px-3 py-1.5 text-caption text-forest transition-colors duration-fast hover:bg-forest/5"
            >
              Show learning path
            </button>
            <button
              type="button"
              onClick={() => navigate(`/concepts/${conceptId}`)}
              className="rounded-lg bg-forest px-3 py-1.5 text-caption font-semibold text-cream transition-colors duration-fast hover:bg-forest/90"
            >
              Open page
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-paper p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-charcoal/45">{label}</p>
      <p className="mt-1 font-display text-h2 text-charcoal">{value}</p>
    </div>
  );
}

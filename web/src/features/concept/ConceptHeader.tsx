import { useNavigate } from 'react-router-dom';
import { HeatDot } from '../../components/HeatDot';
import { Skeleton } from '../../components/feedback';
import { pct } from '../../lib/format';
import type { ConceptDetail } from './types';

function dueLabel(dueAt: string | null): string {
  if (!dueAt) return 'Not scheduled';
  const days = Math.round((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  return `Next review in ${days} day${days === 1 ? '' : 's'}`;
}

export function ConceptHeader({ detail }: { detail?: ConceptDetail }) {
  const navigate = useNavigate();

  if (!detail) {
    return (
      <header className="mb-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-3 h-4 w-64" />
      </header>
    );
  }

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/50">
          {detail.breadcrumb} <span className="text-sage">/</span> {detail.subject}
        </p>
        <h1 className="mt-1 font-display text-display-xl font-medium text-charcoal">{detail.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-charcoal/60">
          <HeatDot state={detail.heatState} />
          <span className="text-charcoal/30">·</span>
          <span>
            Mastery <span className="font-semibold text-charcoal">{pct(detail.mastery)}</span>
          </span>
          <span className="text-charcoal/30">·</span>
          <span>{dueLabel(detail.dueAt)}</span>
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/review')}
          className="rounded-xl bg-forest px-4 py-2.5 text-body font-semibold text-cream transition-colors duration-fast hover:bg-forest/90"
        >
          Practice recall
        </button>
        <button
          type="button"
          onClick={() => navigate('/graph')}
          className="rounded-xl border border-forest/20 px-4 py-2.5 text-body font-semibold text-forest transition-colors duration-fast hover:bg-forest/5"
        >
          Open in graph
        </button>
      </div>
    </header>
  );
}

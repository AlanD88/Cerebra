import { Skeleton } from '../../components/feedback';
import { heatColor } from '../../lib/heat';
import { pct } from '../../lib/format';
import type { ConceptDetail } from './types';

// Four-stat bar (mastery, retention, recall, problem accuracy); teaches an empty
// state until the concept has been reviewed.
interface Stat {
  label: string;
  value: number; // 0..1
  unit: string;
  accent: string;
}

export function ConceptMetricsBar({ detail }: { detail?: ConceptDetail }) {
  if (!detail) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-paper p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-3 h-1.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (detail.reviewCount === 0) {
    return (
      <div className="surface-paper mb-6 p-5 text-body text-charcoal/60">
        No reviews yet — practice recall to start tracking mastery.
      </div>
    );
  }

  const stats: Stat[] = [
    { label: 'Mastery', value: detail.mastery, unit: '/100', accent: heatColor(detail.heatState) },
    { label: 'Retention', value: detail.retention, unit: '/100', accent: '#30433D' },
    { label: 'Recall accuracy', value: detail.recallAccuracy, unit: '%', accent: '#61715A' },
    { label: 'Problem accuracy', value: detail.problemAccuracy, unit: '%', accent: '#61715A' },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="surface-paper p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-charcoal/50">
            {s.label}
          </p>
          <p className="mt-2 font-display text-display font-medium text-charcoal">
            {pct(s.value)}
            <span className="ml-1 align-baseline text-body text-charcoal/40">{s.unit}</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-forest/10">
            <div
              className="h-full rounded-full transition-[width] duration-normal"
              style={{ width: `${pct(s.value)}%`, backgroundColor: s.accent }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HeatDot } from '../components/HeatDot';
import type { Heat } from '../lib/heat';

/**
 * Phase 0 throwaway page: proves the read path by querying a projection-table
 * endpoint (`concept_metrics`) and rendering heat via the shared utility.
 * Replaced by the real Dashboard in Phase 2.
 */
export interface SmokeMetric {
  concept_id: string;
  name: string;
  mastery: number; // 0..1, from the projection
  heat_state: Heat;
}

export function FoundationsSmoke() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['_smoke', 'metrics'],
    queryFn: () => api.get<SmokeMetric[]>('/_smoke/metrics'),
  });

  return (
    <section>
      <p className="eyebrow">Phase 0 · Foundations</p>
      <h1 className="mt-1 font-display text-display text-forest">Read-path smoke test</h1>
      <p className="mt-2 max-w-prose text-body text-charcoal/70">
        Reads <code className="font-mono text-caption">concept_metrics</code> through the API and
        renders heat with the shared utility — proving the projection-only read path.
      </p>

      <div className="mt-6 surface-paper p-5">
        {isLoading && <p className="text-body text-charcoal/60">Loading projection…</p>}

        {isError && (
          <p className="text-body text-clay">
            Could not reach the projection API. Start the backend, then reload.
          </p>
        )}

        {data && data.length === 0 && (
          <p className="text-body text-charcoal/60">
            No concepts yet. Seed a subject to populate the projection.
          </p>
        )}

        {data && data.length > 0 && (
          <ul className="flex flex-col divide-y divide-forest/10">
            {data.map((m) => (
              <li
                key={m.concept_id}
                className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-body-lg text-charcoal">{m.name}</span>
                <span className="flex items-center gap-4">
                  <span className="font-mono text-caption text-charcoal/60">
                    {Math.round(m.mastery * 100)}%
                  </span>
                  <HeatDot state={m.heat_state} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

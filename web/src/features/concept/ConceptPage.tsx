import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ModeToggle } from '../../components/ModeToggle';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { useMode } from '../preferences/useMode';
import { conceptQueries } from './queries';
import { ConceptHeader } from './ConceptHeader';
import { ConceptMetricsBar } from './ConceptMetricsBar';
import { VisualizationPanel } from './VisualizationPanel';
import { LeftColumn } from './LeftColumn';
import { RightColumn } from './RightColumn';

export function ConceptPage() {
  const { conceptId = '' } = useParams();
  const core = useQuery(conceptQueries.detail(conceptId));
  const { mode } = useMode('concept');
  const focus = mode === 'focus';
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A core failure is the only full-page error; the visualization frame and all
  // satellite cards degrade locally and never blank the page.
  if (core.isError) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="font-display text-h2 text-charcoal">Couldn't load this concept</h1>
        <p className="mt-2 text-body text-charcoal/60">It may have been removed.</p>
        <Link to="/graph" className="mt-4 inline-block text-body font-semibold text-forest underline">
          Back to the graph
        </Link>
      </div>
    );
  }

  const detail = core.data;
  const body = (
    <>
      <LeftColumn detail={detail} />
      <RightColumn conceptId={conceptId} detail={detail} />
    </>
  );

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ModeToggle surface="concept" />
      </div>
      <ConceptHeader detail={detail} />
      <ConceptMetricsBar detail={detail} />

      {/* The visualization is ALWAYS mounted and never tab-gated; focus mode only
          makes it more prominent (agent-rules / polish-frontend §1). */}
      <div className={focus ? 'mb-4' : 'mb-6'}>
        <VisualizationPanel vizSpec={detail?.vizSpec ?? null} prominent={focus} />
      </div>

      {focus ? (
        <>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-xl border border-forest/20 px-4 py-2.5 text-body font-semibold text-forest transition-colors duration-fast hover:bg-forest/5"
            >
              Open notes, recall &amp; dependencies
            </button>
          </div>
          {drawerOpen && <FocusDrawer onClose={() => setDrawerOpen(false)}>{body}</FocusDrawer>}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">{body}</div>
      )}
    </div>
  );
}

/**
 * Focus-mode side drawer (L3). Holds the body cards so the visualization can go
 * full-bleed. Traps focus while open and restores it on close (accessibility).
 */
function FocusDrawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-charcoal/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-label="Concept details"
        onClick={(e) => e.stopPropagation()}
        className="surface-floating h-full w-full max-w-xl overflow-y-auto p-6 outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="eyebrow">Details</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="text-charcoal/40 transition-colors duration-fast hover:text-charcoal"
          >
            ✕
          </button>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}

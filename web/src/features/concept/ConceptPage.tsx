import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { conceptQueries } from './queries';
import { ConceptHeader } from './ConceptHeader';
import { ConceptMetricsBar } from './ConceptMetricsBar';
import { VisualizationPanel } from './VisualizationPanel';
import { LeftColumn } from './LeftColumn';
import { RightColumn } from './RightColumn';

export function ConceptPage() {
  const { conceptId = '' } = useParams();
  const core = useQuery(conceptQueries.detail(conceptId));

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

  return (
    <div>
      <ConceptHeader detail={detail} />
      <ConceptMetricsBar detail={detail} />
      <div className="mb-6">
        <VisualizationPanel vizSpec={detail?.vizSpec ?? null} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <LeftColumn detail={detail} />
        <RightColumn conceptId={conceptId} detail={detail} />
      </div>
    </div>
  );
}

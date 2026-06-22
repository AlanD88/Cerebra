import { DashboardHeader } from './DashboardHeader';
import { DueReviewsHero } from './DueReviewsHero';
import { WeakConcepts } from './WeakConcepts';
import { RetentionTrends } from './RetentionTrends';
import { LearningHealth } from './LearningHealth';
import { KnowledgeHeatMap } from './KnowledgeHeatMap';
import { SubjectProgress } from './SubjectProgress';

/**
 * Dashboard (Variation A — "Study Desk"). Two-column grid 1.62fr / 1fr. Every
 * number comes from a projection query; no component holds a learning metric in
 * local state.
 */
export function DashboardPage() {
  return (
    <div>
      <DashboardHeader />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.62fr_1fr]">
        <div className="flex flex-col gap-5">
          <DueReviewsHero />
          <WeakConcepts />
          <RetentionTrends />
        </div>
        <div className="flex flex-col gap-5">
          <LearningHealth />
          <KnowledgeHeatMap />
          <SubjectProgress />
        </div>
      </div>
    </div>
  );
}

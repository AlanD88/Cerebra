import { Card, CardHeading } from '../../components/Card';
import { Tex } from '../../components/Tex';
import { Skeleton } from '../../components/feedback';
import type { ConceptDetail } from './types';

export function LeftColumn({ detail }: { detail?: ConceptDetail }) {
  if (!detail) {
    return (
      <div className="flex flex-col gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-16 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeading title="Intuition" />
        <p className="text-body-lg leading-relaxed text-charcoal/90">
          {detail.intuition ?? 'No intuition written yet.'}
        </p>
      </Card>

      <Card>
        <CardHeading title="Definition" />
        {detail.definition ? (
          <div className="overflow-x-auto py-1">
            <Tex display tex={detail.definition} className="text-charcoal" />
          </div>
        ) : (
          <p className="text-body text-charcoal/50">Definition coming soon.</p>
        )}
      </Card>

      <Card>
        <CardHeading title="Notes" />
        <p className="text-body leading-relaxed text-charcoal/80">
          {detail.notes ?? 'No notes yet.'}
        </p>
      </Card>
    </div>
  );
}

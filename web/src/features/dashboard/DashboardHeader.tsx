// Greeting + date line are derived locally from the clock (never cached, never
// a learning metric). No streak badge: the product is explicitly anti-streak.

const LEARNER_NAME = 'Maya';

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHeader({ now = new Date() }: { now?: Date }) {
  const dateLine = now
    .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();

  return (
    <header className="mb-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/50">{dateLine}</p>
      <h1 className="mt-1 font-display text-display font-medium text-charcoal">
        {greetingFor(now.getHours())}, {LEARNER_NAME}.
      </h1>
    </header>
  );
}

import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-forest/10 ${className}`} />;
}

interface ErrorStateProps {
  onRetry: () => void;
  message?: string;
  tone?: 'light' | 'dark';
}

/** Inline, non-blocking error with a Retry that refetches one query only. */
export function ErrorState({ onRetry, message = 'Could not load this card.', tone = 'light' }: ErrorStateProps) {
  const text = tone === 'dark' ? 'text-cream/80' : 'text-clay';
  const btn =
    tone === 'dark'
      ? 'border-cream/30 text-cream hover:bg-cream/10'
      : 'border-forest/20 text-forest hover:bg-forest/5';
  return (
    <div role="alert" className="flex items-center justify-between gap-3 text-body">
      <span className={text}>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className={`rounded-md border px-2.5 py-1 text-caption transition-colors duration-fast ${btn}`}
      >
        Retry
      </button>
    </div>
  );
}

/** Empty states teach rather than show a generic placeholder (agent-rules). */
export function EmptyState({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p className={`text-body ${tone === 'dark' ? 'text-cream/70' : 'text-charcoal/60'}`}>{children}</p>
  );
}

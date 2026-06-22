import { HEAT_LABEL, heatColor, type Heat } from '../lib/heat';

interface HeatDotProps {
  state: Heat;
  /** Hide the text label only where an adjacent label already names the heat. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Heat is shown by label + dot, never color alone (agent-rules invariant #7).
 * The dot is decorative (aria-hidden); the label carries the meaning.
 */
export function HeatDot({ state, showLabel = true, className }: HeatDotProps) {
  // The wrapper always carries the heat name (aria-label / title) so the meaning
  // survives even when the visible text label is suppressed for space.
  return (
    <span
      className={['inline-flex items-center gap-1.5', className].filter(Boolean).join(' ')}
      aria-label={showLabel ? undefined : HEAT_LABEL[state]}
      title={showLabel ? undefined : HEAT_LABEL[state]}
    >
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: heatColor(state) }}
      />
      {showLabel && (
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/70">
          {HEAT_LABEL[state]}
        </span>
      )}
    </span>
  );
}

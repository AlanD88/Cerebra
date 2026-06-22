import { HEAT_COLOR, type Heat } from '../tokens/tokens';

export type { Heat };
export { HEAT_COLOR };

/**
 * Map a 0–100 mastery value to a heat state. This is the single client-side
 * source of truth for UI-only mastery values (e.g. a derived percentage that
 * has no stored `heat_state`). For projection-backed concepts, prefer the
 * stored `heat_state` enum and map it with {@link heatColor}.
 *
 * Thresholds match `specs/foundations.md` §4.
 */
export function heatState(mastery: number): Heat {
  if (mastery >= 85) return 'mastered';
  if (mastery >= 70) return 'hot';
  if (mastery >= 50) return 'warm';
  if (mastery >= 25) return 'cold';
  return 'frozen';
}

export const HEAT_LABEL: Record<Heat, string> = {
  mastered: 'Mastered',
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  frozen: 'Frozen',
};

export function heatColor(state: Heat): string {
  return HEAT_COLOR[state];
}

export function heatLabel(state: Heat): string {
  return HEAT_LABEL[state];
}

/** Convenience: map a fractional (0–1) mastery to a heat state. */
export function heatStateFromFraction(masteryFraction: number): Heat {
  return heatState(masteryFraction * 100);
}

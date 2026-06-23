// Optional-mode preferences (polish-frontend.md §1/§2). A mode is presentational
// only — it swaps layout/tone, never a data binding or a learning metric.

export type Surface = 'concept' | 'graph' | 'review';

export interface Preferences {
  modes: Record<string, string>;
}

export const DEFAULT_MODES: Record<Surface, string> = {
  concept: 'default',
  graph: 'default',
  review: 'default',
};

/** The single alternate mode each surface can toggle into. */
export const ALT_MODE: Record<Surface, string> = {
  concept: 'focus',
  graph: 'immersive',
  review: 'tutor',
};

export const MODE_LABEL: Record<string, string> = {
  default: 'Default',
  focus: 'Focus',
  immersive: 'Immersive',
  tutor: 'Tutor',
};

// Single source of truth for brand color + heat tokens.
// Imported by both tailwind.config.ts (to build utilities) and the heat utility
// (to map heat states to color). No other module should hard-code these hexes.

export const BRAND = {
  forest: '#30433D',
  moss: '#61715A',
  sage: '#8D9C84',
  clay: '#B17457',
  sand: '#D9C8A9',
  cream: '#F5F1E8',
  charcoal: '#1F2522',
} as const;

// Heat encoding — the single source of truth for heat → color (agent-rules §heat).
export const HEAT_COLOR = {
  mastered: '#30433D', // forest
  hot: '#61715A', // moss
  warm: '#D9C8A9', // sand
  cold: '#B17457', // clay
  frozen: '#6b6f6c', // muted charcoal
} as const;

export type Heat = keyof typeof HEAT_COLOR;

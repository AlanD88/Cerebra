// Concept Page DTOs — the camelCase mirror of the backend's schemas
// (ConceptDetailOut, RecallCardOut, DependencyOut, InsightOut). Read-only; the
// viz spec drives the always-on visualization, and SCORE_LABEL names recall scores.
import type { Heat } from '../../lib/heat';

export interface VizEig {
  val: number;
  d: [number, number];
}

export interface VizPreset {
  key: string;
  label: string; // KaTeX matrix
  m: number[][];
  eigs: VizEig[];
}

export interface VizSpec {
  kind: string;
  showGuides: boolean;
  presets: VizPreset[];
}

export interface ConceptDetail {
  conceptId: string;
  name: string;
  subject: string;
  breadcrumb: string;
  importance: number;
  mastery: number;
  retention: number;
  recallAccuracy: number;
  problemAccuracy: number;
  heatState: Heat;
  reviewCount: number;
  dueAt: string | null;
  intuition: string | null;
  definition: string | null;
  notes: string | null;
  vizSpec: VizSpec | null;
}

export interface RecallItem {
  prompt: string;
  lastScore: number; // 0..3
  heatState: Heat;
}

export interface RecallCard {
  dueCount: number;
  items: RecallItem[];
}

export interface Dependency {
  conceptId: string;
  name: string;
  heatState: Heat;
  mastery: number;
  isRootWeakness: boolean;
}

export interface Insight {
  summary: string;
  suggestedConceptId: string | null;
  cta: string;
}

export const SCORE_LABEL: Record<number, string> = {
  0: 'Forgot',
  1: 'Partial',
  2: 'Mostly',
  3: 'Perfect',
};

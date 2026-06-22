import type { Heat } from '../../lib/heat';

export interface DueSummary {
  total: number;
  overdue: number;
  dueToday: number;
  subjects: number;
}

export interface WeakConcept {
  conceptId: string;
  name: string;
  subject: string;
  mastery: number; // 0..1
  heatState: Heat;
}

export interface ReviewCountPoint {
  day: string; // ISO date
  count: number;
}

export interface RetentionTrends {
  points: number[]; // 0..1 per day, oldest → newest
  reviews: ReviewCountPoint[];
}

export interface LearningHealth {
  avgMastery: number; // 0..1
  retention: number; // 0..1
  retentionDelta: number; // signed 0..1
  tracked: number;
  subjects: number;
}

export interface HeatCell {
  conceptId: string;
  name: string;
  heatState: Heat;
  mastery: number; // 0..1
}

export interface HeatRow {
  subject: string;
  cells: HeatCell[];
}

export interface SubjectProgressItem {
  subjectId: string;
  name: string;
  avgMastery: number; // 0..1
  heatState: Heat;
}

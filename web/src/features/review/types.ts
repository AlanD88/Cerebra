// Review DTOs — the session queue (prompts only) and the read-only assess
// outcome. The score is AI-assigned; the client never sends or proposes one.
import type { Heat } from '../../lib/heat';

export interface ReviewItem {
  itemId: string;
  conceptId: string;
  conceptName: string;
  prompt: string;
}

export interface ReviewSessionDto {
  sessionId: string;
  total: number;
  conceptName: string | null;
  items: ReviewItem[];
}

export interface AssessResult {
  score: number; // 0..3, AI-assigned
  label: string;
  rationale: string;
  nextIntervalDays: number;
  heatState: Heat;
  modelAnswer: string | null;
}

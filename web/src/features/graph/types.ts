// Knowledge Graph DTOs + local view-model types: layout positions (presentation)
// and nodes/edges (knowledge) are independent reads, merged on the client.
// GraphFilter is local highlight state, never persisted.
import type { Heat } from '../../lib/heat';

export interface GraphLayoutPos {
  conceptId: string;
  x: number;
  y: number;
  pinned: boolean;
}

export interface GraphNode {
  conceptId: string;
  name: string;
  importance: number;
  heatState: Heat;
  mastery: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string; // prerequisite | related | extends
  strength: number | null;
}

export interface SubjectLite {
  id: string;
  name: string;
}

export type GraphFilter = 'weak' | 'deps' | null;

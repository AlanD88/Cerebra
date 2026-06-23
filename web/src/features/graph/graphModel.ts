import type { GraphEdge, GraphFilter, GraphNode } from './types';

/** Direct neighbors in either direction — derived from EDGES, never layout. */
export function neighbors(edges: GraphEdge[], id: string): Set<string> {
  const s = new Set<string>();
  for (const e of edges) {
    if (e.source === id) s.add(e.target);
    if (e.target === id) s.add(e.source);
  }
  return s;
}

/** Transitive prerequisites of `id` (the learning path), walking target→source. */
export function ancestors(edges: GraphEdge[], id: string): Set<string> {
  const byTarget = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== 'prerequisite') continue;
    const arr = byTarget.get(e.target) ?? [];
    arr.push(e.source);
    byTarget.set(e.target, arr);
  }
  const result = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const src of byTarget.get(cur) ?? []) {
      if (!result.has(src)) {
        result.add(src);
        stack.push(src);
      }
    }
  }
  return result;
}

export function searchMatch(nodes: GraphNode[], query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const s = new Set<string>();
  if (!q) return s;
  for (const n of nodes) if (n.name.toLowerCase().includes(q)) s.add(n.conceptId);
  return s;
}

export function weakSet(nodes: GraphNode[]): Set<string> {
  const s = new Set<string>();
  for (const n of nodes) if (n.heatState === 'cold' || n.heatState === 'frozen') s.add(n.conceptId);
  return s;
}

export interface ActiveInput {
  hoverId: string | null;
  selected: string | null;
  search: string;
  filter: GraphFilter;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * The active highlight set, computed once per render. Precedence (graph-frontend
 * §4): hover > search > weak-filter > dep-path > none. `null` means "at rest —
 * everything calm". A non-empty search always returns its (possibly empty) match
 * set so the canvas can dim everything and show "no concepts match".
 */
export function computeActiveSet(input: ActiveInput): Set<string> | null {
  const { hoverId, selected, search, filter, nodes, edges } = input;
  if (hoverId) {
    const s = neighbors(edges, hoverId);
    s.add(hoverId);
    return s;
  }
  if (search.trim()) {
    return searchMatch(nodes, search);
  }
  if (filter === 'weak') {
    return weakSet(nodes);
  }
  if (filter === 'deps' && selected) {
    const a = ancestors(edges, selected);
    a.add(selected);
    return a;
  }
  return null;
}

export function isNodeDimmed(active: Set<string> | null, id: string): boolean {
  return active !== null && !active.has(id);
}

export function isEdgeEmphasized(active: Set<string> | null, e: GraphEdge): boolean {
  return active !== null && active.has(e.source) && active.has(e.target);
}

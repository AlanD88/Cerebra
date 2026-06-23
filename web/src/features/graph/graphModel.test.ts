import { describe, expect, it } from 'vitest';
import {
  ancestors,
  computeActiveSet,
  isEdgeEmphasized,
  isNodeDimmed,
  neighbors,
  searchMatch,
  weakSet,
} from './graphModel';
import type { GraphEdge, GraphNode } from './types';

// A small fixture atlas:
//   prereq chain  a → b → c → d   (Vectors → Matrix → Eigenvector → SVD)
//   related edge  a ~ c           (cross-link, NOT a prerequisite)
//   related edge  x ~ d           (Determinant cross-links into SVD)
const NODES: GraphNode[] = [
  { conceptId: 'a', name: 'Vectors', importance: 5, heatState: 'mastered', mastery: 0.9 },
  { conceptId: 'b', name: 'Matrix', importance: 4, heatState: 'cold', mastery: 0.2 },
  { conceptId: 'c', name: 'Eigenvector', importance: 4, heatState: 'warm', mastery: 0.68 },
  { conceptId: 'd', name: 'SVD', importance: 3, heatState: 'frozen', mastery: 0 },
  { conceptId: 'x', name: 'Determinant', importance: 2, heatState: 'hot', mastery: 0.8 },
];

const EDGES: GraphEdge[] = [
  { source: 'a', target: 'b', type: 'prerequisite', strength: 1 },
  { source: 'b', target: 'c', type: 'prerequisite', strength: 1 },
  { source: 'c', target: 'd', type: 'prerequisite', strength: 1 },
  { source: 'a', target: 'c', type: 'related', strength: null },
  { source: 'x', target: 'd', type: 'related', strength: null },
];

const set = (s: Set<string>) => [...s].sort();

describe('neighbors', () => {
  it('collects edges in either direction regardless of type', () => {
    // c touches: b→c (prereq in), c→d (prereq out), a~c (related)
    expect(set(neighbors(EDGES, 'c'))).toEqual(['a', 'b', 'd']);
  });

  it('returns an empty set for an isolated id', () => {
    expect(neighbors(EDGES, 'unknown').size).toBe(0);
  });
});

describe('ancestors', () => {
  it('walks the transitive prerequisite chain target→source', () => {
    expect(set(ancestors(EDGES, 'd'))).toEqual(['a', 'b', 'c']);
  });

  it('ignores non-prerequisite edges', () => {
    // x→d is `related`, so x is never an ancestor of d
    expect(ancestors(EDGES, 'd').has('x')).toBe(false);
  });

  it('returns empty for a foundational concept with no prerequisites', () => {
    expect(ancestors(EDGES, 'a').size).toBe(0);
  });

  it('terminates on cycles', () => {
    const cyclic: GraphEdge[] = [
      { source: 'p', target: 'q', type: 'prerequisite', strength: 1 },
      { source: 'q', target: 'p', type: 'prerequisite', strength: 1 },
    ];
    expect(set(ancestors(cyclic, 'p'))).toEqual(['p', 'q']);
  });
});

describe('searchMatch', () => {
  it('matches case-insensitive substrings of the name', () => {
    expect(set(searchMatch(NODES, 'eig'))).toEqual(['c']);
    expect(set(searchMatch(NODES, 'MATRIX'))).toEqual(['b']);
  });

  it('returns an empty set for blank queries', () => {
    expect(searchMatch(NODES, '   ').size).toBe(0);
  });
});

describe('weakSet', () => {
  it('selects only cold and frozen concepts', () => {
    expect(set(weakSet(NODES))).toEqual(['b', 'd']);
  });
});

describe('computeActiveSet precedence', () => {
  const base = { hoverId: null, selected: null, search: '', filter: null, nodes: NODES, edges: EDGES };

  it('hover beats search, weak-filter and dep-path', () => {
    const active = computeActiveSet({ ...base, hoverId: 'c', search: 'matrix', filter: 'weak' });
    expect(set(active!)).toEqual(['a', 'b', 'c', 'd']); // c + its neighbors
  });

  it('search beats weak-filter and dep-path', () => {
    const active = computeActiveSet({ ...base, search: 'vectors', filter: 'weak', selected: 'd' });
    expect(set(active!)).toEqual(['a']);
  });

  it('a search with no matches dims everything (empty set, not null)', () => {
    const active = computeActiveSet({ ...base, search: 'zzz' });
    expect(active).not.toBeNull();
    expect(active!.size).toBe(0);
  });

  it('weak-filter beats dep-path', () => {
    const active = computeActiveSet({ ...base, filter: 'weak', selected: 'd' });
    expect(set(active!)).toEqual(['b', 'd']);
  });

  it('dep-path highlights ancestors plus the selected node', () => {
    const active = computeActiveSet({ ...base, filter: 'deps', selected: 'd' });
    expect(set(active!)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('dep-path with nothing selected falls through to rest', () => {
    expect(computeActiveSet({ ...base, filter: 'deps', selected: null })).toBeNull();
  });

  it('returns null when nothing is engaged (everything calm)', () => {
    expect(computeActiveSet(base)).toBeNull();
  });
});

describe('isNodeDimmed', () => {
  it('never dims when at rest', () => {
    expect(isNodeDimmed(null, 'a')).toBe(false);
  });

  it('dims nodes outside the active set', () => {
    const active = new Set(['a']);
    expect(isNodeDimmed(active, 'a')).toBe(false);
    expect(isNodeDimmed(active, 'b')).toBe(true);
  });
});

describe('isEdgeEmphasized', () => {
  const edge: GraphEdge = { source: 'a', target: 'b', type: 'prerequisite', strength: 1 };

  it('is never emphasized at rest', () => {
    expect(isEdgeEmphasized(null, edge)).toBe(false);
  });

  it('emphasizes only when both endpoints are active', () => {
    expect(isEdgeEmphasized(new Set(['a', 'b']), edge)).toBe(true);
    expect(isEdgeEmphasized(new Set(['a']), edge)).toBe(false);
  });
});

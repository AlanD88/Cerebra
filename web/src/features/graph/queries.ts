import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { GraphEdge, GraphLayoutPos, GraphNode, SubjectLite } from './types';

// Two independent reads: 'layout' (positions) and 'nodes'/'edges' (knowledge),
// merged only on the client (graph-frontend.md §2).
export const graphQueries = {
  subjects: () =>
    queryOptions({
      queryKey: ['subjects'] as const,
      queryFn: () => api.get<SubjectLite[]>('/subjects'),
      staleTime: 5 * 60_000,
    }),
  layout: (sid: string) =>
    queryOptions({
      queryKey: ['graph', sid, 'layout'] as const,
      queryFn: () => api.get<GraphLayoutPos[]>(`/graph/${sid}/layout`),
      staleTime: 60_000,
    }),
  nodes: (sid: string) =>
    queryOptions({
      queryKey: ['graph', sid, 'nodes'] as const,
      queryFn: () => api.get<GraphNode[]>(`/graph/${sid}/nodes`),
      staleTime: 60_000,
    }),
  edges: (sid: string) =>
    queryOptions({
      queryKey: ['graph', sid, 'edges'] as const,
      queryFn: () => api.get<GraphEdge[]>(`/graph/${sid}/edges`),
      staleTime: 5 * 60_000,
    }),
};

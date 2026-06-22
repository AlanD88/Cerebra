import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ConceptDetail, Dependency, Insight, RecallCard } from './types';

// One core query + three satellites (concept-page-frontend.md §2/§4).
export const conceptQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: ['concept', id] as const,
      queryFn: () => api.get<ConceptDetail>(`/concepts/${id}`),
      staleTime: 60_000,
    }),
  recall: (id: string) =>
    queryOptions({
      queryKey: ['concept', id, 'recall'] as const,
      queryFn: () => api.get<RecallCard>(`/concepts/${id}/recall`),
      staleTime: 30_000,
    }),
  deps: (id: string) =>
    queryOptions({
      queryKey: ['concept', id, 'deps'] as const,
      queryFn: () => api.get<Dependency[]>(`/concepts/${id}/dependencies`),
      staleTime: 5 * 60_000,
    }),
  insight: (id: string) =>
    queryOptions({
      queryKey: ['concept', id, 'insight'] as const,
      queryFn: () => api.get<Insight>(`/concepts/${id}/insight`),
      staleTime: 10 * 60_000,
      retry: 1,
    }),
};

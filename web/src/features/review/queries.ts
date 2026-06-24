import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ReviewSessionDto } from './types';

// The session queue is immutable once created (assess writes go through a
// mutation, not this query), so it never goes stale.
export const reviewQueries = {
  session: (id: string) =>
    queryOptions({
      queryKey: ['review', id] as const,
      queryFn: () => api.get<ReviewSessionDto>(`/review/${id}`),
      staleTime: Infinity, // the queue is fixed once the session is created
    }),
};

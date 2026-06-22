import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ReviewSessionDto } from './types';

export const reviewQueries = {
  session: (id: string) =>
    queryOptions({
      queryKey: ['review', id] as const,
      queryFn: () => api.get<ReviewSessionDto>(`/review/${id}`),
      staleTime: Infinity, // the queue is fixed once the session is created
    }),
};

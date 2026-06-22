import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  DueSummary,
  HeatRow,
  LearningHealth,
  RetentionTrends,
  SubjectProgressItem,
  WeakConcept,
} from './types';

// One query per card. Keys + staleTimes follow dashboard-frontend.md §4.
export const dashboardQueries = {
  dueSummary: () =>
    queryOptions({
      queryKey: ['dashboard', 'due-summary'] as const,
      queryFn: () => api.get<DueSummary>('/dashboard/due-summary'),
      staleTime: 30_000,
    }),
  weak: (limit = 5) =>
    queryOptions({
      queryKey: ['dashboard', 'weak', { limit }] as const,
      queryFn: () => api.get<WeakConcept[]>(`/concepts/weak?limit=${limit}`),
      staleTime: 60_000,
    }),
  retention: (days = 30) =>
    queryOptions({
      queryKey: ['dashboard', 'retention', { days }] as const,
      queryFn: () => api.get<RetentionTrends>(`/dashboard/retention?days=${days}`),
      staleTime: 5 * 60_000,
    }),
  health: () =>
    queryOptions({
      queryKey: ['dashboard', 'health'] as const,
      queryFn: () => api.get<LearningHealth>('/dashboard/health'),
      staleTime: 60_000,
    }),
  heatmap: () =>
    queryOptions({
      queryKey: ['dashboard', 'heatmap'] as const,
      queryFn: () => api.get<HeatRow[]>('/dashboard/heatmap'),
      staleTime: 60_000,
    }),
  subjectProgress: () =>
    queryOptions({
      queryKey: ['dashboard', 'subject-progress'] as const,
      queryFn: () => api.get<SubjectProgressItem[]>('/subjects/progress'),
      staleTime: 60_000,
    }),
};

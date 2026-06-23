import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { readLocalPreferences } from './storage';
import type { Preferences } from './types';

export const PREFERENCES_KEY = ['preferences'] as const;

// Seeded from localStorage for an instant first paint, but `initialDataUpdatedAt: 0`
// marks that seed stale so the server row is still fetched and reconciled.
export const preferencesQuery = () =>
  queryOptions({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<Preferences>('/preferences'),
    staleTime: 5 * 60_000,
    initialData: readLocalPreferences,
    initialDataUpdatedAt: 0,
  });

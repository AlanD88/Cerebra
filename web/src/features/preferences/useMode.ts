import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PREFERENCES_KEY, preferencesQuery } from './queries';
import { writeLocalPreferences } from './storage';
import { DEFAULT_MODES, type Preferences, type Surface } from './types';

/**
 * Reads the active mode for one surface and returns an optimistic `setMode`
 * (polish-frontend.md §2). A preference is safe to be optimistic about — it is
 * presentation only, never a metric — so the toggle flips instantly and the
 * PATCH reconciles in the background, rolling back only on failure.
 */
export function useMode(surface: Surface): { mode: string; setMode: (next: string) => void } {
  const qc = useQueryClient();
  const { data } = useQuery(preferencesQuery());
  const mode = data?.modes?.[surface] ?? DEFAULT_MODES[surface];

  const mutation = useMutation({
    mutationFn: (next: string) =>
      api.patch<Preferences>('/preferences', { modes: { [surface]: next } }),
    onMutate: async (next) => {
      const prev = qc.getQueryData<Preferences>(PREFERENCES_KEY);
      const optimistic: Preferences = {
        modes: { ...DEFAULT_MODES, ...(prev?.modes ?? {}), [surface]: next },
      };
      // Apply the optimistic flip first (presentation is safe to be eager),
      // then cancel any in-flight GET so it can't clobber the new value.
      qc.setQueryData(PREFERENCES_KEY, optimistic);
      writeLocalPreferences(optimistic);
      await qc.cancelQueries({ queryKey: PREFERENCES_KEY });
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(PREFERENCES_KEY, ctx.prev);
        writeLocalPreferences(ctx.prev);
      }
    },
    onSuccess: (server) => {
      qc.setQueryData(PREFERENCES_KEY, server);
      writeLocalPreferences(server);
    },
  });

  const setMode = useCallback((next: string) => mutation.mutate(next), [mutation]);
  return { mode, setMode };
}

import { QueryClient, keepPreviousData } from '@tanstack/react-query';

// Projections only change when the projection job runs (after a review), so reads
// can be generous with staleTime (dashboard-frontend.md §4).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 2,
      placeholderData: keepPreviousData,
    },
  },
});

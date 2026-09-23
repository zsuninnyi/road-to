import { createApiClient, type MeResponse } from '@road-to/api-client';
import { queryOptions } from '@tanstack/react-query';

export const api = createApiClient({ baseUrl: '/api' });

export const meQueryKey = ['me'] as const;

export function meQueryOptions() {
  return queryOptions({
    queryKey: meQueryKey,
    queryFn: async (): Promise<MeResponse | null> => {
      try {
        return await api.me();
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

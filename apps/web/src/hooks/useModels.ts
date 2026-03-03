import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ModelsResponse } from '@conduit/shared';

export function useModelsQuery(instanceId?: string) {
  return useQuery({
    queryKey: ['models', instanceId],
    queryFn: () => api.get<ModelsResponse>(`/models?instanceId=${encodeURIComponent(instanceId!)}`),
    enabled: !!instanceId,
    // Don't retry on 404 (instance not found or no models synced yet)
    retry: (failureCount, error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });
}

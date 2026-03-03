import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ConfigSnapshot {
  instanceId: string;
  agentType: string;
  content: unknown;
  updatedAt: string;
}

export function useConfigQuery(instanceId?: string) {
  const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
  return useQuery({
    queryKey: ['config', instanceId ?? 'latest'],
    queryFn: () => api.get<ConfigSnapshot>(`/config${params}`),
    // Don't throw — let callers handle 404 gracefully
    retry: (failureCount, error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404) return false;
      return failureCount < 2;
    },
    staleTime: 30_000,
  });
}

export function useConfigPatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, instanceId }: { content: string; instanceId?: string }) =>
      api.patch<{ message: string; instanceId: string }>('/config', {
        content,
        ...(instanceId ? { instanceId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

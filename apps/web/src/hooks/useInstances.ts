import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Instance, InstanceListResponse } from '@conduit/shared';
import { useInstanceStore } from '@/store/instances';

export function useInstancesQuery() {
  return useQuery({
    queryKey: ['instances'],
    queryFn: async () => {
      const data = await api.get<InstanceListResponse>('/instances');
      // Only update Zustand if the data actually changed to avoid unnecessary re-renders
      const current = useInstanceStore.getState().instances;
      const incoming = data.instances;
      if (
        incoming.length !== current.length ||
        JSON.stringify(incoming) !== JSON.stringify(current)
      ) {
        useInstanceStore.getState().setInstances(incoming);
      }
      return data;
    },
    // Poll every 10s so status updates from server health checks are reflected
    refetchInterval: 10_000,
  });
}

export function useCreateInstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: Instance['type']; url?: string }) =>
      api.post<{ instance: Instance }>('/instances', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });
}

export function useDeleteInstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/instances/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });
}

export function useTestInstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ status: string; latency: number }>(`/instances/${id}/test`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });
}

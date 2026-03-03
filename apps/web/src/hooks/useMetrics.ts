import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MetricsSummary, MetricsTimeSeries, MetricsDashboard } from '@conduit/shared';

export function useMetricsSummary() {
  return useQuery({
    queryKey: ['metrics', 'summary'],
    queryFn: () => api.get<MetricsSummary>('/metrics/summary'),
    refetchInterval: 10_000,
  });
}

export function useMetricsTimeSeries(metric: string, period: string) {
  return useQuery({
    queryKey: ['metrics', 'timeseries', metric, period],
    queryFn: () => {
      const params = new URLSearchParams({ metric, period });
      return api.get<MetricsTimeSeries>(`/metrics/timeseries?${params.toString()}`);
    },
    enabled: !!metric && !!period,
  });
}

export function useMetricsDashboard(period = '7d') {
  return useQuery({
    queryKey: ['metrics', 'dashboard', period],
    queryFn: () => {
      const params = new URLSearchParams({ period });
      return api.get<MetricsDashboard>(`/metrics/dashboard?${params.toString()}`);
    },
    refetchInterval: 10_000,
  });
}

export function useClearMetricsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ message: string }>('/metrics'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}

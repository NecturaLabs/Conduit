export interface MetricsSummary {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  avgSessionDuration: number;
  totalTokens: number;
  totalCost: number;
  periodStart: string;
  periodEnd: string;
}

export interface MetricsTimeSeries {
  timestamps: string[];
  values: number[];
  label: string;
  unit: string;
}

export interface MetricsDashboard {
  summary: MetricsSummary;
  sessionActivity: MetricsTimeSeries;
  toolUsage: MetricsTimeSeries;
  messageVolume: MetricsTimeSeries;
  tokenUsage: MetricsTimeSeries;
  costOverTime: MetricsTimeSeries;
}

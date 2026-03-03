import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InfoTip } from '@/components/ui/InfoTip';
import type { MetricsTimeSeries } from '@conduit/shared';

interface MetricsChartProps {
  title: string;
  description?: string;
  data: MetricsTimeSeries;
  color?: string;
  period?: string;
}

export function MetricsChart({ title, description, data, color, period }: MetricsChartProps) {
  const chartColor = color ?? 'var(--color-accent-solid)';

  const chartData = data.timestamps.map((ts, i) => {
    const d = new Date(ts);
    let label: string;
    if (period === '1h') {
      label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (period === '24h') {
      label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return { time: label, value: data.values[i] };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1">
          {title}
          {description && <InfoTip text={description} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full min-w-0" role="img" aria-label={`${title} chart showing ${data.label} over time. ${chartData.length} data points, unit: ${data.unit}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'var(--color-muted)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: 'var(--color-muted)' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={data.label}
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                dot={false}
                activeDot={{ r: 4, fill: chartColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-[var(--color-muted)] mt-2 text-right">
          Unit: {data.unit}
        </p>
      </CardContent>
    </Card>
  );
}

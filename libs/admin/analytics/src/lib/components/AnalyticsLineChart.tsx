import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface LineSeries {
  dataKey: string;
  name?: string;
  color?: string;
  strokeDasharray?: string;
}

export interface AnalyticsLineChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: LineSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string) => string;
  showLegend?: boolean;
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#64748b',
];

export function AnalyticsLineChart({
  data,
  xAxisKey,
  series,
  height = 300,
  valueFormatter = (val: number) => val.toLocaleString(),
  xAxisFormatter = (val: string) => val,
  showLegend = false,
}: AnalyticsLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
        <XAxis
          dataKey={xAxisKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fill: 'currentColor' }}
          className="text-muted-foreground"
          tickFormatter={xAxisFormatter}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fill: 'currentColor' }}
          className="text-muted-foreground"
          tickFormatter={valueFormatter}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card, 0 0% 100%))',
            borderColor: 'hsl(var(--border, 214.3 31.8% 91.4%))',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: '4px' }}
          formatter={(val: unknown) => [
            typeof val === 'number' ? valueFormatter(val) : String(val),
          ]}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />}
        {series.map((s, idx) => {
          const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
          return (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name || s.dataKey}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={s.strokeDasharray}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

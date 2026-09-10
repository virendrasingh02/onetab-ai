import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface AreaSeries {
  dataKey: string;
  name?: string;
  color?: string;
  fillOpacity?: number;
}

export interface AnalyticsAreaChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: AreaSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string) => string;
  showLegend?: boolean;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export function AnalyticsAreaChart({
  data,
  xAxisKey,
  series,
  height = 300,
  valueFormatter = (val: number) => val.toLocaleString(),
  xAxisFormatter = (val: string) => val,
  showLegend = false,
}: AnalyticsAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {series.map((s, idx) => {
            const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            return (
              <linearGradient
                key={s.dataKey}
                id={`area-gradient-${s.dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={s.fillOpacity ?? 0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            );
          })}
        </defs>
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
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name || s.dataKey}
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#area-gradient-${s.dataKey})`}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

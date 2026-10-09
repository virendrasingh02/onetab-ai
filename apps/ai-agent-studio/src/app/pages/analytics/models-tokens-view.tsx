import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import type { ModelAnalyticsRecord } from '@org/types';
import {
  Coins,
  Cpu,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

interface ModelsTokensViewProps {
  models: ModelAnalyticsRecord[];
}

const PIE_COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

export function ModelsTokensView({ models }: ModelsTokensViewProps) {
  const modelList = models || [];
  const totalTokens = modelList.reduce((acc, m) => acc + (m.totalTokens || 0), 0);
  const totalCost = modelList.reduce((acc, m) => acc + (m.totalCostUsd || (m as any).costUsd || 0), 0);

  const pieData = modelList.map((m) => ({
    name: m.model,
    value: m.totalTokens || 0,
  }));

  return (
    <div className="space-y-6">
      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Total Token Volume</span>
            <Zap className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalTokens.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Across {models.length} model architectures
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Total Model Cost</span>
            <Coins className="size-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            ${totalCost.toFixed(3)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            LLM provider inferences
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Active LLM Providers</span>
            <Cpu className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {new Set(models.map((m) => m.provider)).size}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            OpenAI, Anthropic, Google, DeepSeek
          </div>
        </Card>
      </div>

      {/* CHART + TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Token Distribution</h3>
            <p className="text-xs text-muted-foreground">Share of tokens by model</p>
          </div>

          <div className="h-52 w-full my-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1 text-xs border-t border-border pt-3">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {d.name}
                </span>
                <span className="font-semibold text-muted-foreground">
                  {totalTokens > 0 ? ((d.value / totalTokens) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-2xs lg:col-span-2">
          <div className="text-xs font-semibold text-foreground mb-4">
            Model Performance & Invocations Telemetry
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-raised/50 text-[11px]">
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Invocations</TableHead>
                  <TableHead>Input Tokens</TableHead>
                  <TableHead>Output Tokens</TableHead>
                  <TableHead>Avg Latency</TableHead>
                  <TableHead>Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No model inferences recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  models.map((m) => (
                    <TableRow key={m.model} className="hover:bg-surface-raised/50 text-xs">
                      <TableCell className="font-mono font-semibold text-foreground">
                        {m.model}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {m.provider}
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold">
                        {m.requestCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {m.inputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {m.outputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {Math.round(m.avgLatencyMs)}ms
                      </TableCell>
                      <TableCell className="tabular-nums font-medium text-foreground">
                        ${m.totalCostUsd.toFixed(3)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

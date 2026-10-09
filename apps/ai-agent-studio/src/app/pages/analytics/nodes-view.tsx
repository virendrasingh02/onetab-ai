import { useState, useMemo } from 'react';
import {
  Badge,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import type { NodeAnalyticsRecord } from '@org/types';
import {
  Clock,
  Coins,
  Layers,
  Search,
  Zap,
} from 'lucide-react';

interface NodesViewProps {
  nodes: NodeAnalyticsRecord[];
}

export function NodesView({ nodes }: NodesViewProps) {
  const [search, setSearch] = useState('');

  const nodeList = useMemo(() => {
    return (nodes || []).map((n) => ({
      ...n,
      executionCount: (n as any).executionCount ?? n.invocations ?? 0,
      estimatedCost: Number((n as any).estimatedCost ?? n.costUsd ?? 0),
      errorRate: Number((n as any).errorRate ?? (100 - (n.successRate ?? 100))),
      avgDurationMs: n.avgDurationMs ?? 0,
      p95DurationMs: n.p95DurationMs ?? 0,
      totalTokens: n.totalTokens ?? 0,
      retryCount: n.retryCount ?? 0,
    }));
  }, [nodes]);

  const filtered = useMemo(() => {
    return nodeList.filter((n) =>
      (n.nodeType || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [nodeList, search]);

  const slowest = useMemo(() => {
    return [...nodeList].sort((a, b) => b.avgDurationMs - a.avgDurationMs)[0];
  }, [nodeList]);

  const mostExpensive = useMemo(() => {
    return [...nodeList].sort((a, b) => b.estimatedCost - a.estimatedCost)[0];
  }, [nodeList]);

  const highestFailures = useMemo(() => {
    return [...nodeList].sort((a, b) => b.errorRate - a.errorRate)[0];
  }, [nodeList]);

  return (
    <div className="space-y-6">
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Slowest Node Type</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground font-mono">
            {slowest?.nodeType || 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {Math.round(slowest?.avgDurationMs || 0)}ms avg latency
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Highest Cost Node</span>
            <Coins className="size-4 text-violet-500" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground font-mono">
            {mostExpensive?.nodeType || 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ${mostExpensive?.estimatedCost.toFixed(3) || '0.00'} total cost
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Highest Failure Node</span>
            <Layers className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-base font-bold text-foreground font-mono">
            {highestFailures?.nodeType || 'N/A'}
          </div>
          <div className="text-xs text-rose-500 mt-0.5 font-medium">
            {highestFailures?.errorRate.toFixed(1) || 0}% error rate
          </div>
        </Card>
      </div>

      {/* TABLE */}
      <Card className="p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by node type (e.g. LLM, TOOL, PROMPT)..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised/50 text-[11px]">
                <TableHead>Node Category / Type</TableHead>
                <TableHead>Total Invocations</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Latency (Avg / p95)</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Retries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No node telemetry recorded in this period.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.nodeType} className="hover:bg-surface-raised/50 text-xs">
                    <TableCell className="font-mono font-semibold text-foreground">
                      {item.nodeType}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {item.executionCount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.successRate >= 95
                            ? 'success'
                            : item.successRate >= 80
                            ? 'warning'
                            : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {item.successRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span>{Math.round(item.avgDurationMs)}ms</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        / {Math.round(item.p95DurationMs)}ms
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {item.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      ${item.estimatedCost.toFixed(3)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {item.retryCount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

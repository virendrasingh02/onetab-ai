import { useState, useMemo } from 'react';
import {
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import type { WorkflowAnalyticsProfile } from '@org/types';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Eye,
  GitBranch,
  Layers,
  Search,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WorkflowsViewProps {
  workflows: WorkflowAnalyticsProfile[];
  onSelectWorkflow?: (workflowId: string) => void;
}

export function WorkflowsView({ workflows, onSelectWorkflow }: WorkflowsViewProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedWf, setSelectedWf] = useState<NormalizedWorkflow | null>(null);

  const normalizedWorkflows = useMemo(
    () =>
      workflows.map((wf) => ({
        ...wf,
        workflowName: wf.name || 'Workflow',
        avgDurationMs: wf.avgLatencyMs,
        latencyPercentiles: { p95: wf.p95LatencyMs, p99: wf.p99LatencyMs },
        estimatedCost: wf.totalCostUsd,
        costPerSuccessfulExecution: wf.costPerSuccessfulExecutionUsd,
        mostCommonFailurePoints: wf.commonFailurePoints,
        slowestNodes: wf.slowestNodes.map((n) => ({
          nodeId: n.stepId || n.nodeType,
          avgDurationMs: n.avgLatencyMs,
        })),
        mostExpensiveNodes: wf.expensiveNodes.map((n) => ({
          nodeId: n.stepId || n.nodeType,
          cost: n.costUsd,
        })),
      })),
    [workflows],
  );
  type NormalizedWorkflow = (typeof normalizedWorkflows)[number];

  const filtered = useMemo(() => {
    return normalizedWorkflows.filter(
      (w) =>
        w.workflowName.toLowerCase().includes(search.toLowerCase()) ||
        w.workflowId.toLowerCase().includes(search.toLowerCase()),
    );
  }, [normalizedWorkflows, search]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: WORKFLOW CARDS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Active Workflows</span>
            <GitBranch className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {normalizedWorkflows.length}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Orchestrated in this workspace
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Overall Workflow Volume</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {normalizedWorkflows.reduce((acc, w) => acc + (w.totalExecutions ?? 0), 0).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Total graph runs
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Average Success Rate</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {normalizedWorkflows.length > 0
              ? (
                  normalizedWorkflows.reduce((acc, w) => acc + (w.successRate ?? 0), 0) / normalizedWorkflows.length
                ).toFixed(1)
              : 100}
            %
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Across all workflow pipelines
          </div>
        </Card>
      </div>

      {/* SECTION 2: WORKFLOWS TABLE */}
      <Card className="p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflows by title or ID..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised/50 text-[11px]">
                <TableHead>Workflow</TableHead>
                <TableHead>Total Runs</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Latency (Avg / p95)</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Cost / Success</TableHead>
                <TableHead>Failure Point</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No workflows found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((wf) => (
                  <TableRow
                    key={wf.workflowId}
                    className="cursor-pointer hover:bg-surface-raised/50 text-xs"
                    onClick={() => setSelectedWf(wf)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                          <GitBranch className="size-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {wf.workflowName}
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              v{wf.version}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {wf.workflowId.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {wf.totalExecutions.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          wf.successRate >= 95
                            ? 'success'
                            : wf.successRate >= 80
                            ? 'warning'
                            : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {wf.successRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span>{Math.round(wf.avgDurationMs)}ms</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        / {Math.round(wf.latencyPercentiles.p95)}ms
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      ${wf.estimatedCost.toFixed(3)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      ${wf.costPerSuccessfulExecution.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {wf.mostCommonFailurePoints?.[0] ? (
                        <span className="text-xs text-rose-500 font-mono">
                          {wf.mostCommonFailurePoints[0].nodeType}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-500">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agents/${wf.workflowId}`);
                          }}
                          className="h-7 px-2 text-xs gap-1"
                          title="Open in Visual Builder"
                        >
                          <ExternalLink className="size-3" />
                          Canvas
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* SELECTED WORKFLOW DETAIL PANEL */}
      {selectedWf && (
        <Card className="p-5 shadow-2xs border-primary/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <div>
                <h4 className="font-bold text-foreground text-sm">
                  {selectedWf.workflowName} — Node Performance Breakdown
                </h4>
                <p className="text-xs text-muted-foreground">
                  Detailed step latencies and failure points for this graph
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/agents/${selectedWf.workflowId}`)}
              className="text-xs gap-1.5"
            >
              <ExternalLink className="size-3.5" />
              Open Visual Canvas
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Slowest Nodes */}
            <div className="p-3 rounded-lg border border-border bg-surface-raised space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-500" />
                Slowest Graph Nodes
              </span>
              <div className="space-y-1.5">
                {!selectedWf.slowestNodes?.length ? (
                  <div className="text-xs text-muted-foreground">No node latency bottlenecks.</div>
                ) : (
                  selectedWf.slowestNodes.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs p-1.5 rounded bg-surface border border-border"
                    >
                      <span className="font-mono text-foreground">{n.nodeId}</span>
                      <span className="font-medium text-amber-500">
                        {Math.round(n.avgDurationMs)}ms
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Most Expensive Nodes */}
            <div className="p-3 rounded-lg border border-border bg-surface-raised space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Coins className="size-3.5 text-violet-500" />
                Highest Token / Cost Nodes
              </span>
              <div className="space-y-1.5">
                {!selectedWf.mostExpensiveNodes?.length ? (
                  <div className="text-xs text-muted-foreground">No high-cost nodes.</div>
                ) : (
                  selectedWf.mostExpensiveNodes.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs p-1.5 rounded bg-surface border border-border"
                    >
                      <span className="font-mono text-foreground">{n.nodeId}</span>
                      <span className="font-medium text-foreground">${n.cost.toFixed(4)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

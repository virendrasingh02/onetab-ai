import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { cn } from '@org/utils';
import type { AgentAnalyticsProfile } from '@org/types';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  GitBranch,
  Layers,
  Sparkles,
  ThumbsUp,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface AgentDetailDrawerProps {
  agent: AgentAnalyticsProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenExecution?: (executionId: string) => void;
}

type TabType =
  | 'overview'
  | 'executions'
  | 'performance'
  | 'tools'
  | 'models'
  | 'costs'
  | 'quality'
  | 'versions'
  | 'errors';

export function AgentDetailDrawer({
  agent: rawAgent,
  isOpen,
  onClose,
  onOpenExecution,
}: AgentDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (!rawAgent) return null;

  // Execution volume per day, from the recent runs the API returns.
  const runsByDay = new Map<string, number>();
  for (const exec of rawAgent.recentExecutions) {
    const day = exec.startedAt.slice(0, 10);
    runsByDay.set(day, (runsByDay.get(day) ?? 0) + 1);
  }

  const agent = {
    ...rawAgent,
    agentName: rawAgent.name || 'Agent',
    estimatedCost: rawAgent.totalCostUsd,
    costPerSuccessfulTask: rawAgent.costPerSuccessfulTaskUsd,
    humanInterventionRate: rawAgent.approvalRatePct,
    evaluationScore: rawAgent.feedbackScore,
    failureCount: Math.round((rawAgent.failureRate / 100) * rawAgent.executionCount),
    usageOverTime: [...runsByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, runs]) => ({ date, runs })),
    latencyPercentiles: {
      p50: rawAgent.medianLatencyMs,
      avg: rawAgent.avgLatencyMs,
      p95: rawAgent.p95LatencyMs,
      p99: rawAgent.p99LatencyMs,
    },
    topTools: rawAgent.toolsUsed.map((tool) => ({
      toolName: tool.name,
      invocations: tool.calls,
      successRate: tool.successRate,
      avgLatencyMs: tool.avgLatencyMs,
    })),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-surface-raised/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Bot className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  {agent.agentName}
                  <Badge variant="outline" className="text-[10px]">
                    v{agent.version}
                  </Badge>
                  <Badge
                    variant={agent.status === 'PUBLISHED' ? 'success' : 'secondary'}
                    className="text-[10px]"
                  >
                    {agent.status}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ID: <span className="font-mono">{agent.agentId}</span>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="size-8 p-0">
              <X className="size-4" />
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-border/60 mt-4 pt-2 overflow-x-auto">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'executions', label: 'Executions' },
                { id: 'performance', label: 'Performance' },
                { id: 'tools', label: 'Tools & Connectors' },
                { id: 'models', label: 'Models' },
                { id: 'costs', label: 'Costs' },
                { id: 'quality', label: 'Quality & Eval' },
                { id: 'versions', label: 'Versions' },
                { id: 'errors', label: 'Errors' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors shrink-0',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Tab Content Body */}
        <DialogBody className="p-5 overflow-y-auto space-y-5">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 bg-surface-raised">
                  <div className="text-[11px] text-muted-foreground">Total Invocations</div>
                  <div className="mt-1 text-xl font-bold text-foreground">
                    {agent.executionCount.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-3 bg-surface-raised">
                  <div className="text-[11px] text-muted-foreground">Success Rate</div>
                  <div className="mt-1 text-xl font-bold text-emerald-500">
                    {agent.successRate.toFixed(1)}%
                  </div>
                </Card>
                <Card className="p-3 bg-surface-raised">
                  <div className="text-[11px] text-muted-foreground">Average Latency</div>
                  <div className="mt-1 text-xl font-bold text-foreground">
                    {Math.round(agent.avgLatencyMs)}ms
                  </div>
                </Card>
                <Card className="p-3 bg-surface-raised">
                  <div className="text-[11px] text-muted-foreground">Estimated Spend</div>
                  <div className="mt-1 text-xl font-bold text-foreground">
                    ${agent.estimatedCost.toFixed(3)}
                  </div>
                </Card>
              </div>

              {/* Usage trend chart */}
              <Card className="p-4">
                <div className="text-xs font-semibold text-foreground mb-2">
                  Execution Volume Over Time
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={agent.usageOverTime}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(val) => (typeof val === 'string' ? val.slice(5) : val)}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="runs"
                        name="Executions"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Quick details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border bg-surface-raised space-y-1.5">
                  <span className="font-semibold text-foreground">Configuration & Runtime</span>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Model:</span>
                    <strong className="text-foreground">{agent.model}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Provider:</span>
                    <strong className="text-foreground">{agent.provider}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Retries / Timeouts:</span>
                    <strong className="text-foreground">
                      {agent.retryCount} / {agent.timeoutCount}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-surface-raised space-y-1.5">
                  <span className="font-semibold text-foreground">Governance & Humans</span>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Intervention Rate:</span>
                    <strong className="text-foreground">
                      {agent.humanInterventionRate.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Approval Requests:</span>
                    <strong className="text-foreground">{agent.approvalCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTIONS */}
          {activeTab === 'executions' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground">
                Recent Runs for this Agent ({agent.recentExecutions?.length || 0})
              </div>
              <div className="space-y-2">
                {!agent.recentExecutions?.length ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    No recorded executions in this time window.
                  </div>
                ) : (
                  agent.recentExecutions.map((exec) => (
                    <div
                      key={exec.id}
                      onClick={() => onOpenExecution?.(exec.id)}
                      className="p-3 rounded-lg border border-border bg-surface-raised hover:border-primary/40 transition-colors flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            exec.status === 'SUCCESS' || exec.status === 'succeeded'
                              ? 'success'
                              : exec.status === 'FAILED' || exec.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {exec.status}
                        </Badge>
                        <span className="font-mono font-medium text-foreground">
                          {exec.id.slice(0, 12)}...
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(exec.startedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>{exec.tokensUsed.toLocaleString()} tokens</span>
                        <span>{exec.latencyMs}ms</span>
                        <span>${exec.totalCost.toFixed(4)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                    p50 (Median)
                  </div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {Math.round(agent.latencyPercentiles.p50)}ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                    avg
                  </div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {Math.round(agent.latencyPercentiles.avg)}ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                    p95
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-500">
                    {Math.round(agent.latencyPercentiles.p95)}ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                    p99
                  </div>
                  <div className="mt-1 text-lg font-bold text-rose-500">
                    {Math.round(agent.latencyPercentiles.p99)}ms
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-surface-raised space-y-2 text-xs">
                <div className="font-semibold text-foreground">Latency Analysis</div>
                <p className="text-muted-foreground">
                  Mean turn execution speed is {Math.round(agent.avgLatencyMs)}ms with p99 ceiling at{' '}
                  {Math.round(agent.latencyPercentiles.p99)}ms.
                  {agent.latencyPercentiles.p99 > 8000
                    ? ' High latency variance detected during tool execution or complex multi-step reasoning.'
                    : ' Runtime is consistently within healthy responsiveness thresholds.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: TOOLS */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground">
                Tools & Connectors Utilized by {agent.agentName}
              </div>
              <div className="space-y-2">
                {!agent.topTools?.length ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    No tools invoked by this agent yet.
                  </div>
                ) : (
                  agent.topTools.map((tool, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border bg-surface-raised flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="size-4 text-primary" />
                        <span className="font-semibold text-foreground">{tool.toolName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{tool.invocations} calls</span>
                        <Badge
                          variant={tool.successRate >= 95 ? 'success' : 'warning'}
                          className="text-[10px]"
                        >
                          {tool.successRate.toFixed(1)}% success
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MODELS */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-surface-raised space-y-2 text-xs">
                <div className="font-semibold text-foreground">Primary Model Configuration</div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Model Identifier:</span>
                  <span className="font-mono text-foreground font-semibold">{agent.model}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Provider:</span>
                  <span className="text-foreground">{agent.provider}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Input Tokens:</span>
                  <span className="text-foreground">{agent.inputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Output Tokens:</span>
                  <span className="text-foreground">{agent.outputTokens.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: COSTS */}
          {activeTab === 'costs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[11px] text-muted-foreground">Total Incurred Cost</div>
                  <div className="mt-1 text-xl font-bold text-foreground">
                    ${agent.estimatedCost.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[11px] text-muted-foreground">Cost per Successful Task</div>
                  <div className="mt-1 text-xl font-bold text-emerald-500">
                    ${agent.costPerSuccessfulTask.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: QUALITY */}
          {activeTab === 'quality' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[11px] text-muted-foreground">User Evaluation Rating</div>
                  <div className="mt-1 text-xl font-bold text-primary">
                    {agent.evaluationScore != null
                      ? `${agent.evaluationScore.toFixed(1)} / 5.0`
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: VERSIONS */}
          {activeTab === 'versions' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground">Version History</div>
              <div className="space-y-2">
                {agent.versionHistory.map((v) => (
                  <div
                    key={v.version}
                    className="p-3 rounded-lg border border-border bg-surface-raised flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-foreground mr-2">v{v.version}</span>
                      <span className="text-muted-foreground">{(v.successRate).toFixed(1)}% success</span>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{v.runs} runs</span>
                      <span>{v.successRate.toFixed(1)}% success</span>
                      <span>{Math.round(v.avgLatencyMs)}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: ERRORS */}
          {activeTab === 'errors' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground">Error Statistics</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold">Failed Runs</div>
                  <div className="mt-1 text-lg font-bold text-rose-500">
                    {agent.failureCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold">Timeouts</div>
                  <div className="mt-1 text-lg font-bold text-amber-500">
                    {agent.timeoutCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-raised border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold">Retries</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {agent.retryCount}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

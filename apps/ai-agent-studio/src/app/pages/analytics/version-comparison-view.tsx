import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Input,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import type { VersionComparisonResult, AgentAnalyticsProfile } from '@org/types';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  GitBranch,
  GitCompare,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService.js';
import { useStudioSession } from '../../session-guard.js';

interface VersionComparisonViewProps {
  agents: AgentAnalyticsProfile[];
}

export function VersionComparisonView({ agents }: VersionComparisonViewProps) {
  const { activeWorkspace } = useStudioSession();
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.agentId || '');
  const [versionA, setVersionA] = useState(1);
  const [versionB, setVersionB] = useState(2);

  const selectedAgent = agents.find((a) => a.agentId === selectedAgentId);

  const { data: comparison, isLoading, refetch } = useQuery({
    queryKey: [
      'version-comparison',
      activeWorkspace.id,
      selectedAgentId,
      versionA,
      versionB,
    ],
    queryFn: () =>
      analyticsService.compareVersions(activeWorkspace.id, {
        entityType: 'AGENT',
        entityId: selectedAgentId,
        versionA,
        versionB,
      }),
    enabled: Boolean(activeWorkspace.id && selectedAgentId),
  });

  return (
    <div className="space-y-6">
      {/* SELECTION BAR */}
      <Card className="p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GitCompare className="size-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Agent Version Telemetry Comparison
              </h3>
              <p className="text-xs text-muted-foreground">
                Compare execution cohorts across revisions to detect regressions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="h-8 px-2.5 rounded-md border border-border bg-surface text-xs text-foreground"
            >
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {a.name || a.agentId}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Compare v</span>
              <input
                type="number"
                min={1}
                value={versionA}
                onChange={(e) => setVersionA(Number(e.target.value))}
                className="w-12 h-8 px-2 rounded-md border border-border bg-surface text-center font-mono text-xs text-foreground"
              />
              <span>with v</span>
              <input
                type="number"
                min={1}
                value={versionB}
                onChange={(e) => setVersionB(Number(e.target.value))}
                className="w-12 h-8 px-2 rounded-md border border-border bg-surface text-center font-mono text-xs text-foreground"
              />
            </div>

            <Button variant="secondary" size="sm" onClick={() => void refetch()} className="h-8 text-xs">
              Compare
            </Button>
          </div>
        </div>
      </Card>

      {/* COMPARISON RESULTS */}
      {isLoading ? (
        <LoadingState label="Computing comparative execution telemetry..." />
      ) : !comparison ? (
        <Card className="p-12 text-center text-xs text-muted-foreground">
          Select an agent and versions above to compare metrics side-by-side.
        </Card>
      ) : (
        <div className="space-y-6">
          {/* REGRESSION DETECTION BANNER */}
          {comparison.regressions.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-1">
              <span className="font-semibold text-xs text-amber-500">
                Regressions Detected in Version {versionB}:
              </span>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                {comparison.regressions.map((reg, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{reg.metric}</span> ({reg.severity}):{' '}
                    {reg.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comparison.sampleSizeWarning && (
            <div className="p-3 rounded-lg border border-border bg-surface-raised text-xs text-muted-foreground">
              Few runs recorded for one or both versions — treat these differences as indicative only.
            </div>
          )}

          {/* SIDE BY SIDE TABLE */}
          <Card className="p-5 shadow-2xs">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-raised/50 text-[11px]">
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-center">Version {comparison.versionA.version}</TableHead>
                    <TableHead className="text-center">Version {comparison.versionB.version}</TableHead>
                    <TableHead className="text-right">Net Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  <TableRow>
                    <TableCell className="font-semibold">Execution Runs</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {comparison.versionA.runCount}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {comparison.versionB.runCount}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {comparison.versionB.runCount - comparison.versionA.runCount}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-semibold">Success Rate</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {comparison.versionA.successRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {comparison.versionB.successRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        variant={
                          comparison.diff.successRateDelta >= 0 ? 'success' : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {comparison.diff.successRateDelta >= 0 ? '+' : ''}
                        {comparison.diff.successRateDelta.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-semibold">Average Latency</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {Math.round(comparison.versionA.avgLatencyMs)}ms
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {Math.round(comparison.versionB.avgLatencyMs)}ms
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        variant={
                          comparison.diff.latencyDeltaPct <= 0 ? 'success' : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {comparison.diff.latencyDeltaPct >= 0 ? '+' : ''}
                        {comparison.diff.latencyDeltaPct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-semibold">Average Tokens per Run</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {Math.round(comparison.versionA.avgTokens)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {Math.round(comparison.versionB.avgTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        variant={
                          comparison.diff.tokensDeltaPct <= 0 ? 'success' : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {comparison.diff.tokensDeltaPct >= 0 ? '+' : ''}
                        {comparison.diff.tokensDeltaPct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-semibold">Average Cost per Run</TableCell>
                    <TableCell className="text-center tabular-nums">
                      ${comparison.versionA.avgCostUsd.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      ${comparison.versionB.avgCostUsd.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge
                        variant={
                          comparison.diff.costDeltaPct <= 0 ? 'success' : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {comparison.diff.costDeltaPct >= 0 ? '+' : ''}
                        {comparison.diff.costDeltaPct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

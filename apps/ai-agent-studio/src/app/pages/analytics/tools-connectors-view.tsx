import { useState } from 'react';
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
import type { ConnectorAnalyticsRecord } from '@org/types';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Link2,
  Plug,
  Wrench,
  Zap,
} from 'lucide-react';

interface ToolsConnectorsViewProps {
  data: {
    tools: any[];
    connectors: ConnectorAnalyticsRecord[];
  };
}

export function ToolsConnectorsView({ data }: ToolsConnectorsViewProps) {
  const [activeTab, setActiveTab] = useState<'tools' | 'connectors'>('connectors');
  const { tools = [], connectors = [] } = data || {};

  return (
    <div className="space-y-6">
      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('connectors')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'connectors'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plug className="size-3.5" />
          App Connectors ({connectors.length})
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'tools'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wrench className="size-3.5" />
          Built-in & Custom Tools ({tools.length})
        </button>
      </div>

      {activeTab === 'connectors' ? (
        <Card className="p-5 shadow-2xs">
          <div className="text-xs font-semibold text-foreground mb-4">
            Integration Connectors Health & Execution Reliability
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-raised/50 text-[11px]">
                  <TableHead>Connector Name</TableHead>
                  <TableHead>App Type</TableHead>
                  <TableHead>Invocations</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Avg Latency</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Health Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No external connector invocations recorded in this window.
                    </TableCell>
                  </TableRow>
                ) : (
                  connectors.map((c) => (
                    <TableRow key={c.connectorId} className="hover:bg-surface-raised/50 text-xs">
                      <TableCell className="font-semibold text-foreground">
                        {c.name}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {c.provider}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {c.invocations.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.successRate >= 95 ? 'success' : 'warning'}
                          className="text-[10px]"
                        >
                          {c.successRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {Math.round(c.avgLatencyMs)}ms
                      </TableCell>
                      <TableCell className="tabular-nums font-medium text-rose-500">
                        {c.timeouts + c.authFailures + c.rateLimits}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.lastErrorAt ? 'destructive' : 'success'}
                          className="text-[10px]"
                          title={c.lastErrorMessage ?? undefined}
                        >
                          {c.lastErrorAt ? 'DEGRADED' : 'HEALTHY'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="p-5 shadow-2xs">
          <div className="text-xs font-semibold text-foreground mb-4">
            Tools Execution Latency & Fault Rate
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-raised/50 text-[11px]">
                  <TableHead>Tool Identifier</TableHead>
                  <TableHead>Execution Count</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Avg Duration</TableHead>
                  <TableHead>Failures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                      No tool executions logged in this time range.
                    </TableCell>
                  </TableRow>
                ) : (
                  tools.map((t) => (
                    <TableRow key={t.toolName} className="hover:bg-surface-raised/50 text-xs">
                      <TableCell className="font-mono font-semibold text-foreground">
                        {t.toolName}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {t.invocations.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.successRate >= 95 ? 'success' : 'warning'}
                          className="text-[10px]"
                        >
                          {t.successRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {Math.round(t.avgDurationMs)}ms
                      </TableCell>
                      <TableCell className="tabular-nums text-rose-500 font-medium">
                        {t.failedInvocations}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

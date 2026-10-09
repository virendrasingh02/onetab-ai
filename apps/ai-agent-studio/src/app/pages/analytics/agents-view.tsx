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
import type { AgentAnalyticsProfile } from '@org/types';
import {
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Eye,
  Search,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { AgentDetailDrawer } from './agent-detail-drawer.js';

interface AgentsViewProps {
  agents: AgentAnalyticsProfile[];
  onOpenExecution?: (executionId: string) => void;
}

export function AgentsView({ agents, onOpenExecution }: AgentsViewProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'runs' | 'success' | 'latency' | 'cost'>('runs');
  const [selectedAgent, setSelectedAgent] = useState<AgentAnalyticsProfile | null>(null);

  const filteredAgents = useMemo(() => {
    let list = (agents || []).filter(
      (a) =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.agentId || '').toLowerCase().includes(search.toLowerCase()),
    );

    return list.sort((a, b) => {
      const costA = a.totalCostUsd ?? 0;
      const costB = b.totalCostUsd ?? 0;
      if (sortBy === 'runs') return (b.executionCount ?? 0) - (a.executionCount ?? 0);
      if (sortBy === 'success') return (b.successRate ?? 0) - (a.successRate ?? 0);
      if (sortBy === 'latency') return (b.avgLatencyMs ?? 0) - (a.avgLatencyMs ?? 0);
      if (sortBy === 'cost') return costB - costA;
      return 0;
    });
  }, [agents, search, sortBy]);

  // Rankings
  const mostActive = useMemo(() => {
    return [...(agents || [])].sort((a, b) => (b.executionCount ?? 0) - (a.executionCount ?? 0))[0];
  }, [agents]);

  const mostReliable = useMemo(() => {
    return [...(agents || [])].sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0))[0];
  }, [agents]);

  const mostExpensive = useMemo(() => {
    return [...(agents || [])].sort((a, b) => {
      const costA = a.totalCostUsd ?? 0;
      const costB = b.totalCostUsd ?? 0;
      return costB - costA;
    })[0];
  }, [agents]);

  const slowest = useMemo(() => {
    return [...(agents || [])].sort((a, b) => (b.avgLatencyMs ?? 0) - (a.avgLatencyMs ?? 0))[0];
  }, [agents]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: RANKING CARDS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Most Active Agent</span>
            <Bot className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-bold text-base text-foreground truncate">
            {mostActive?.name || 'None'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {(mostActive?.executionCount ?? 0).toLocaleString()} runs
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Most Reliable</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 font-bold text-base text-foreground truncate">
            {mostReliable?.name || 'None'}
          </div>
          <div className="text-xs text-emerald-500 mt-0.5 font-medium">
            {(mostReliable?.successRate ?? 100).toFixed(1)}% success
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Highest Spend</span>
            <Coins className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 font-bold text-base text-foreground truncate">
            {mostExpensive?.name || 'None'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ${Number(mostExpensive?.totalCostUsd ?? 0).toFixed(2)} total
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Highest Latency</span>
            <Clock className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 font-bold text-base text-foreground truncate">
            {slowest?.name || 'None'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {Math.round(slowest?.avgLatencyMs || 0)}ms average
          </div>
        </Card>
      </div>

      {/* SECTION 2: CONTROLS & TABLE */}
      <Card className="p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents by name or ID..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            {(
              [
                { id: 'runs', label: 'Volume' },
                { id: 'success', label: 'Success %' },
                { id: 'latency', label: 'Latency' },
                { id: 'cost', label: 'Cost' },
              ] as const
            ).map((item) => (
              <Button
                key={item.id}
                variant={sortBy === item.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSortBy(item.id)}
                className="text-xs h-8 px-2.5"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised/50 text-[11px]">
                <TableHead>Agent</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Avg / p95 Latency</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Top Tool</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No agents matching the search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => (
                  <TableRow
                    key={agent.agentId}
                    className="cursor-pointer hover:bg-surface-raised/50 text-xs"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Bot className="size-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {agent.name}
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              v{agent.version ?? 1}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {(agent.agentId || '').slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {(agent.executionCount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (agent.successRate ?? 100) >= 95
                            ? 'success'
                            : (agent.successRate ?? 100) >= 80
                            ? 'warning'
                            : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {(agent.successRate ?? 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span>{Math.round(agent.avgLatencyMs ?? 0)}ms</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        / {Math.round(agent.p95LatencyMs)}ms
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {((agent.inputTokens ?? 0) + (agent.outputTokens ?? 0)).toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      ${Number(agent.totalCostUsd ?? 0).toFixed(3)}
                    </TableCell>
                    <TableCell>
                      {agent.toolsUsed[0] ? (
                        <span className="text-xs text-foreground font-mono">
                          {agent.toolsUsed[0].name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgent(agent);
                        }}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Eye className="size-3" />
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* DETAIL DRAWER */}
      <AgentDetailDrawer
        agent={selectedAgent}
        isOpen={Boolean(selectedAgent)}
        onClose={() => setSelectedAgent(null)}
        onOpenExecution={onOpenExecution}
      />
    </div>
  );
}

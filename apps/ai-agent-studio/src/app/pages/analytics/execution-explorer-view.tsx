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
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ExecutionDetailDrawer } from './execution-detail-drawer.js';

interface ExecutionExplorerViewProps {
  executions: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onViewTrace?: (executionId: string) => void;
}

export function ExecutionExplorerView({
  executions,
  isLoading,
  onRefresh,
  onViewTrace,
}: ExecutionExplorerViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedExecution, setSelectedExecution] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return executions.filter((item) => {
      const idMatch = (item.id || '').toLowerCase().includes(search.toLowerCase());
      const nameMatch = (item.agentName || item.entityType || '')
        .toLowerCase()
        .includes(search.toLowerCase());
      const promptMatch = (item.promptText || '').toLowerCase().includes(search.toLowerCase());
      const matchesSearch = idMatch || nameMatch || promptMatch;

      if (!matchesSearch) return false;

      if (statusFilter !== 'ALL') {
        const itemStatus = (item.status || '').toUpperCase();
        if (statusFilter === 'SUCCESS' && itemStatus !== 'SUCCESS' && itemStatus !== 'SUCCEEDED')
          return false;
        if (statusFilter === 'FAILED' && itemStatus !== 'FAILED') return false;
        if (statusFilter === 'RUNNING' && itemStatus !== 'RUNNING') return false;
      }

      return true;
    });
  }, [executions, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* FILTER & SEARCH BAR */}
      <Card className="p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Run ID, agent title, or prompt..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {['ALL', 'SUCCESS', 'FAILED', 'RUNNING'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="text-xs h-8 px-2.5"
                >
                  {status}
                </Button>
              ))}
            </div>

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                loading={isLoading}
                className="h-8 px-2.5 text-xs gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* EXECUTIONS TABLE */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised/50 text-[11px]">
                <TableHead>Run ID</TableHead>
                <TableHead>Target Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
                    No execution records match the filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  const status = (item.status || '').toUpperCase();
                  const isSuccess = status === 'SUCCESS' || status === 'SUCCEEDED';
                  const isFailed = status === 'FAILED';
                  const duration = item.durationMs || 0;
                  const tokens = item.tokensUsed || 0;
                  const cost = item.cost || tokens * 0.000005;

                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-surface-raised/50 text-xs"
                      onClick={() => setSelectedExecution(item)}
                    >
                      <TableCell className="font-mono text-[11px] font-semibold text-foreground">
                        {item.id.slice(0, 10)}...
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {item.agentName || item.entityType || 'Workflow Run'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {item.promptText || 'Automation Dispatch'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isSuccess ? 'success' : isFailed ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {duration}ms
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {tokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        ${cost.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.triggerType || item.metadata?.triggerType || 'MANUAL'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        {new Date(item.executedAt || item.startedAt || 0).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExecution(item);
                          }}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Eye className="size-3" />
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* DETAIL DRAWER */}
      <ExecutionDetailDrawer
        execution={selectedExecution}
        isOpen={Boolean(selectedExecution)}
        onClose={() => setSelectedExecution(null)}
        onViewTrace={onViewTrace}
      />
    </div>
  );
}

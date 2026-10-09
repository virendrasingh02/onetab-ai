import { useState } from 'react';
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
  toast,
} from '@org/ui';
import type { AnalyticsAlertRule } from '@org/types';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService.js';
import { useStudioSession } from '../../session-guard.js';

interface AlertsAnomaliesViewProps {
  alerts: AnalyticsAlertRule[];
  onRefresh: () => void;
}

export function AlertsAnomaliesView({ alerts = [], onRefresh }: AlertsAnomaliesViewProps) {
  const alertList = alerts || [];
  const { activeWorkspace } = useStudioSession();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<AnalyticsAlertRule['metric']>('FAILURE_RATE');
  const [threshold, setThreshold] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast('Alert name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await analyticsService.createAlertRule(activeWorkspace.id, {
        name,
        metric,
        condition: 'GREATER_THAN',
        threshold,
        windowMinutes: 15,
      });
      toast('Alert rule created successfully');
      setName('');
      setShowCreateForm(false);
      onRefresh();
    } catch (err: any) {
      toast(err.message || 'Failed to create alert rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (alertId: string, status: 'RESOLVED' | 'ACKNOWLEDGED') => {
    try {
      await analyticsService.updateAlertStatus(activeWorkspace.id, alertId, status);
      toast(`Alert marked as ${status.toLowerCase()}`);
      onRefresh();
    } catch (err: any) {
      toast(err.message || 'Failed to update alert');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & NEW RULE ACTION */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            Active Observability Alerts & Anomaly Guards
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time metric thresholds protecting error rates, p95 latencies, and budget spend
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="text-xs gap-1.5"
        >
          <Plus className="size-3.5" />
          Create Alert Rule
        </Button>
      </div>

      {/* CREATE ALERT FORM */}
      {showCreateForm && (
        <Card className="p-5 shadow-2xs border-primary/40 space-y-4">
          <div className="text-xs font-semibold text-foreground">
            Configure New Telemetry Alert Guard
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Alert Rule Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High Error Rate Guard"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground">Target Metric</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as any)}
                className="mt-1 w-full h-8 px-2.5 rounded-md border border-border bg-surface text-xs text-foreground"
              >
                <option value="FAILURE_RATE">Failure Rate (%)</option>
                <option value="LATENCY_SPIKE">Latency Spike (ms)</option>
                <option value="BUDGET_THRESHOLD">Budget Threshold (%)</option>
                <option value="NODE_TIMEOUT">Node Timeouts</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground">Threshold Value</label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCreate}
              loading={isSubmitting}
              className="text-xs h-8"
            >
              Save Alert Rule
            </Button>
          </div>
        </Card>
      )}

      {/* RULES TABLE */}
      <Card className="p-5 shadow-2xs">
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised/50 text-[11px]">
                <TableHead>Rule Name</TableHead>
                <TableHead>Target Metric</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No alert rules configured.
                  </TableCell>
                </TableRow>
              ) : (
                alertList.map((rule) => {
                  const isFiring = rule.status === 'FIRING';

                  return (
                    <TableRow key={rule.id} className="hover:bg-surface-raised/50 text-xs">
                      <TableCell className="font-semibold text-foreground">
                        {rule.name}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {rule.metric}
                      </TableCell>
                      <TableCell className="tabular-nums font-mono text-muted-foreground">
                        &gt; {rule.threshold}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {rule.windowMinutes} min
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isFiring ? 'destructive' : 'success'}
                          className="text-[10px]"
                        >
                          {rule.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isFiring ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(rule.id, 'ACKNOWLEDGED')}
                              className="h-7 text-[10px] px-2"
                            >
                              Acknowledge
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleUpdateStatus(rule.id, 'RESOLVED')}
                              className="h-7 text-[10px] px-2"
                            >
                              Resolve
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Monitoring OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

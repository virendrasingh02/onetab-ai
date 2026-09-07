import type { ComplianceAuditLogView } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import {
  Clock,
  Eye,
  FileSpreadsheet,
  History,
  Lock,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useComplianceAuditLogs } from './use-compliance.js';

export function AuditLogView() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');

  const logsQuery = useComplianceAuditLogs(page, 20, {
    action: actionFilter === 'ALL' ? undefined : actionFilter,
    targetType: targetTypeFilter === 'ALL' ? undefined : targetTypeFilter,
  });

  const [inspectLog, setInspectLog] = useState<ComplianceAuditLogView | null>(
    null,
  );

  const logs = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / 20) || 1;

  if (logsQuery.isLoading && !logsQuery.data) {
    return (
      <Page>
        <LoadingState label="Loading compliance audit ledger…" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Compliance Audit Ledger"
        description="Immutable record of compliance checklist evaluations, rule alterations, release gate decisions, and administrative overrides."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => logsQuery.refetch()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      {/* Security notice */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="text-xs text-muted-foreground">
            <strong>Append-Only Audit Security:</strong> Every action taken within the compliance module is permanently recorded with actor identity, timestamp, and before/after metadata to satisfy SOC 2, ISO 27001, and App Store review requirements.
          </div>
        </CardContent>
      </Card>

      {/* Filter toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Filter by Action</Label>
              <Select
                value={actionFilter}
                onValueChange={(val) => {
                  setActionFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="CHECKLIST_ITEM_UPDATED">
                    Checklist Updated
                  </SelectItem>
                  <SelectItem value="RELEASE_GATE_OVERRIDE">
                    Release Override
                  </SelectItem>
                  <SelectItem value="REQUIREMENT_CREATED">
                    Requirement Created
                  </SelectItem>
                  <SelectItem value="REQUIREMENT_UPDATED">
                    Requirement Updated
                  </SelectItem>
                  <SelectItem value="ISSUE_RECORDED">Issue Recorded</SelectItem>
                  <SelectItem value="ISSUE_UPDATED">Issue Updated</SelectItem>
                  <SelectItem value="LEGAL_LINK_UPDATED">Legal Link</SelectItem>
                  <SelectItem value="PLATFORM_CREATED">
                    Platform Created
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Target Entity Type</Label>
              <Select
                value={targetTypeFilter}
                onValueChange={(val) => {
                  setTargetTypeFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Entities</SelectItem>
                  <SelectItem value="CHECKLIST_ITEM">Checklist Item</SelectItem>
                  <SelectItem value="RELEASE_GATE">Release Gate</SelectItem>
                  <SelectItem value="REQUIREMENT">Requirement</SelectItem>
                  <SelectItem value="ISSUE">Issue</SelectItem>
                  <SelectItem value="LEGAL_LINK">Legal Link</SelectItem>
                  <SelectItem value="PLATFORM">Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              Audit Ledger Records ({total})
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[180px]">Action</TableHead>
                  <TableHead className="w-[140px]">Target Type</TableHead>
                  <TableHead>Actor / Operator</TableHead>
                  <TableHead className="w-[90px] text-right">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <EmptyState
                        title="No audit events found"
                        description="Audit actions will appear here as compliance reviews and changes are executed."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action.includes('OVERRIDE')
                              ? 'destructive'
                              : log.action.includes('UPDATE')
                                ? 'default'
                                : 'secondary'
                          }
                          className="text-[10px] font-mono uppercase"
                        >
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.targetType}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {log.actorEmail || log.actorId || 'System Worker'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setInspectLog(log)}
                          title="Inspect JSON Payload"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspect JSON Details Dialog */}
      <Dialog
        open={!!inspectLog}
        onOpenChange={(open) => !open && setInspectLog(null)}
      >
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          {inspectLog && (
            <div>
              <DialogHeader>
                <DialogTitle>Audit Event Details</DialogTitle>
                <DialogDescription>
                  Event ID: <span className="font-mono">{inspectLog.id}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Action:</span>{' '}
                    <span className="font-semibold">{inspectLog.action}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Type:</span>{' '}
                    <span className="font-semibold">{inspectLog.targetType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actor ID:</span>{' '}
                    <span className="font-mono">{inspectLog.actorId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actor Email:</span>{' '}
                    <span>{inspectLog.actorEmail || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timestamp:</span>{' '}
                    <span>{new Date(inspectLog.createdAt).toISOString()}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-1 block">Audit Changes & Metadata</Label>
                  <pre className="p-3 bg-muted rounded-md font-mono text-[11px] overflow-x-auto max-h-60">
                    {JSON.stringify(inspectLog.details ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

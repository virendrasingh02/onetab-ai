import type { ComplianceAuditLogView } from '@org/types';
import {
  Button,
  Card,
  CardContent,
  CodeBlock,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
  EmptyState,
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
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  Lock,
  RefreshCw,
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
  const startEntry = total === 0 ? 0 : (page - 1) * 20 + 1;
  const endEntry = Math.min(page * 20, total);

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

      {/* Audit Log Table Container */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-5 sm:py-3.5 border-b border-border/40">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
              <History className="h-4 w-4 text-blue-500" />
              Audit Ledger Records
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified append-only event stream for SOC 2, ISO 27001, and App Store compliance
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-foreground">
            {total} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/40 hover:bg-transparent">
                <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight w-[180px]">Timestamp</TableHead>
                <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight w-[180px]">Action</TableHead>
                <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight w-[140px]">Target Type</TableHead>
                <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Actor / Operator</TableHead>
                <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight w-[90px] text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <EmptyState
                      title="No audit events found"
                      description="Audit actions will appear here as compliance reviews and changes are executed."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-3.5 px-5 font-mono text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-3.5 px-5">
                      <span
                        className={
                          log.action.includes('OVERRIDE')
                            ? 'inline-flex items-center rounded-full border border-rose-500/25 bg-rose-500/15 text-rose-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase'
                            : log.action.includes('UPDATE')
                            ? 'inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase'
                            : 'inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/15 text-blue-400 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase'
                        }
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-5 font-mono text-xs text-foreground">
                      {log.targetType}
                    </TableCell>
                    <TableCell className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          {log.actorEmail || log.actorId || 'System Worker'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 rounded-lg border border-border/60 hover:bg-muted/50"
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

        {/* Reference Image Footer Pagination */}
        <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing{' '}
            <span className="font-semibold text-foreground">{startEntry}</span>{' '}
            to{' '}
            <span className="font-semibold text-foreground">{endEntry}</span> of{' '}
            <span className="font-semibold text-foreground">{total}</span> entries
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="px-1 font-medium text-foreground">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

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

              <DialogBody className="space-y-3">
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
                  <CodeBlock
                    code={JSON.stringify(
                      {
                        previousValue: inspectLog.previousValue,
                        newValue: inspectLog.newValue,
                        reason: inspectLog.reason,
                        platform: inspectLog.platform,
                        country: inspectLog.country,
                        version: inspectLog.version,
                      },
                      null,
                      2,
                    )}
                    language="json"
                    variant="compact"
                    maxHeight="240px"
                  />
                </div>
              </DialogBody>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

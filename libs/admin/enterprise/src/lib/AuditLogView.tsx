import type { AdminAuditLogEntry } from '@org/types';
import {
  EmptyState,
  ErrorState,
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
import { formatDateTime, formatRelative } from '@org/utils';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useAuditLogs, useOrganizations } from './use-enterprise.js';

const ALL_ORGANIZATIONS = 'all';

export function AuditLogView() {
  const [organizationId, setOrganizationId] = useState(ALL_ORGANIZATIONS);
  const [page, setPage] = useState(1);

  const organizations = useOrganizations();
  const query = useAuditLogs(
    organizationId === ALL_ORGANIZATIONS ? undefined : organizationId,
    page,
  );

  const logs: AdminAuditLogEntry[] = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 25;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const startEntry = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endEntry = Math.min(page * pageSize, total);

  return (
    <Page>
      <PageHeader
        title="Audit trail"
        description="Immutable security events, SCIM syncs, SSO logins and permission changes."
        icon={<ShieldAlert />}
        accent="violet"
      />

      <div className="rounded-2xl border border-border/60 bg-card shadow-2xs overflow-hidden">
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-5 sm:py-3.5 border-b border-border/40">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
              Audit Events Ledger
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified append-only event stream for security compliance
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Select
              value={organizationId}
              onValueChange={(value) => {
                setOrganizationId(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="h-8 w-56 rounded-full border border-border/60 bg-background/50 text-xs px-3"
                aria-label="Filter by organisation"
              >
                <SelectValue placeholder="All organisations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ORGANIZATIONS}>
                  All organisations
                </SelectItem>
                {(organizations.data ?? []).map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {query.isLoading ? (
          <div className="py-12">
            <LoadingState label="Loading audit events…" />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <ErrorState
              title="Could not load the audit trail"
              description="The audit log is unavailable. Check that the API is reachable and that this account is a platform operator."
            />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShieldAlert />}
              title="No audit events"
              description={
                organizationId === ALL_ORGANIZATIONS
                  ? 'Security events, SCIM syncs and permission changes will appear here as they happen.'
                  : 'This organisation has no recorded events yet.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/40 hover:bg-transparent">
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Actor</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Action</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Target</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Organisation</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">IP Address</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-3.5 px-5 font-semibold text-foreground text-xs">
                      {log.actorEmail}
                    </TableCell>
                    <TableCell className="py-3.5 px-5">
                      <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/15 text-blue-400 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-5 text-muted-foreground text-xs font-mono">
                      {log.targetResource}
                    </TableCell>
                    <TableCell className="py-3.5 px-5 text-muted-foreground text-xs">
                      {log.organization.name}
                    </TableCell>
                    <TableCell className="py-3.5 px-5 text-xs font-mono text-muted-foreground">
                      {log.ipAddress ?? '—'}
                    </TableCell>
                    <TableCell
                      className="py-3.5 px-5 text-xs text-muted-foreground"
                      title={formatDateTime(log.createdAt)}
                    >
                      {formatRelative(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

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
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="px-1 font-medium text-foreground">
              Page {page} of {Math.max(1, lastPage)}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
              disabled={page >= lastPage}
              aria-label="Next page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}

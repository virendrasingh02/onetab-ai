import type { AdminAuditLogEntry } from '@org/types';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Panel,
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
import { ShieldAlert } from 'lucide-react';
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

  return (
    <Page>
      <PageHeader
        title="Audit trail"
        description="Immutable security events, SCIM syncs, SSO logins and permission changes."
        icon={<ShieldAlert />}
        accent="violet"
        actions={
          <Select
            value={organizationId}
            onValueChange={(value) => {
              setOrganizationId(value);
              // A filter change invalidates the cursor, not just the rows.
              setPage(1);
            }}
          >
            <SelectTrigger className="w-64" aria-label="Filter by organisation">
              <SelectValue />
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
        }
      />

      <Panel flush>
        {query.isLoading ? (
          <LoadingState label="Loading audit events…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load the audit trail"
            description="The audit log is unavailable. Check that the API is reachable and that this account is a platform operator."
          />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert />}
            title="No audit events"
            description={
              organizationId === ALL_ORGANIZATIONS
                ? 'Security events, SCIM syncs and permission changes will appear here as they happen.'
                : 'This organisation has no recorded events yet.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.actorEmail}</TableCell>
                  <TableCell className="text-xs font-mono text-accent-blue">
                    {log.action}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.targetResource}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.organization.name}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {log.ipAddress ?? '—'}
                  </TableCell>
                  {/* Relative for scanning, absolute on hover for the record. */}
                  <TableCell
                    className="text-xs text-muted-foreground"
                    title={formatDateTime(log.createdAt)}
                  >
                    {formatRelative(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {total > pageSize ? (
        <div className="mt-4 gap-3 flex items-center justify-end">
          <p className="text-xs text-muted-foreground tabular-nums">
            Page {page} of {lastPage} · {total} events
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
          >
            Next
          </Button>
        </div>
      ) : null}
    </Page>
  );
}

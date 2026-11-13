import { workspaceApi } from '@org/api-client';
import type { WorkspaceRole } from '@org/types';
import {
  Badge,
  EmptyState,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  UserAvatar,
  SettingsSectionHeader,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import { History, ShieldCheck, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface WorkspaceAuditSettingsProps {
  workspaceId: string | undefined;
  workspaceRole?: WorkspaceRole;
}

const ACTION_LABELS: Record<
  string,
  {
    label: string;
    variant: 'primary' | 'info' | 'warning' | 'destructive' | 'neutral';
  }
> = {
  'member.invited': { label: 'Invited Member', variant: 'primary' },
  'invitation.accepted': { label: 'Invitation Accepted', variant: 'info' },
  'invitation.resent': { label: 'Invitation Resent', variant: 'neutral' },
  'invitation.role_changed': {
    label: 'Invite Role Changed',
    variant: 'warning',
  },
  'invitation.revoked': { label: 'Invitation Revoked', variant: 'destructive' },
  'member.role_changed': { label: 'Member Role Changed', variant: 'warning' },
  'member.suspended': { label: 'Member Suspended', variant: 'destructive' },
  'member.reactivated': { label: 'Member Reactivated', variant: 'info' },
  'member.removed': { label: 'Member Removed', variant: 'destructive' },
  'ownership.transferred': {
    label: 'Ownership Transferred',
    variant: 'warning',
  },
  'policy.updated': { label: 'Policies Updated', variant: 'info' },
  'workspace.settings_changed': {
    label: 'Settings Changed',
    variant: 'neutral',
  },
  'workspace.archived': { label: 'Workspace Archived', variant: 'destructive' },
  'workspace.restored': { label: 'Workspace Restored', variant: 'info' },
};

export function WorkspaceAuditSettings({
  workspaceId,
}: WorkspaceAuditSettingsProps) {
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['workspace-audit-logs', workspaceId, actionFilter],
    queryFn: () =>
      workspaceApi.auditLogs(workspaceId as string, {
        limit: 100,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
      }),
    enabled: !!workspaceId,
  });

  const logs = useMemo(() => data?.items ?? [], [data?.items]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((log) => {
      const actorName = log.actor?.name?.toLowerCase() ?? '';
      const actorDisplay = log.actor?.displayName?.toLowerCase() ?? '';
      const action = log.action.toLowerCase();
      const target = log.targetType?.toLowerCase() ?? '';
      return (
        actorName.includes(q) ||
        actorDisplay.includes(q) ||
        action.includes(q) ||
        target.includes(q)
      );
    });
  }, [logs, searchQuery]);

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="Audit Logs"
        description="Immutable record of administrative, role change, membership, and security actions within this workspace."
      />

      <div className="sm:flex-row sm:items-center gap-3 flex flex-col justify-between">
        <div className="max-w-sm flex-1">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search by actor or action..."
            label="Search audit logs"
            className="h-9 bg-surface"
          />
        </div>

        <div className="gap-2 flex items-center">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 text-xs w-[180px] bg-surface">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Actions</SelectItem>
              <SelectItem value="member.invited">Member Invited</SelectItem>
              <SelectItem value="invitation.accepted">
                Invite Accepted
              </SelectItem>
              <SelectItem value="member.role_changed">Role Changed</SelectItem>
              <SelectItem value="member.suspended">Member Suspended</SelectItem>
              <SelectItem value="member.reactivated">
                Member Reactivated
              </SelectItem>
              <SelectItem value="member.removed">Member Removed</SelectItem>
              <SelectItem value="ownership.transferred">
                Ownership Transferred
              </SelectItem>
              <SelectItem value="policy.updated">Policy Updated</SelectItem>
              <SelectItem value="workspace.settings_changed">
                Settings Changed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={6} withAvatar />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={<History className="size-8" />}
          title="No audit entries recorded"
          description={
            searchQuery || actionFilter !== 'ALL'
              ? 'No audit log entries match your filter criteria.'
              : 'Audit events will appear here as administrative actions occur.'
          }
        />
      ) : (
        <div className="shadow-2xs divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface">
          {filteredLogs.map((log) => {
            const actionConfig = ACTION_LABELS[log.action] ?? {
              label: log.action.replace(/[._]/g, ' '),
              variant: 'neutral' as const,
            };

            return (
              <div
                key={log.id}
                className="p-4 sm:flex-row sm:items-center gap-3 flex flex-col justify-between transition-colors hover:bg-accent/25"
              >
                <div className="gap-3.5 min-w-0 flex items-center">
                  {log.actor ? (
                    <UserAvatar
                      name={log.actor.displayName ?? log.actor.name}
                      src={log.actor.avatarUrl}
                      seed={log.actor.id}
                      className="size-8"
                    />
                  ) : (
                    <div className="size-8 flex shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground">
                      <ShieldCheck className="size-4 text-primary" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="gap-2 flex flex-wrap items-center">
                      <span className="font-semibold text-xs truncate text-foreground">
                        {log.actor?.displayName ?? log.actor?.name ?? 'System'}
                      </span>
                      <Badge
                        variant={actionConfig.variant}
                        className="px-1.5 py-0 font-medium text-2xs capitalize"
                      >
                        {actionConfig.label}
                      </Badge>
                      {log.targetType ? (
                        <span className="text-meta text-muted-foreground">
                          on {log.targetType.toLowerCase()}
                          {log.targetId
                            ? ` (${log.targetId.slice(0, 8)}…)`
                            : ''}
                        </span>
                      ) : null}
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                      <p className="mt-0.5 max-w-lg truncate font-mono text-meta text-muted-foreground/80">
                        {JSON.stringify(log.metadata)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="gap-2 sm:self-auto flex shrink-0 items-center self-end text-meta text-muted-foreground">
                  <span>{formatRelative(log.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

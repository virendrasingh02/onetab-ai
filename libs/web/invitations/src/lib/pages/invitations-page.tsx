import {
  Badge,
  Button,
  EmptyState,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import { WorkspacePermission, type Invitation } from '@org/types';
import {
  Check,
  CheckCircle2,
  Copy,
  Hash,
  Link2,
  Mail,
  MailPlus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { InviteMembersDialog } from '../components/invite-members-dialog.js';
import {
  useInvitationLinks,
  useInvitationMutations,
  useInvitations,
} from '../use-invitations.js';

const STATUS_BADGES: Record<
  string,
  { variant: 'info' | 'success' | 'warning' | 'destructive' | 'neutral'; label: string }
> = {
  PENDING: { variant: 'info', label: 'Pending' },
  ACCEPTED: { variant: 'success', label: 'Accepted' },
  DECLINED: { variant: 'neutral', label: 'Declined' },
  EXPIRED: { variant: 'warning', label: 'Expired' },
  REVOKED: { variant: 'destructive', label: 'Revoked' },
};

export function InvitationsPage() {
  const { workspace, workspaceId } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_MEMBERS);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  /*
   * One-time tokens surfaced by resend/copy this session, keyed by invitation
   * id. The plaintext token is never stored server-side (only its hash), so
   * this map is the only place it lives after issue time.
   */
  const [sessionTokens, setSessionTokens] = useState<Record<string, string>>({});

  // Queries
  const invitationsQuery = useInvitations(workspaceId, {
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    search: searchQuery || undefined,
    scope: scopeFilter !== 'ALL' ? scopeFilter : undefined,
  });

  const linksQuery = useInvitationLinks(workspaceId);

  // Mutations
  const { resend, revoke } = useInvitationMutations(workspaceId);

  // Memoized so the `?? []` fallback keeps a stable identity across renders —
  // otherwise every dependent `useMemo` below recomputes on every render.
  const allInvitations = useMemo(
    () => invitationsQuery.data ?? [],
    [invitationsQuery.data],
  );
  const allLinks = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);

  const handleCopyLink = async (invitation: Invitation) => {
    try {
      let token = invitation.token ?? sessionTokens[invitation.id];
      if (!token) {
        // No retrievable token for this row — rotate the invitation to mint a
        // fresh one to copy. (Old behaviour pointed at `/w/:slug/join`, a route
        // that does not exist.)
        const res = await resend.mutateAsync(invitation.id);
        if (res.token) {
          token = res.token;
          const fresh = res.token;
          setSessionTokens((prev) => ({ ...prev, [invitation.id]: fresh }));
        }
      }
      if (!token) {
        setFeedbackToast('Could not generate an invite link. Try Resend.');
        setTimeout(() => setFeedbackToast(null), 3000);
        return;
      }
      await navigator.clipboard.writeText(
        `${window.location.origin}/invite/${token}`,
      );
      setCopiedId(invitation.id);
      setFeedbackToast('Invitation link copied to clipboard!');
      setTimeout(() => {
        setCopiedId(null);
        setFeedbackToast(null);
      }, 3000);
    } catch {
      setFeedbackToast('Could not copy the invite link.');
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      const res = await resend.mutateAsync(invitationId);
      if (res.token) {
        const fresh = res.token;
        setSessionTokens((prev) => ({ ...prev, [invitationId]: fresh }));
        setFeedbackToast('Invitation refreshed — use Copy Link to share it.');
      } else {
        setFeedbackToast('Invitation resent successfully!');
      }
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch {
      // Handled
    }
  };

  // Status counts
  const pendingCount = useMemo(
    () => allInvitations.filter((i) => i.status === 'PENDING').length,
    [allInvitations],
  );
  const acceptedCount = useMemo(
    () => allInvitations.filter((i) => i.status === 'ACCEPTED').length,
    [allInvitations],
  );
  const activeLinksCount = useMemo(
    () => allLinks.filter((l) => l.status === 'PENDING').length,
    [allLinks],
  );

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-3 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Mail className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-foreground">
                  Invitations & Access
                </h1>
                <Badge variant="neutral" className="text-[11px] px-1.5 py-0">
                  {allInvitations.length} total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage invitations and shareable access links for {workspace?.name ?? 'this workspace'}.
              </p>
            </div>
          </div>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteDialogOpen(true)}
              className="text-xs font-semibold h-8"
              leadingIcon={<MailPlus className="size-3.5" />}
            >
              Invite People
            </Button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto space-y-5">
        <div className="max-w-5xl mx-auto space-y-5">
          {/* Feedback Toast */}
          {feedbackToast && (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success-text shadow-xs">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-surface p-3 space-y-1 shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                Pending Invites
              </span>
              <p className="text-xl font-bold text-foreground">{pendingCount}</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 space-y-1 shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" />
                Accepted
              </span>
              <p className="text-xl font-bold text-foreground">{acceptedCount}</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 space-y-1 shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Link2 className="size-3.5 text-accent-indigo" />
                Active Links
              </span>
              <p className="text-xl font-bold text-foreground">{activeLinksCount}</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 space-y-1 shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-accent-amber" />
                Total Dispatched
              </span>
              <p className="text-xl font-bold text-foreground">{allInvitations.length}</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <SearchInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search by email address…"
                className="h-8.5 text-xs bg-surface"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-[130px] bg-surface">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="DECLINED">Declined</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                </SelectContent>
              </Select>

              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger className="h-8 text-xs w-[130px] bg-surface">
                  <SelectValue placeholder="All Scopes" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ALL">All Scopes</SelectItem>
                  <SelectItem value="WORKSPACE">Workspace</SelectItem>
                  <SelectItem value="CHANNEL">Channel</SelectItem>
                  <SelectItem value="TEAM">Team</SelectItem>
                  <SelectItem value="PROJECT">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invitations Table / List */}
          {invitationsQuery.isLoading ? (
            <SkeletonList rows={5} />
          ) : allInvitations.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-8 text-muted-foreground" />}
              title="No invitations found"
              description={
                searchQuery || statusFilter !== 'ALL'
                  ? 'No invitations match the current search or filters.'
                  : 'You have not sent any invitations yet.'
              }
              action={
                canManage ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsInviteDialogOpen(true)}
                  >
                    Invite Team Members
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface divide-y divide-border/60 overflow-hidden shadow-2xs">
              {allInvitations.map((invitation) => {
                const statusBadge =
                  STATUS_BADGES[invitation.status] ?? STATUS_BADGES.PENDING;
                const isPending = invitation.status === 'PENDING';

                return (
                  <div
                    key={invitation.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/20 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="size-9 rounded-full bg-accent flex items-center justify-center text-primary shrink-0">
                        <Mail className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {invitation.email ?? 'Shareable Link Invitation'}
                          </span>
                          <Badge variant={statusBadge.variant} className="text-[10px] px-1.5 py-0 capitalize">
                            {statusBadge.label}
                          </Badge>
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0 uppercase">
                            {invitation.role.toLowerCase()}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                          {invitation.channel && (
                            <span className="flex items-center gap-1 text-foreground font-medium">
                              <Hash className="size-3 text-muted-foreground" />
                              {invitation.channel.name}
                            </span>
                          )}
                          <span>Invited by {invitation.invitedBy.displayName ?? invitation.invitedBy.name}</span>
                          <span>·</span>
                          <span>Sent {formatRelative(invitation.createdAt)}</span>
                          {invitation.expiresAt && (
                            <>
                              <span>·</span>
                              <span>Expires {formatRelative(invitation.expiresAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {isPending && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => handleCopyLink(invitation)}
                              className="text-xs h-7 px-2"
                            >
                              {copiedId === invitation.id ? (
                                <>
                                  <Check className="size-3 mr-1 text-success-text" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3 mr-1" />
                                  Copy Link
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => handleResend(invitation.id)}
                              loading={resend.isPending}
                              className="text-xs h-7 px-2"
                            >
                              <RefreshCw className="size-3 mr-1" />
                              Resend
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => revoke.mutate(invitation.id)}
                              loading={revoke.isPending}
                              className="text-xs h-7 text-destructive hover:bg-destructive/10 px-2"
                            >
                              <Trash2 className="size-3 mr-1" />
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InviteMembersDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />
    </div>
  );
}

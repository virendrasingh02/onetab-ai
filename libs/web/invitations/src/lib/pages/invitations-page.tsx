import {
  Badge,
  Button,
  confirm,
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
  useWorkspaceStore,
  type WorkspaceState,
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
  {
    variant: 'info' | 'success' | 'warning' | 'destructive' | 'neutral';
    label: string;
  }
> = {
  PENDING: { variant: 'info', label: 'Pending' },
  ACCEPTED: { variant: 'success', label: 'Accepted' },
  DECLINED: { variant: 'neutral', label: 'Declined' },
  EXPIRED: { variant: 'warning', label: 'Expired' },
  REVOKED: { variant: 'destructive', label: 'Revoked' },
};

export interface InvitationsPageProps {
  /**
   * Rendered inside the workspace-settings surface rather than as its own
   * routed page. Drops the page chrome — the header bar, the outer scroll
   * container, the width cap — so the content flows in the settings column,
   * and routes "Invite People" through the app-wide invite dialog the settings
   * surface already mounts instead of a second local one.
   */
  embedded?: boolean;
}

export function InvitationsPage({
  embedded = false,
}: InvitationsPageProps = {}) {
  const { workspace, workspaceId } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_MEMBERS);
  const setInviteMembersOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setInviteMembersOpen,
  );

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
  const [sessionTokens, setSessionTokens] = useState<Record<string, string>>(
    {},
  );

  /*
   * Embedded in workspace settings, "Invite People" opens the one app-wide
   * invite dialog (already mounted by the settings surface); standalone, it
   * toggles this page's own local dialog.
   */
  const openInvite = () => {
    if (embedded) setInviteMembersOpen(true);
    else setIsInviteDialogOpen(true);
  };

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
    <div className={embedded ? undefined : 'min-h-0 flex flex-1 flex-col'}>
      {/* Header — the settings surface renders its own, so skip it there. */}
      {!embedded && (
        <div className="border-b border-border bg-background">
          <div className="gap-3 px-4 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
            <div className="min-w-0 gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Mail className="size-4" />
              </div>
              <div>
                <div className="gap-2 flex items-center">
                  <h1 className="text-sm font-semibold tracking-tight text-foreground">
                    Invitations & Access
                  </h1>
                  <Badge variant="neutral" className="px-1.5 py-0 text-meta">
                    {allInvitations.length} total
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Manage invitations and shareable access links for{' '}
                  {workspace?.name ?? 'this workspace'}.
                </p>
              </div>
            </div>

            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={openInvite}
                className="text-xs font-semibold h-8"
                leadingIcon={<MailPlus className="size-3.5" />}
              >
                Invite People
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Body */}
      <div
        className={
          embedded
            ? undefined
            : 'min-h-0 p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto'
        }
      >
        <div className={embedded ? 'space-y-5' : 'max-w-5xl space-y-5 mx-auto'}>
          {/* Feedback Toast */}
          {feedbackToast && (
            <div className="gap-2 p-3 text-xs flex items-center rounded-xl border border-success/30 bg-success/10 text-success-text shadow-xs">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="sm:grid-cols-4 gap-3 grid grid-cols-2">
            <div className="p-3 space-y-1 shadow-2xs rounded-xl border border-border bg-surface">
              <span className="font-medium gap-1.5 flex items-center text-meta text-muted-foreground">
                <Mail className="size-3.5 text-primary" />
                Pending Invites
              </span>
              <p className="text-xl font-bold text-foreground">
                {pendingCount}
              </p>
            </div>

            <div className="p-3 space-y-1 shadow-2xs rounded-xl border border-border bg-surface">
              <span className="font-medium gap-1.5 flex items-center text-meta text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-success" />
                Accepted
              </span>
              <p className="text-xl font-bold text-foreground">
                {acceptedCount}
              </p>
            </div>

            <div className="p-3 space-y-1 shadow-2xs rounded-xl border border-border bg-surface">
              <span className="font-medium gap-1.5 flex items-center text-meta text-muted-foreground">
                <Link2 className="size-3.5 text-accent-indigo" />
                Active Links
              </span>
              <p className="text-xl font-bold text-foreground">
                {activeLinksCount}
              </p>
            </div>

            <div className="p-3 space-y-1 shadow-2xs rounded-xl border border-border bg-surface">
              <span className="font-medium gap-1.5 flex items-center text-meta text-muted-foreground">
                <Users className="size-3.5 text-accent-amber" />
                Total Dispatched
              </span>
              <p className="text-xl font-bold text-foreground">
                {allInvitations.length}
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="sm:flex-row sm:items-center gap-3 pt-2 flex flex-col justify-between">
            <div className="gap-2 max-w-md flex flex-1 items-center">
              <SearchInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search by email address…"
                className="h-8.5 text-xs bg-surface"
              />
            </div>

            <div className="gap-2 flex items-center">
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
                  <Button size="sm" variant="primary" onClick={openInvite}>
                    Invite Team Members
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="shadow-2xs divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface">
              {allInvitations.map((invitation) => {
                const statusBadge =
                  STATUS_BADGES[invitation.status] ?? STATUS_BADGES.PENDING;
                const isPending = invitation.status === 'PENDING';

                return (
                  <div
                    key={invitation.id}
                    className="p-4 sm:flex-row sm:items-center gap-3 flex flex-col justify-between transition-colors hover:bg-accent/20"
                  >
                    <div className="gap-3.5 min-w-0 flex items-center">
                      <div className="size-9 flex shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                        <Mail className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="gap-2 flex items-center">
                          <span className="font-semibold text-xs truncate text-foreground">
                            {invitation.email ?? 'Shareable Link Invitation'}
                          </span>
                          <Badge
                            variant={statusBadge.variant}
                            className="px-1.5 py-0 text-2xs capitalize"
                          >
                            {statusBadge.label}
                          </Badge>
                          <Badge
                            variant="neutral"
                            className="px-1.5 py-0 text-2xs uppercase"
                          >
                            {invitation.role.toLowerCase()}
                          </Badge>
                        </div>

                        <div className="gap-x-2 gap-y-0.5 mt-0.5 flex flex-wrap items-center text-meta text-muted-foreground">
                          {invitation.channel && (
                            <span className="gap-1 font-medium flex items-center text-foreground">
                              <Hash className="size-3 text-muted-foreground" />
                              {invitation.channel.name}
                            </span>
                          )}
                          <span>
                            Invited by{' '}
                            {invitation.invitedBy.displayName ??
                              invitation.invitedBy.name}
                          </span>
                          <span>·</span>
                          <span>
                            Sent {formatRelative(invitation.createdAt)}
                          </span>
                          {invitation.expiresAt && (
                            <>
                              <span>·</span>
                              <span>
                                Expires {formatRelative(invitation.expiresAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="gap-2 sm:self-auto flex shrink-0 items-center self-end">
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
                              onClick={() => {
                                void confirm({
                                  title: `Revoke the invitation for ${invitation.email}?`,
                                  description:
                                    'Their invite link stops working right away. You can send a new invitation later.',
                                  confirmLabel: 'Revoke invitation',
                                  destructive: true,
                                }).then((ok) => {
                                  if (ok) revoke.mutate(invitation.id);
                                });
                              }}
                              loading={revoke.isPending}
                              className="text-xs h-7 px-2 text-destructive hover:bg-destructive/10"
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

      {/* Standalone only: settings mounts the app-wide invite dialog itself. */}
      {!embedded && (
        <InviteMembersDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
        />
      )}
    </div>
  );
}

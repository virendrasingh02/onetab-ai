import {
  useAccounts,
  useCurrentUser,
  useLinkedAccountWorkspaces,
  useRemoveAccount,
  useSwitchAccount,
  type AccountWorkspace,
} from '@org/auth';
import { isDesktop } from '@org/web-desktop';
import type { WorkspaceSummary } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ScrollArea,
  SearchInput,
  UserAvatar,
  WorkspaceAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Building2,
  Check,
  LogOut,
  Mail,
  MailPlus,
  Plus,
  Search,
  Settings,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore, type WorkspaceState } from '@org/web-workspace';

export interface ManageAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: WorkspaceSummary[];
  currentWorkspace: WorkspaceSummary;
  userEmail?: string;
  onAddAccount?: () => void;
  onSwitchWorkspace?: (workspace: WorkspaceSummary) => void;
}

/** Workspaces for one email, from either the active account or a linked one. */
type WorkspaceGroup =
  | { kind: 'active'; email: string; workspaces: WorkspaceSummary[] }
  | {
      kind: 'background';
      email: string;
      accountId: string;
      accountName: string;
      workspaces: AccountWorkspace[];
    };

export function ManageAccountsDialog({
  open,
  onOpenChange,
  workspaces,
  currentWorkspace,
  userEmail,
  onAddAccount,
  onSwitchWorkspace,
}: ManageAccountsDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const setInviteMembersOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setInviteMembersOpen,
  );

  const { accounts, activeAccountId } = useAccounts();
  const switchAccount = useSwitchAccount();
  const removeAccount = useRemoveAccount();
  const currentUser = useCurrentUser();
  const accountsBusy = switchAccount.isPending || removeAccount.isPending;
  // Keep every linked account's workspace list fresh so all of them list here.
  useLinkedAccountWorkspaces();

  /*
   * Every workspace across every linked account, grouped by account (never by
   * the email string alone). The active account's list comes from the app's
   * live query; each other account's from its own token-scoped cache. Nothing
   * is merged or shared across accounts — backend membership stays the source
   * of truth.
   */
  const groups = useMemo<WorkspaceGroup[]>(() => {
    const term = query.trim().toLowerCase();
    const hit = (name: string, slug: string, email: string) =>
      !term ||
      name.toLowerCase().includes(term) ||
      slug.toLowerCase().includes(term) ||
      email.toLowerCase().includes(term);

    const result: WorkspaceGroup[] = [];

    // `currentUser` (the authenticated identity) is the source of truth for the
    // active account; `activeAccountId` can lag after a half-failed switch. Both
    // are excluded from the background loop so the active account never renders
    // twice.
    const activeId = currentUser?.id ?? activeAccountId ?? 'active';
    const activeRow =
      accounts.find((a) => a.id === activeId) ??
      (activeAccountId
        ? accounts.find((a) => a.id === activeAccountId)
        : undefined);
    const activeIds = new Set(
      [activeId, activeAccountId, activeRow?.id, currentUser?.id].filter(
        Boolean,
      ),
    );
    const activeEmail =
      activeRow?.user.email ?? currentUser?.email ?? userEmail ?? 'This account';
    result.push({
      kind: 'active',
      email: activeEmail,
      workspaces: workspaces.filter((w) =>
        hit(w.name, w.slug, w.email || activeEmail),
      ),
    });

    for (const account of accounts) {
      if (activeIds.has(account.id)) continue;
      const email = account.user.email;
      const list = (account.workspaces ?? []).filter((w) =>
        hit(w.name, w.slug, email),
      );
      if (list.length === 0 && term) continue;
      result.push({
        kind: 'background',
        email,
        accountId: account.id,
        accountName: account.user.displayName ?? account.user.name,
        workspaces: list,
      });
    }

    return result;
  }, [workspaces, accounts, activeAccountId, currentUser, query, userEmail]);

  const handleSelectWorkspace = (workspace: WorkspaceSummary) => {
    onOpenChange(false);
    if (onSwitchWorkspace) {
      onSwitchWorkspace(workspace);
    } else {
      navigate(`/w/${workspace.slug}`);
    }
  };

  const handleOpenSettings = (workspace: WorkspaceSummary) => {
    onOpenChange(false);
    navigate(`/w/${workspace.slug}/settings`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <span>Manage Workspaces & Accounts</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                View and manage your connected workspaces, associated identities, and settings.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-3">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search workspaces by name or email…"
              className="h-8 text-xs bg-background"
              wrapperClassName="w-full"
            />
          </div>
        </DialogHeader>

        {!isDesktop && accounts.length > 0 ? (
          <div className="px-3 pt-3">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Signed-in accounts
            </div>
            <div className="space-y-1">
              {accounts.map((account) => {
                const isActive =
                  account.id === (currentUser?.id ?? activeAccountId) ||
                  account.id === activeAccountId;
                return (
                  <div
                    key={account.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-colors',
                      isActive
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/70 bg-card/60',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar
                        name={account.user.displayName ?? account.user.name}
                        src={account.user.avatarUrl}
                        seed={account.id}
                        indicator={false}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {account.user.displayName ?? account.user.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {account.user.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isActive ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          <UserCheck className="size-3.5" />
                          <span>Active</span>
                        </Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2.5 text-xs font-medium"
                          disabled={accountsBusy}
                          loading={
                            switchAccount.isPending &&
                            switchAccount.variables === account.id
                          }
                          onClick={() => {
                            onOpenChange(false);
                            switchAccount.mutate(account.id);
                          }}
                        >
                          Switch
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Sign out of ${account.user.email}`}
                        title="Sign out of this account"
                        className="size-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        disabled={accountsBusy}
                        onClick={() => removeAccount.mutate(account.id)}
                      >
                        <LogOut className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <ScrollArea className="max-h-[380px] p-3">
          {groups.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={<Search className="size-6 text-muted-foreground" />}
                title="No workspaces found"
                description={
                  query
                    ? `No workspaces match "${query}".`
                    : 'You are not a member of any workspaces yet.'
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={
                    group.kind === 'active'
                      ? `active:${group.email}`
                      : `account:${group.accountId}`
                  }
                  className="space-y-1.5"
                >
                  <div className="px-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    <Mail className="size-3 shrink-0 text-muted-foreground/70" />
                    <span className="truncate">{group.email}</span>
                    {group.kind === 'background' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={accountsBusy}
                        onClick={() => {
                          onOpenChange(false);
                          switchAccount.mutate(group.accountId);
                        }}
                        className="ml-auto h-5 px-1.5 text-[10px] font-medium normal-case"
                      >
                        Switch account
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    {group.kind === 'active'
                      ? group.workspaces.map((workspace) => {
                          const isSelected =
                            workspace.id === currentWorkspace.id;
                          const role = workspace.role;

                          return (
                            <div
                              key={workspace.id}
                              className={cn(
                                'group/card p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3',
                                isSelected
                                  ? 'border-primary/40 bg-primary/5 shadow-xs'
                                  : 'border-border/70 hover:border-border hover:bg-accent/40 bg-card/60',
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="relative shrink-0">
                                  <WorkspaceAvatar
                                    name={workspace.name}
                                    src={workspace.avatarUrl}
                                    icon={workspace.icon}
                                    iconColor={workspace.iconColor}
                                    seed={workspace.id}
                                    size="md"
                                    className="rounded-xl ring-1 ring-border/50"
                                  />
                                  {isSelected ? (
                                    <span
                                      className="absolute -bottom-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background"
                                      title="Active workspace"
                                    >
                                      <Check className="size-2.5 stroke-[3]" />
                                    </span>
                                  ) : null}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-foreground truncate">
                                      {workspace.name}
                                    </span>
                                    {role && (
                                      <Badge
                                        variant={
                                          role === 'OWNER'
                                            ? 'primary'
                                            : role === 'ADMIN'
                                            ? 'secondary'
                                            : 'neutral'
                                        }
                                        className="text-[10px] px-1.5 py-0 h-4 font-medium uppercase"
                                      >
                                        {role}
                                      </Badge>
                                    )}
                                    {workspace.status === 'ARCHIVED' && (
                                      <Badge
                                        variant="destructive"
                                        className="text-[10px] px-1.5 py-0 h-4"
                                      >
                                        Archived
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span className="shrink-0">
                                      {workspace.memberCount} member
                                      {workspace.memberCount === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isSelected ? (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 text-xs border-primary/40 text-primary bg-primary/10 font-medium px-2 py-0.5"
                                  >
                                    <UserCheck className="size-3.5" />
                                    <span>Active</span>
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      handleSelectWorkspace(workspace)
                                    }
                                    className="h-7 text-xs font-medium px-2.5"
                                  >
                                    Switch
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    setInviteMembersOpen(true, workspace);
                                  }}
                                  title={`Invite People to ${workspace.name}`}
                                  aria-label={`Invite people to ${workspace.name}`}
                                  className="size-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                                >
                                  <MailPlus className="size-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenSettings(workspace)}
                                  title="Workspace Settings"
                                  aria-label={`Settings for ${workspace.name}`}
                                  className="size-7 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <Settings className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      : group.workspaces.map((workspace) => (
                          <button
                            key={workspace.id}
                            type="button"
                            disabled={accountsBusy}
                            onClick={() => {
                              onOpenChange(false);
                              switchAccount.mutate({
                                accountId: group.accountId,
                                to: `/w/${workspace.slug}`,
                              });
                            }}
                            className="group/card w-full p-3 rounded-xl border border-border/70 bg-card/60 hover:border-border hover:bg-accent/40 transition-all duration-150 flex items-center justify-between gap-3 text-left disabled:opacity-60"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <WorkspaceAvatar
                                name={workspace.name}
                                src={workspace.avatarUrl}
                                icon={workspace.icon}
                                iconColor={workspace.iconColor}
                                seed={workspace.id}
                                size="md"
                                className="rounded-xl ring-1 ring-border/50 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-sm text-foreground truncate block">
                                  {workspace.name}
                                </span>
                                <span className="mt-0.5 text-xs text-muted-foreground block">
                                  {workspace.memberCount} member
                                  {workspace.memberCount === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-primary">
                              Switch
                            </span>
                          </button>
                        ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3.5 bg-surface-raised/50 border-t border-border flex items-center justify-between gap-2">
          {onAddAccount ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onAddAccount();
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Add account</span>
            </Button>
          ) : (
            <span />
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-4"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

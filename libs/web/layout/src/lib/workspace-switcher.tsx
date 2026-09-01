import {
  useAccounts,
  useCurrentUser,
  useLinkedAccountWorkspaces,
  useSwitchAccount,
  type AccountWorkspace,
} from '@org/auth';
import type { ActivityIndicator } from '@org/notifications';
import type { WorkspaceSummary } from '@org/types';
import {
  ActivityDot,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  SearchInput,
  WorkspaceAvatar,
  type ActivityLevel,
} from '@org/ui';
import { cn } from '@org/utils';
import { useWorkspaceStore, type WorkspaceState } from '@org/web-workspace';
import {
  Check,
  ChevronDown,
  MailPlus,
  PanelLeft,
  Plus,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

/** A row's shape is the common subset of a full summary and a cached slice. */
type SwitcherWorkspace = Pick<
  WorkspaceSummary,
  'id' | 'name' | 'slug' | 'avatarUrl' | 'icon' | 'iconColor' | 'memberCount'
>;

/**
 * One account and the workspaces it can reach. The active account carries full
 * summaries (its rows also drive the per-workspace invite button); every other
 * account carries the slimmer cached list fetched with its own token.
 */
type SwitcherGroup =
  | {
      kind: 'active';
      accountId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      workspaces: WorkspaceSummary[];
    }
  | {
      kind: 'background';
      accountId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      workspaces: AccountWorkspace[];
    };

export interface WorkspaceMenuProps {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
  /** Current user's fallback email if workspace membership email is unset */
  userEmail?: string;
  /** Unread state per workspace id. Absent ids simply show no dot. */
  workspaceActivity?: Record<string, ActivityIndicator>;
  onToggleSidebar?: () => void;
  onManageAccounts?: () => void;
  onAddAccount?: () => void;
  className?: string;
}

/**
 * The loudest thing happening anywhere *else*.
 */
function summariseOthers(
  workspaces: WorkspaceSummary[],
  currentId: string,
  activity: Record<string, ActivityIndicator> | undefined,
): ActivityLevel {
  if (!activity) return 'none';

  let level: ActivityLevel = 'none';
  for (const workspace of workspaces) {
    if (workspace.id === currentId) continue;
    const entry = activity[workspace.id];
    if (entry?.level === 'mention') return 'mention';
    if (entry?.level === 'activity') level = 'activity';
  }
  return level;
}

export function WorkspaceMenu({
  workspaces,
  current,
  userEmail,
  workspaceActivity,
  onToggleSidebar,
  onManageAccounts,
  onAddAccount,
  className,
}: WorkspaceMenuProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const setManageAccountsOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setManageAccountsOpen,
  );
  const setAddAccountOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setAddAccountOpen,
  );
  const setInviteMembersOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setInviteMembersOpen,
  );

  const currentUser = useCurrentUser();
  const { accounts, activeAccountId } = useAccounts();
  const switchAccount = useSwitchAccount();
  // Pull each linked account's workspaces (with its own token) so the menu can
  // show every account's workspaces, not just the active one's.
  useLinkedAccountWorkspaces();

  const othersLevel = summariseOthers(
    workspaces,
    current.id,
    workspaceActivity,
  );

  const currentEmail = current.email || userEmail;

  /*
   * The switcher is account-centric: one section per signed-in account, keyed by
   * the authenticated user id (never the email string). The active account's
   * workspaces come from the app's live query; every other account's come from
   * its own token, cached in the account store. Backend membership is the only
   * source of truth — nothing here merges or shares workspaces across accounts.
   */
  const groups = useMemo<SwitcherGroup[]>(() => {
    const term = searchQuery.trim().toLowerCase();
    const nameHit = (name: string, slug: string) =>
      !term ||
      name.toLowerCase().includes(term) ||
      slug.toLowerCase().includes(term);

    const result: SwitcherGroup[] = [];

    // The authenticated identity (`currentUser`) is the source of truth for
    // "which account is active" — `activeAccountId` can lag behind it after a
    // half-failed switch, which is what made the active account also show up as
    // a switch-to row.
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
      activeRow?.user.email ?? currentUser?.email ?? userEmail ?? '';
    const activeEmailHit = !term || activeEmail.toLowerCase().includes(term);

    result.push({
      kind: 'active',
      accountId: activeRow?.id ?? activeId,
      name:
        activeRow?.user.displayName ??
        activeRow?.user.name ??
        currentUser?.displayName ??
        currentUser?.name ??
        'This account',
      email: activeEmail,
      avatarUrl: activeRow?.user.avatarUrl ?? currentUser?.avatarUrl ?? null,
      workspaces: workspaces.filter(
        (w) => nameHit(w.name, w.slug) || activeEmailHit,
      ),
    });

    for (const account of accounts) {
      if (activeIds.has(account.id)) continue;
      const email = account.user.email;
      const emailHit = !term || email.toLowerCase().includes(term);
      const list = (account.workspaces ?? []).filter(
        (w) => nameHit(w.name, w.slug) || emailHit,
      );
      if (term && list.length === 0 && !emailHit) continue;
      result.push({
        kind: 'background',
        accountId: account.id,
        name: account.user.displayName ?? account.user.name,
        email,
        avatarUrl: account.user.avatarUrl ?? null,
        workspaces: list,
      });
    }

    return result;
  }, [
    workspaces,
    accounts,
    activeAccountId,
    currentUser,
    searchQuery,
    userEmail,
  ]);

  // Unfiltered count across every linked account — drives the header badge and
  // whether the search box shows. (Using the *filtered* count there would make
  // the box vanish mid-search as results narrow.)
  const linkedWorkspaceCount = useMemo(() => {
    const activeId = currentUser?.id ?? activeAccountId;
    return (
      workspaces.length +
      accounts.reduce(
        (sum, account) =>
          account.id === activeId || account.id === activeAccountId
            ? sum
            : sum + (account.workspaces?.length ?? 0),
        0,
      )
    );
  }, [workspaces, accounts, activeAccountId, currentUser]);

  const anyResults = groups.some((group) => group.workspaces.length > 0);

  const handleOpenManageAccounts = () => {
    setMenuOpen(false);
    if (onManageAccounts) {
      onManageAccounts();
    } else {
      setManageAccountsOpen(true);
    }
  };

  const handleOpenAddAccount = () => {
    setMenuOpen(false);
    if (onAddAccount) {
      onAddAccount();
    } else {
      setAddAccountOpen(true);
    }
  };

  return (
    <div
      className={cn(
        'group/workspace-header gap-1 flex w-full items-center justify-between',
        className,
      )}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Current workspace: ${current.name}${
              currentEmail ? ` (${currentEmail})` : ''
            }`}
            className={cn(
              'group/trigger gap-2 px-2 py-1 flex flex-1 items-center rounded-lg text-left',
              'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent/70',
              'cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            {/* Avatar with Activity Dot */}
            <span className="relative shrink-0">
              <WorkspaceAvatar
                name={current.name}
                src={current.avatarUrl}
                icon={current.icon}
                iconColor={current.iconColor}
                seed={current.id}
                size="sm"
                className="shadow-2xs rounded-sm"
              />
              <ActivityDot
                level={othersLevel}
                label={
                  othersLevel === 'mention'
                    ? 'You were mentioned in another workspace'
                    : 'Activity in another workspace'
                }
                className="-right-0.5 -top-0.5 absolute ring-2 ring-background"
              />
            </span>

            {/* Workspace Name */}
            <span className="min-w-0 leading-tight flex flex-1 flex-col justify-center">
              <span className="font-semibold tracking-tight text-xs sm:text-sm gap-1 flex items-center truncate text-foreground">
                <span className="truncate">{current.name}</span>
                <ChevronDown
                  className="size-3 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-data-[state=open]/trigger:rotate-180"
                  aria-hidden
                />
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-72 sm:w-80 p-1.5 shadow-2xl space-y-1 rounded-xl border border-border bg-popover text-foreground select-none"
        >
          {/* Header Label */}
          <div className="px-2 py-1 flex items-center justify-between">
            <DropdownMenuLabel className="p-0 font-semibold tracking-wide text-[11px] text-muted-foreground uppercase">
              Accounts
            </DropdownMenuLabel>
            <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-muted-foreground">
              {linkedWorkspaceCount}
            </span>
          </div>

          {/* Quick Search when 3 or more workspaces exist */}
          {linkedWorkspaceCount >= 3 && (
            <div className="px-1.5 py-1" onKeyDown={(e) => e.stopPropagation()}>
              <SearchInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search workspaces or emails…"
                className="h-7 text-xs bg-surface-inset/60"
                wrapperClassName="w-full"
              />
            </div>
          )}

          {/* One section per signed-in account */}
          <div className="space-y-1 my-1 max-h-72 pr-0.5 overflow-y-auto">
            {searchQuery && !anyResults ? (
              <div className="p-3 text-xs text-center text-muted-foreground">
                No matching workspaces
              </div>
            ) : (
              groups.map((group) => {
                const isActive = group.kind === 'active';
                const rows: SwitcherWorkspace[] = group.workspaces;

                return (
                  <div
                    key={group.accountId}
                    className="space-y-0.5 pt-1 first:pt-0 border-t border-border/40 first:border-t-0"
                  >
                    {/* Account identity */}
                    <div className="px-2 py-1 gap-2 flex items-center">
                      <div className="min-w-0 leading-tight flex-1">
                        {group.email ? (
                          <div className="truncate text-[12px] text-muted-foreground">
                            {group.email}
                          </div>
                        ) : null}
                      </div>
                      {/* {isActive ? (
                        <span className="rounded px-1.5 py-0.5 font-semibold tracking-wide shrink-0 bg-primary/10 text-[9px] text-primary uppercase">
                          Active
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={switchAccount.isPending}
                          onClick={() => {
                            setMenuOpen(false);
                            switchAccount.mutate({
                              accountId: group.accountId,
                            });
                          }}
                          className="h-6 px-1.5 font-medium shrink-0 text-[10px]"
                        >
                          Switch
                        </Button>
                      )} */}
                    </div>

                    {/* That account's workspaces */}
                    {rows.length === 0 ? (
                      <div className="px-2 pb-1 pl-9 text-[11px] text-muted-foreground">
                        No workspaces yet in this account.
                      </div>
                    ) : (
                      <div className="space-y-0.5 pl-1">
                        {rows.map((workspace) => {
                          const isSelected =
                            isActive && workspace.id === current.id;
                          const indicator = isActive
                            ? workspaceActivity?.[workspace.id]
                            : undefined;

                          const body = (
                            <>
                              <WorkspaceAvatar
                                name={workspace.name}
                                src={workspace.avatarUrl}
                                icon={workspace.icon}
                                iconColor={workspace.iconColor}
                                seed={workspace.id}
                                size="sm"
                                className="shrink-0 rounded-sm"
                              />
                              <span className="min-w-0 leading-tight flex-1">
                                <span className="font-semibold block truncate text-foreground">
                                  {workspace.name}
                                </span>
                                <span className="font-normal block truncate text-[10px] text-muted-foreground">
                                  {workspace.memberCount} member
                                  {workspace.memberCount === 1 ? '' : 's'}
                                </span>
                              </span>
                            </>
                          );

                          return (
                            <div
                              key={`${group.accountId}:${workspace.id}`}
                              className={cn(
                                'group/ws-row gap-2 px-2 py-1 text-xs flex items-center justify-between rounded-lg transition-colors',
                                isSelected
                                  ? 'font-medium border border-primary/20 bg-primary/10 text-foreground'
                                  : 'hover:bg-accent/60',
                              )}
                            >
                              <DropdownMenuItem
                                asChild
                                aria-current={isSelected ? 'true' : undefined}
                                className="p-0 flex-1 cursor-pointer hover:bg-transparent focus:bg-transparent"
                              >
                                {isActive ? (
                                  <Link
                                    to={`/w/${workspace.slug}`}
                                    className="gap-2.5 min-w-0 flex flex-1 items-center outline-none"
                                  >
                                    {body}
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuOpen(false);
                                      switchAccount.mutate({
                                        accountId: group.accountId,
                                        to: `/w/${workspace.slug}`,
                                      });
                                    }}
                                    className="gap-2.5 min-w-0 flex flex-1 items-center text-left outline-none"
                                  >
                                    {body}
                                  </button>
                                )}
                              </DropdownMenuItem>

                              <div className="gap-1 flex shrink-0 items-center">
                                {isActive ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpen(false);
                                        setInviteMembersOpen(
                                          true,
                                          workspace as WorkspaceSummary,
                                        );
                                      }}
                                      title={`Invite people to ${workspace.name}`}
                                      className="size-6 flex cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors group-hover/ws-row:opacity-100 hover:bg-primary/15 hover:text-primary"
                                    >
                                      <MailPlus className="size-3.5" />
                                    </button>

                                    <ActivityDot
                                      level={indicator?.level ?? 'none'}
                                      count={indicator?.mentionCount}
                                    />
                                    {isSelected ? (
                                      <Check className="size-3.5 shrink-0 text-primary" />
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator className="my-1 border-border/60" />

          {/* Action: Invite to Current Workspace */}
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setInviteMembersOpen(true, current);
            }}
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <MailPlus className="size-3" />
            </span>
            <span className="font-medium text-foreground">
              Invite to {current.name}
            </span>
          </DropdownMenuItem>

          {/* Action: Add another account — the only account-level action here */}
          <DropdownMenuItem
            onClick={handleOpenAddAccount}
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-primary">
              <UserPlus className="size-3" />
            </span>
            <span className="font-medium text-foreground">Add account</span>
          </DropdownMenuItem>

          {/* Action: Manage accounts */}
          <DropdownMenuItem
            onClick={handleOpenManageAccounts}
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-border text-subtle">
              <Users className="size-3" />
            </span>
            <span className="font-medium text-foreground">Manage accounts</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-border/60" />

          {/* Action: Workspace Settings */}
          <DropdownMenuItem
            asChild
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <Link to={`/w/${current.slug}/settings`}>
              <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-border text-subtle">
                <Settings className="size-3" />
              </span>
              <span className="font-medium">Workspace Settings</span>
            </Link>
          </DropdownMenuItem>

          {/* Action: Add a workspace — always created under the active account,
              since the create request rides the signed-in account's token. */}
          <DropdownMenuItem
            asChild
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <Link to="/workspaces/new" onClick={() => setMenuOpen(false)}>
              <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-subtle">
                <Plus className="size-3" />
              </span>
              <span className="font-medium">Add workspace</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sidebar collapse button on hover */}
      {onToggleSidebar ? (
        <Hint label="Collapse sidebar">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleSidebar}
            aria-label="Collapse sidebar"
            className="size-7 p-0 cursor-pointer opacity-0 transition-opacity duration-(--duration-fast) group-focus-within/sidebar:opacity-100 group-hover/sidebar:opacity-100 group-hover/workspace-header:opacity-100 focus-visible:opacity-100"
          >
            <PanelLeft className="size-4 text-subtle hover:text-foreground" />
          </Button>
        </Hint>
      ) : null}
    </div>
  );
}

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
  Mail,
  MailPlus,
  PanelLeft,
  Plus,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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

  const othersLevel = summariseOthers(
    workspaces,
    current.id,
    workspaceActivity,
  );

  const currentEmail = current.email || userEmail;

  const filteredWorkspaces = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter((w) => {
      const email = (w.email || userEmail || '').toLowerCase();
      const name = w.name.toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [workspaces, searchQuery, userEmail]);

  // Group filtered workspaces by their associated email
  const groupedWorkspaces = useMemo(() => {
    const groups: Record<string, WorkspaceSummary[]> = {};
    for (const ws of filteredWorkspaces) {
      const email = ws.email || userEmail || 'Other Accounts';
      if (!groups[email]) {
        groups[email] = [];
      }
      groups[email].push(ws);
    }
    return groups;
  }, [filteredWorkspaces, userEmail]);

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
              Workspaces & Accounts
            </DropdownMenuLabel>
            <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-muted-foreground">
              {workspaces.length}
            </span>
          </div>

          {/* Quick Search when 3 or more workspaces exist */}
          {workspaces.length >= 3 && (
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

          {/* Workspaces List Grouped by Email */}
          <div className="space-y-2 my-1 max-h-64 overflow-y-auto pr-0.5">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-3 text-xs text-center text-muted-foreground">
                No matching workspaces
              </div>
            ) : (
              Object.entries(groupedWorkspaces).map(([groupEmail, groupWorkspaces]) => (
                <div key={groupEmail} className="space-y-1">
                  {/* Email Group Header */}
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-muted-foreground/80 flex items-center gap-1.5 uppercase tracking-wider border-t border-border/40 first:border-t-0 first:pt-0">
                    <Mail className="size-3 text-muted-foreground/70 shrink-0" />
                    <span className="truncate">{groupEmail}</span>
                  </div>

                  {/* Workspaces in this Email Group */}
                  <div className="space-y-0.5">
                    {groupWorkspaces.map((workspace) => {
                      const isSelected = workspace.id === current.id;
                      const indicator = workspaceActivity?.[workspace.id];

                      return (
                        <div
                          key={workspace.id}
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
                            className="p-0 flex-1 hover:bg-transparent focus:bg-transparent cursor-pointer"
                          >
                            <Link
                              to={`/w/${workspace.slug}`}
                              className="gap-2.5 flex items-center flex-1 min-w-0 outline-none"
                            >
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
                            </Link>
                          </DropdownMenuItem>

                          {/* Action controls for this specific workspace */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Invitation button specifically for this workspace */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen(false);
                                setInviteMembersOpen(true, workspace);
                              }}
                              title={`Invite people to ${workspace.name}`}
                              className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/15 transition-colors opacity-70 group-hover/ws-row:opacity-100 cursor-pointer"
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
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

          {/* Action: Add another account */}
          <DropdownMenuItem
            onClick={handleOpenAddAccount}
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-primary">
              <UserPlus className="size-3" />
            </span>
            <span className="font-medium text-foreground">
              Add another account
            </span>
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

          {/* Action: Create New Workspace */}
          <DropdownMenuItem
            asChild
            className="gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg hover:bg-accent/60"
          >
            <Link to="/workspaces/new">
              <span className="size-5 flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-subtle">
                <Plus className="size-3" />
              </span>
              <span className="font-medium">Create New Workspace</span>
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

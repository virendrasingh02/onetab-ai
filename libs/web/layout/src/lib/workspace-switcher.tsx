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

            {/* Workspace Name & Associated Email Stacked (Slack style) */}
            <span className="min-w-0 leading-tight flex flex-1 flex-col justify-center">
              <span className="font-semibold tracking-tight text-xs sm:text-sm gap-1 flex items-center truncate text-foreground">
                <span className="truncate">{current.name}</span>
                <ChevronDown
                  className="size-3 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-data-[state=open]/trigger:rotate-180"
                  aria-hidden
                />
              </span>
              {currentEmail && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {currentEmail}
                </span>
              )}
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

          {/* Workspaces List */}
          <div className="space-y-0.5 my-1 max-h-60 overflow-y-auto">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-3 text-xs text-center text-muted-foreground">
                No matching workspaces
              </div>
            ) : (
              filteredWorkspaces.map((workspace) => {
                const isSelected = workspace.id === current.id;
                const indicator = workspaceActivity?.[workspace.id];
                const wsEmail = workspace.email || userEmail;

                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    asChild
                    aria-current={isSelected ? 'true' : undefined}
                    className={cn(
                      'gap-2.5 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-lg transition-colors',
                      isSelected
                        ? 'font-medium border border-primary/20 bg-primary/10 text-foreground'
                        : 'hover:bg-accent/60',
                    )}
                  >
                    <Link to={`/w/${workspace.slug}`}>
                      <WorkspaceAvatar
                        name={workspace.name}
                        src={workspace.avatarUrl}
                        icon={workspace.icon}
                        iconColor={workspace.iconColor}
                        seed={workspace.id}
                        size="sm"
                        className="shrink-0 rounded-sm"
                      />

                      {/* Name and email visually grouped */}
                      <span className="min-w-0 leading-tight flex-1">
                        <span className="font-semibold block truncate text-foreground">
                          {workspace.name}
                        </span>
                        {wsEmail ? (
                          <span className="font-normal block truncate text-[10px] text-muted-foreground">
                            {wsEmail}
                          </span>
                        ) : (
                          <span className="font-normal block truncate text-[10px] text-muted-foreground">
                            {workspace.memberCount} member
                            {workspace.memberCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>

                      {/* Active check / mention indicator */}
                      <span className="gap-1.5 ml-auto flex shrink-0 items-center">
                        <ActivityDot
                          level={indicator?.level ?? 'none'}
                          count={indicator?.mentionCount}
                        />
                        {isSelected ? (
                          <Check className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator className="my-1 border-border/60" />

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

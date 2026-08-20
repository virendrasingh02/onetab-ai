import { useTheme } from '@org/design-system';
import type { CurrentUser, WorkspaceSummary } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  LocalTime,
  UserAvatar,
  useFocusStore,
  useRightPanelStore,
  useWorldClockStore,
} from '@org/ui';
import type { ActivityIndicator } from '@org/notifications';
import { useLogout } from '@org/auth';
import { cn, describeTimezone } from '@org/utils';
import { openExternal, useDesktop } from '@org/web-desktop';
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  HelpCircle,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Smile,
  Sparkles,
  Sun,
  Target,
  User as UserIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { WorkspaceMenu } from './workspace-switcher.js';

export interface AppHeaderProps {
  user: CurrentUser;
  workspaceSlug: string;
  title: string;
  subtitle?: string;
  workspaces?: WorkspaceSummary[];
  currentWorkspace?: WorkspaceSummary;
  onOpenSearch: () => void;
  onToggleRightPanel: () => void;
  rightPanelOpen: boolean;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  unreadNotifications?: number;
  /** Unread state per workspace id, for the switcher's dots. */
  workspaceActivity?: Record<string, ActivityIndicator>;
  actions?: React.ReactNode;
}

export function AppHeader({
  user,
  workspaceSlug,
  workspaces,
  currentWorkspace,
  onOpenSearch,
  onToggleRightPanel,
  rightPanelOpen,
  onToggleSidebar,
  sidebarOpen = true,
  unreadNotifications: _unreadNotifications = 0,
  workspaceActivity,
  actions,
}: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();
  const { appInfo } = useDesktop();

  const isApple = appInfo
    ? appInfo.platform === 'darwin'
    : /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const searchShortcut = isApple ? '⌘K' : 'Ctrl K';

  const isFocusActive = useFocusStore((s) => s.isActive);
  const remainingSeconds = useFocusStore((s) => s.remainingSeconds);
  const openFocusModal = useFocusStore((s) => s.openFocusModal);
  const openStatusModal = useFocusStore((s) => s.openStatusModal);
  const openWorldClock = useWorldClockStore((s) => s.openWorldClock);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);

  const formatFocusTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="h-11 gap-2 px-2.5 sm:gap-3 sm:px-4 flex shrink-0 items-center select-none">
      {/*
        Left Section: Workspace Switcher and then Sidebar Toggle.

        The toggle is chrome, not a destination — it only appears while the
        pointer is over this corner (or while it holds focus, so it stays
        reachable by keyboard). `shrink-0` and a fixed size keep it out of the
        layout's way: it fades rather than collapsing, so the workspace name
        beside it never shifts.
      */}
      <div className="group/left min-w-0 gap-1.5 sm:gap-2 flex flex-1 items-center">
        {currentWorkspace && workspaces ? (
          <div className="max-w-44 sm:max-w-56 min-w-0 flex items-center">
            <WorkspaceMenu
              workspaces={workspaces}
              current={currentWorkspace}
              workspaceActivity={workspaceActivity}
            />
          </div>
        ) : null}

        {onToggleSidebar ? (
          <Hint label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
              className={cn(
                'size-7 p-0 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground',
                'opacity-0 transition-opacity duration-(--duration-fast) ease-standard',
                'group-focus-within/left:opacity-100 group-hover/left:opacity-100 focus-visible:opacity-100',
              )}
            >
              <PanelLeft className="size-4" />
            </Button>
          </Hint>
        ) : null}
      </div>

      {/* Center Section: Both < > Arrows and Search Bar Centered Together */}
      <div className="gap-1.5 sm:gap-2 flex shrink-0 items-center justify-center">
        <div className="gap-0.5 sm:flex hidden items-center">
          <Hint label="Go back">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="size-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </Hint>

          <Hint label="Go forward">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(1)}
              aria-label="Go forward"
              className="size-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </Button>
          </Hint>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            'h-7.5 w-52 sm:w-64 md:w-80 gap-2 px-2.5 sm:flex hidden items-center rounded-lg',
            'text-xs bg-white shadow-2xs border border-border/80 text-muted-foreground dark:bg-card',
            'cursor-pointer transition-colors duration-(--duration-fast) ease-standard',
            'hover:border-border-strong hover:bg-accent/40 hover:text-foreground',
            'outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <Search
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate">Search…</span>
          <kbd className="px-1.5 py-0.5 rounded ml-auto shrink-0 border border-border/60 bg-muted/60 font-mono text-[10px] text-subtle">
            {searchShortcut}
          </kbd>
        </button>
      </div>

      {/* Right Section: Actions, Utilities, Ask AI Button and Profile Avatar */}
      <div className="gap-1 sm:gap-1.5 flex flex-1 shrink-0 items-center justify-end">
        {actions}

        {/* Status Pill (Slack style) */}
        {user.statusText || user.statusEmoji ? (
          <Hint
            label={
              user.statusText
                ? `${user.statusEmoji ?? ''} ${user.statusText}`
                : 'Update status'
            }
          >
            <button
              type="button"
              onClick={openStatusModal}
              className="h-7 max-w-40 gap-1.5 px-2 md:flex text-xs font-medium hidden cursor-pointer items-center rounded-full border border-primary/30 bg-primary/10 text-foreground transition-colors hover:bg-primary/20"
            >
              <span className="text-sm">{user.statusEmoji || '💬'}</span>
              <span className="truncate">
                {user.statusText || 'Status set'}
              </span>
            </button>
          </Hint>
        ) : null}

        {/*
          Focus Mode and the local clock used to sit here as permanent controls.
          Neither is something you act on while reading a channel, and between
          them they took a third of the right-hand run — they now live in the
          account menu below, where the same two entries already existed.
        */}

        {/* Mobile Search Button */}
        <Hint label="Search">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSearch}
            aria-label="Search"
            className="sm:hidden size-7 p-0 flex text-muted-foreground hover:text-foreground"
          >
            <Search className="size-4" />
          </Button>
        </Hint>

        {/* Help & Resources */}
        <Hint label="Help & Resources">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 sm:flex hidden cursor-pointer"
            onClick={() => void openExternal('https://github.com/onetab-ai')}
          >
            <HelpCircle className="size-4" />
          </Button>
        </Hint>

        {/* Ask AI Assistant Button placed near the Profile Icon */}
        <Hint
          label={rightPanelOpen ? 'Close AI Assistant' : 'Ask AI Assistant'}
        >
          <Button
            variant={rightPanelOpen ? 'primary' : 'outline'}
            size="sm"
            onClick={onToggleRightPanel}
            aria-pressed={rightPanelOpen}
            aria-label={rightPanelOpen ? 'Close AI assistant' : 'Ask AI'}
            className="gap-1 px-2 text-xs font-medium sm:gap-1.5 sm:px-3 h-7 cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span className="sm:inline hidden">Ask AI</span>
          </Button>
        </Hint>

        {/* Profile Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 cursor-pointer rounded-full transition-transform outline-none hover:scale-105 focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <UserAvatar
                name={user.displayName ?? user.name}
                src={user.avatarUrl}
                seed={user.id}
                size="sm"
                presence="online"
                statusEmoji={user.statusEmoji}
                statusText={user.statusText}
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuLabel className="font-normal">
              <span className="text-xs font-medium block truncate">
                {user.displayName ?? user.name}
              </span>
              <span className="block truncate text-[11px] text-subtle">
                {user.email}
              </span>
              <Link
                to={`/w/${workspaceSlug}/settings`}
                className="mt-1 gap-1.5 flex items-center text-[11px] text-muted-foreground hover:text-foreground"
              >
                <LocalTime timezone={user.timezone} icon showOffset />
                <span className="truncate">
                  · {describeTimezone(user.timezone)}
                </span>
              </Link>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onClick={openStatusModal}
              className="text-xs gap-2 cursor-pointer"
            >
              <Smile className="size-3.5 shrink-0 text-primary" />
              <div className="flex-1 truncate">
                {user.statusText ? (
                  <div className="gap-1.5 flex items-center truncate">
                    <span>{user.statusEmoji || '💬'}</span>
                    <span className="truncate">{user.statusText}</span>
                  </div>
                ) : (
                  'Set a status'
                )}
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={openFocusModal}
              className="text-xs gap-2 cursor-pointer"
            >
              <Target className="size-3.5 shrink-0 text-primary" />
              <span>
                {isFocusActive
                  ? `Focusing (${formatFocusTime(remainingSeconds)})`
                  : 'Focus Mode'}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={openWorldClock}
              className="text-xs gap-2 cursor-pointer"
            >
              <Globe className="size-3.5 shrink-0 text-primary" />
              <span>Team Time Zones & Clock</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            {/*
              Profile opens the right rail rather than routing. The `/profile`
              route rendered the settings page verbatim, so "Profile" and
              "Settings" led to the same screen; the rail is the one place that
              actually shows a person.
            */}
            <DropdownMenuItem
              onClick={() =>
                openProfilePanel({
                  userId: user.id,
                  name: user.displayName ?? user.name,
                  avatarUrl: user.avatarUrl ?? undefined,
                  email: user.email,
                  bio: user.bio ?? undefined,
                  joinedAt: user.createdAt,
                  timezone: user.timezone,
                  statusEmoji: user.statusEmoji,
                  statusText: user.statusText,
                })
              }
              className="text-xs gap-2 cursor-pointer"
            >
              <UserIcon className="size-3.5" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs cursor-pointer">
              <Link to={`/w/${workspaceSlug}/settings`}>
                <Settings className="size-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuLabel className="font-medium text-[11px] text-subtle">
              Appearance
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-xs cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="size-3.5" />
              ) : (
                <Moon className="size-3.5" />
              )}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
              className="text-xs cursor-pointer"
            >
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

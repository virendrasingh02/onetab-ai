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
  useWorldClockStore,
} from '@org/ui';
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

  const formatFocusTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="h-11 gap-2 px-2.5 sm:gap-3 sm:px-4 flex shrink-0 items-center select-none">
      {/* Left Section: Workspace Switcher and then Sidebar Toggle */}
      <div className="min-w-0 gap-1.5 sm:gap-2 flex flex-1 items-center">
        {currentWorkspace && workspaces ? (
          <div className="max-w-44 sm:max-w-56 min-w-0 flex items-center">
            <WorkspaceMenu
              workspaces={workspaces}
              current={currentWorkspace}
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
              className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            >
              <PanelLeft className="size-4" />
            </Button>
          </Hint>
        ) : null}
      </div>

      {/* Center Section: Both < > Arrows and Search Bar Centered Together */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0">
        <div className="gap-0.5 sm:flex hidden items-center">
          <Hint label="Go back">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
              className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
            'text-xs border border-border/80 bg-white dark:bg-card text-muted-foreground shadow-2xs',
            'transition-colors duration-(--duration-fast) ease-standard cursor-pointer',
            'hover:bg-accent/40 hover:text-foreground hover:border-border-strong',
            'outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">Search…</span>
          <kbd className="px-1.5 py-0.5 ml-auto shrink-0 rounded border border-border/60 font-mono text-[10px] text-subtle bg-muted/60">
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
              className="h-7 max-w-40 gap-1.5 px-2 md:flex hidden items-center rounded-full text-xs font-medium border border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <span className="text-sm">{user.statusEmoji || '💬'}</span>
              <span className="truncate">{user.statusText || 'Status set'}</span>
            </button>
          </Hint>
        ) : null}

        {/* Focus Mode Trigger */}
        <Hint
          label={
            isFocusActive
              ? `Focus Mode: ${formatFocusTime(remainingSeconds)} remaining`
              : 'Start Focus Mode'
          }
        >
          <Button
            variant={isFocusActive ? 'primary' : 'ghost'}
            size="sm"
            onClick={openFocusModal}
            className={cn(
              'gap-1.5 px-2 text-xs font-medium sm:gap-1.5 sm:px-2.5 h-7 cursor-pointer',
              isFocusActive &&
                'bg-primary text-primary-foreground font-semibold shadow-xs',
            )}
          >
            <Target className="size-3.5" />
            <span className="sm:inline hidden">
              {isFocusActive ? formatFocusTime(remainingSeconds) : 'Focus'}
            </span>
          </Button>
        </Hint>

        {/* World Clock */}
        <Hint label="Click to open Team Time Zones & World Clock">
          <LocalTime
            timezone={user.timezone}
            icon
            interactive
            onClick={openWorldClock}
            className="px-1.5 text-xs font-medium lg:inline-flex hidden text-muted-foreground hover:text-foreground cursor-pointer"
          />
        </Hint>

        {/* Mobile Search Button */}
        <Hint label="Search">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSearch}
            aria-label="Search"
            className="sm:hidden flex size-7 p-0 text-muted-foreground hover:text-foreground"
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
              className="ml-1 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring transition-transform hover:scale-105 cursor-pointer"
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
              <Smile className="size-3.5 text-primary shrink-0" />
              <div className="flex-1 truncate">
                {user.statusText ? (
                  <div className="flex items-center gap-1.5 truncate">
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
              <Target className="size-3.5 text-primary shrink-0" />
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
              <Globe className="size-3.5 text-primary shrink-0" />
              <span>Team Time Zones & Clock</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem asChild className="text-xs cursor-pointer">
              <Link to={`/w/${workspaceSlug}/profile`}>
                <UserIcon className="size-3.5" />
                Profile
              </Link>
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

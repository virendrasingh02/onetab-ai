import { useTheme } from '@org/design-system';
import type { CurrentUser } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  UserAvatar,
} from '@org/ui';
import { useLogout } from '@org/auth';
import { cn } from '@org/utils';
import { openExternal, useDesktop } from '@org/web-desktop';
import { NotificationBadge } from '@org/notifications';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  History,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface AppHeaderProps {
  user: CurrentUser;
  workspaceSlug: string;
  title: string;
  subtitle?: string;
  onOpenSearch: () => void;
  onToggleRightPanel: () => void;
  rightPanelOpen: boolean;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onOpenNotifications: () => void;
  unreadNotifications?: number;
  actions?: React.ReactNode;
}

export function AppHeader({
  user,
  workspaceSlug,
  onOpenSearch,
  onToggleRightPanel,
  rightPanelOpen,
  onToggleSidebar,
  sidebarOpen = true,
  onOpenNotifications,
  unreadNotifications = 0,
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

  return (
    /*
     * No fill of its own: the header is the top of the editor panel, so it
     * inherits that panel's surface and only the hairline marks the split.
     * Painting `bg-background` here put a second tone inside the white panel.
     */
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2.5 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        {!sidebarOpen && onToggleSidebar ? (
          <Hint label="Expand sidebar">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSidebar}
              aria-label="Expand sidebar"
              aria-expanded={sidebarOpen}
            >
              <PanelLeft className="size-4" />
            </Button>
          </Hint>
        ) : null}

        {/*
          Only shown while the rail is collapsed, and only from `sm` up: on a
          phone `sidebarOpen` is the drawer's state, so its resting `false`
          would otherwise push three extra buttons into the tightest header.
        */}
        {!sidebarOpen ? (
          <div className="hidden items-center gap-0.5 sm:flex">
            <Hint label="Go back">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="size-7 p-0 text-muted-foreground hover:text-foreground"
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
                className="size-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </Button>
            </Hint>

            <Hint label="Recent history">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOpenSearch}
                aria-label="Recent history"
                className="size-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <History className="size-4" />
              </Button>
            </Hint>
          </div>
        ) : null}
      </div>

      {/* Centred Search Input */}
      <button
        onClick={onOpenSearch}
        className={cn(
          'hidden h-7 w-full max-w-80 items-center gap-2 rounded-input px-2.5 sm:flex',
          'border border-border bg-surface text-xs text-muted-foreground',
          'transition-colors duration-(--duration-fast) ease-standard',
          'hover:bg-accent hover:text-foreground',
          'outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search…</span>
        <kbd className="ml-auto shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          {searchShortcut}
        </kbd>
      </button>

      <div className="flex flex-1 items-center justify-end gap-1 sm:gap-1.5">
        {actions}

        <Hint label="Search">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSearch}
            aria-label="Search"
            className="flex sm:hidden"
          >
            <Search className="size-4" />
          </Button>
        </Hint>

        <Hint
          label={
            unreadNotifications > 0
              ? `Notifications (${unreadNotifications} new)`
              : 'Notifications'
          }
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenNotifications}
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} new`
                : 'Notifications'
            }
            className="relative"
          >
            <Bell className="size-4" />
            <NotificationBadge count={unreadNotifications} />
          </Button>
        </Hint>

        <Hint label="Help & Resources">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 hidden sm:flex"
            onClick={() => void openExternal('https://github.com/onetab-ai')}
          >
            <HelpCircle className="size-4" />
            <span className="hidden md:inline">Help</span>
          </Button>
        </Hint>

        <Hint label={rightPanelOpen ? 'Close AI Assistant' : 'Ask AI Assistant'}>
          <Button
            variant={rightPanelOpen ? 'primary' : 'outline'}
            size="sm"
            onClick={onToggleRightPanel}
            aria-pressed={rightPanelOpen}
            aria-label={rightPanelOpen ? 'Close AI assistant' : 'Ask AI'}
            className="gap-1 px-2 text-xs font-medium sm:gap-1.5 sm:px-3"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full ml-1 outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <UserAvatar
                name={user.displayName ?? user.name}
                src={user.avatarUrl}
                seed={user.id}
                size="sm"
                presence="online"
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuLabel className="font-normal">
              <span className="text-xs font-medium block truncate">
                {user.displayName ?? user.name}
              </span>
              <span className="text-[11px] block truncate text-subtle">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem asChild className="text-xs">
              <Link to={`/w/${workspaceSlug}/profile`}>
                <UserIcon className="size-3.5" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs">
              <Link to={`/w/${workspaceSlug}/settings`}>
                <Settings className="size-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuLabel className="text-[11px] font-medium text-subtle">
              Appearance
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-xs"
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
              className="text-xs"
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

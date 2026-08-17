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
  LocalTime,
  UserAvatar,
} from '@org/ui';
import { useLogout } from '@org/auth';
import { cn, describeTimezone } from '@org/utils';
import { openExternal, useDesktop } from '@org/web-desktop';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
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
    <header className="h-12 gap-2 px-2.5 sm:gap-3 sm:px-4 flex shrink-0 items-center border-b border-border">
      <div className="min-w-0 gap-1.5 sm:gap-2 flex flex-1 items-center">
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
          <div className="gap-0.5 sm:flex hidden items-center">
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

            {/*
              A third button here opened the command palette under a "Recent
              history" label and a clock icon. Nothing in the palette is a
              history view, and the search affordance is already two slots to
              the right, so it was one control claiming to be another.
            */}
          </div>
        ) : null}
      </div>

      {/* Centred Search Input */}
      <button
        onClick={onOpenSearch}
        className={cn(
          'h-7 max-w-80 gap-2 px-2.5 sm:flex hidden w-full items-center rounded-input',
          'text-xs border border-border bg-surface text-muted-foreground',
          'transition-colors duration-(--duration-fast) ease-standard',
          'hover:bg-accent hover:text-foreground',
          'outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search…</span>
        <kbd className="px-1.5 py-0.5 ml-auto shrink-0 rounded-sm border border-border font-mono text-[10px] text-subtle">
          {searchShortcut}
        </kbd>
      </button>

      <div className="gap-1 sm:gap-1.5 flex flex-1 items-center justify-end">
        {actions}

        {/*
          The clock reads the profile's timezone, not the browser's, so it
          answers "what time is it where my team thinks I am" — the same zone
          every teammate sees against your name. It updates on the minute, and
          its tooltip carries the date, the zone and the offset.
        */}
        <LocalTime
          timezone={user.timezone}
          icon
          withHint
          hintName="Your local time"
          className="px-1.5 text-xs font-medium lg:inline-flex hidden text-muted-foreground"
        />

        <Hint label="Search">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSearch}
            aria-label="Search"
            className="sm:hidden flex"
          >
            <Search className="size-4" />
          </Button>
        </Hint>

        <Hint label="Help & Resources">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 sm:flex hidden"
            onClick={() => void openExternal('https://github.com/onetab-ai')}
          >
            <HelpCircle className="size-4" />
          </Button>
        </Hint>

        <Hint
          label={rightPanelOpen ? 'Close AI Assistant' : 'Ask AI Assistant'}
        >
          <Button
            variant={rightPanelOpen ? 'primary' : 'outline'}
            size="sm"
            onClick={onToggleRightPanel}
            aria-pressed={rightPanelOpen}
            aria-label={rightPanelOpen ? 'Close AI assistant' : 'Ask AI'}
            className="gap-1 px-2 text-xs font-medium sm:gap-1.5 sm:px-3"
          >
            <Sparkles className="size-3.5" />
            <span className="sm:inline hidden">Ask AI</span>
          </Button>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <span className="block truncate text-[11px] text-subtle">
                {user.email}
              </span>
              {/* Where the clock in the header gets its zone from — shown here
                  so a wrong-looking time has an obvious place to be fixed. */}
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
            <DropdownMenuLabel className="font-medium text-[11px] text-subtle">
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

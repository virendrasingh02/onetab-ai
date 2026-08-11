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
import {
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
import { Link } from 'react-router-dom';

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
  title,
  subtitle,
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
  const { appInfo } = useDesktop();

  /*
   * The palette listens for Cmd *or* Ctrl, so the hint has to say which one the
   * user actually has. In the browser `navigator.platform` is the only signal;
   * in the shell the main process reports the real platform.
   */
  const isApple = appInfo
    ? appInfo.platform === 'darwin'
    : /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const searchShortcut = isApple ? '⌘K' : 'Ctrl K';

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        {onToggleSidebar ? (
          <Hint label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={sidebarOpen}
              /*
               * Always rendered. It used to unmount itself on mobile whenever
               * the sidebar was open, which shifted the whole title row
               * sideways every time the drawer was toggled.
               */
            >
              <PanelLeft className="size-4" />
            </Button>
          </Hint>
        ) : null}

        <h1 className="truncate text-[13px] font-medium tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <span className="hidden truncate text-xs text-subtle sm:inline">
            · {subtitle}
          </span>
        ) : null}
      </div>

      {/*
        Centred search, per the top-nav spec. The flanking flex-1 regions are
        what hold it in the middle regardless of how long the title runs.
      */}
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

        {/* Search icon button for mobile screens */}
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

        <Hint label="Help & Resources">
          {/*
            Documentation is an external site. In the shell `window.open` is
            denied by the navigation policy, so this goes through the bridge,
            which hands the URL to the system browser.
          */}
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
            {/*
              The icon inherits the button's own colour. Hard-coding
              `text-primary` put primary on primary in the active state, which
              made the glyph all but vanish exactly when the panel was open.
            */}
            <Sparkles className="size-3.5" />
            {/*
              Was `hidden xs:inline`. The theme defines no `xs` breakpoint, so
              Tailwind generated no `xs:` rule at all and the label was hidden
              at every width — the button read as an unlabelled icon.
            */}
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


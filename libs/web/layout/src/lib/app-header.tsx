import { useTheme } from '@org/design-system';
import type { CurrentUser } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Hint,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { useLogout } from '@org/auth';
import {
  Bell,
  LogOut,
  Monitor,
  Moon,
  PanelRight,
  Search,
  Settings,
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
  unreadNotifications = 0,
  actions,
}: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const logout = useLogout();

  return (
    <header className="h-14 gap-3 px-4 flex shrink-0 items-center border-b bg-background">
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-semibold truncate">{title}</h1>
        {subtitle ? (
          <p className="text-xs truncate text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      {actions}

      {/* Search opens the command palette; the button mirrors its shortcut. */}
      <button
        onClick={onOpenSearch}
        className={cn(
          'gap-2 px-2.5 py-1.5 text-xs md:flex hidden items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted',
          'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        )}
      >
        <Search className="size-3.5" aria-hidden />
        <span>Search</span>
        <kbd className="rounded px-1 bg-muted py-px font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      <Hint label="Notifications">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadNotifications > 0
              ? `Notifications (${unreadNotifications} unread)`
              : 'Notifications'
          }
        >
          <Bell />
          {unreadNotifications > 0 ? (
            <span className="top-1.5 right-1.5 size-2 absolute rounded-full bg-destructive" />
          ) : null}
        </Button>
      </Hint>

      <Hint label={rightPanelOpen ? 'Hide details' : 'Show details'}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRightPanel}
          aria-pressed={rightPanelOpen}
          aria-label={rightPanelOpen ? 'Hide details' : 'Show details'}
        >
          <PanelRight />
        </Button>
      </Hint>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label="Account menu"
          >
            <UserAvatar
              name={user.displayName ?? user.name}
              src={user.avatarUrl}
              seed={user.id}
              size="md"
              presence="online"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal text-foreground">
            <span className="text-sm font-medium block">
              {user.displayName ?? user.name}
            </span>
            <span className="text-xs block truncate text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to={`/w/${workspaceSlug}/profile`}>
              <UserIcon />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/w/${workspaceSlug}/settings`}>
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun />
            Light
            {theme === 'light' ? (
              <DropdownMenuShortcut>✓</DropdownMenuShortcut>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon />
            Dark
            {theme === 'dark' ? (
              <DropdownMenuShortcut>✓</DropdownMenuShortcut>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <Monitor />
            System
            {theme === 'system' ? (
              <DropdownMenuShortcut>✓</DropdownMenuShortcut>
            ) : null}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => logout.mutate()}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

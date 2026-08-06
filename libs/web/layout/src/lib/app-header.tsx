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
  Moon,
  PanelRight,
  Search,
  Settings,
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
    <header className="h-[48px] gap-3 px-4 flex shrink-0 items-center border-b border-[#27272A] bg-[#09090B]">
      <div className="min-w-0 flex items-center gap-2">
        <h1 className="text-xs font-semibold text-[#FAFAFA] truncate tracking-tight">{title}</h1>
        {subtitle ? (
          <span className="text-[11px] truncate text-[#71717A] font-normal hidden sm:inline">
            · {subtitle}
          </span>
        ) : null}
      </div>

      <div className="flex-1 flex justify-center max-w-md mx-auto">
        <button
          onClick={onOpenSearch}
          className={cn(
            'w-full max-w-sm gap-2 px-3 py-1 text-xs flex items-center justify-between rounded-[8px] border border-[#27272A] bg-[#111113] text-[#71717A] transition-all duration-[120ms] hover:border-[#27272A]/90 hover:text-[#A1A1AA]',
            'focus-visible:border-[#6E56CF] focus-visible:outline-none',
          )}
        >
          <div className="flex items-center gap-2">
            <Search className="size-3.5" aria-hidden />
            <span>Search or jump to…</span>
          </div>
          <kbd className="rounded bg-[#16171A] border border-[#27272A] px-1.5 py-0.5 font-mono text-[10px] text-[#A1A1AA]">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {actions}

        <Hint label="Notifications">
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative text-[#A1A1AA] hover:text-[#FAFAFA]"
            aria-label={
              unreadNotifications > 0
                ? `Notifications (${unreadNotifications} unread)`
                : 'Notifications'
            }
          >
            <Bell className="size-4" />
            {unreadNotifications > 0 ? (
              <span className="top-1 right-1 size-1.5 absolute rounded-full bg-[#E5484D]" />
            ) : null}
          </Button>
        </Hint>

        <Hint label={rightPanelOpen ? 'Hide details' : 'Show details'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleRightPanel}
            className="text-[#A1A1AA] hover:text-[#FAFAFA]"
            aria-pressed={rightPanelOpen}
            aria-label={rightPanelOpen ? 'Hide details' : 'Show details'}
          >
            <PanelRight className="size-4" />
          </Button>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full focus-visible:ring-1 focus-visible:ring-[#6E56CF] focus-visible:outline-none ml-1"
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

          <DropdownMenuContent align="end" className="w-56 border-[#27272A] bg-[#111113]">
            <DropdownMenuLabel className="font-normal text-[#FAFAFA]">
              <span className="text-xs font-semibold block">
                {user.displayName ?? user.name}
              </span>
              <span className="text-[11px] block truncate text-[#71717A]">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#27272A]" />

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

            <DropdownMenuSeparator className="bg-[#27272A]" />
            <DropdownMenuLabel className="text-[11px] text-[#71717A]">Appearance</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme('dark')} className="text-xs">
              <Moon className="size-3.5" />
              Dark
              {theme === 'dark' ? (
                <DropdownMenuShortcut>✓</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#27272A]" />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
              className="text-xs text-[#E5484D]"
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

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
import {
  Bell,
  HelpCircle,
  LogOut,
  Moon,
  PanelLeft,
  PanelRight,
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
  unreadNotifications = 0,
  actions,
}: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const logout = useLogout();

  return (
    <header className="h-[48px] gap-3 px-4 flex shrink-0 items-center border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#09090B] transition-colors">
      <div className="min-w-0 flex items-center gap-2">
        {!sidebarOpen && onToggleSidebar ? (
          <Hint label="Expand sidebar">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSidebar}
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
          </Hint>
        ) : null}

        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle ? (
          <span className="text-xs truncate text-zinc-400 font-normal hidden sm:inline">
            · {subtitle}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {actions}

        <Hint label="Help & Resources">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 px-2 text-xs font-medium"
          >
            <HelpCircle className="size-4" />
            <span className="hidden md:inline">Help</span>
          </Button>
        </Hint>

        <Hint label="Notifications">
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-label={
              unreadNotifications > 0
                ? `Notifications (${unreadNotifications} unread)`
                : 'Notifications'
            }
          >
            <Bell className="size-4" />
            {unreadNotifications > 0 ? (
              <span className="top-1 right-1 size-2 absolute rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900" />
            ) : null}
          </Button>
        </Hint>

        <Hint label={rightPanelOpen ? 'Hide details' : 'Show details'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleRightPanel}
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-pressed={rightPanelOpen}
            aria-label={rightPanelOpen ? 'Hide details' : 'Show details'}
          >
            <PanelRight className="size-4" />
          </Button>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ml-1"
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

          <DropdownMenuContent align="end" className="w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-lg">
            <DropdownMenuLabel className="font-normal text-zinc-900 dark:text-zinc-100">
              <span className="text-xs font-semibold block">
                {user.displayName ?? user.name}
              </span>
              <span className="text-[11px] block truncate text-zinc-400">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800 my-1" />

            <DropdownMenuItem asChild className="text-xs rounded-md cursor-pointer">
              <Link to={`/w/${workspaceSlug}/profile`}>
                <UserIcon className="size-3.5" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs rounded-md cursor-pointer">
              <Link to={`/w/${workspaceSlug}/settings`}>
                <Settings className="size-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800 my-1" />
            <DropdownMenuLabel className="text-[11px] font-medium text-zinc-400">Appearance</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-xs rounded-md cursor-pointer">
              {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800 my-1" />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
              className="text-xs rounded-md cursor-pointer text-red-600 dark:text-red-400"
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


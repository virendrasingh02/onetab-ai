import { billingApi } from '@org/api-client';
import { useTheme } from '@org/design-system';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Check,
  ChevronsUpDown,
  Coins,
  ExternalLink,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStudioSession } from '../session-guard.js';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light', label: 'Light theme', icon: Sun },
    { value: 'dark', label: 'Dark theme', icon: Moon },
    { value: 'system', label: 'System theme', icon: Monitor },
  ] as const;

  return (
    <div className="gap-1 flex items-center">
      {options.map(({ value, label, icon: Icon }) => (
        <Hint key={value} label={label}>
          <Button
            variant={theme === value ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={label}
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-3.5" />
          </Button>
        </Hint>
      ))}
    </div>
  );
}

export interface StudioHeaderProps {
  onToggleMobile?: () => void;
}

export function StudioHeader({ onToggleMobile }: StudioHeaderProps) {
  const { user, workspaces, activeWorkspace, setActiveWorkspace } =
    useStudioSession();

  // Load credits for active workspace
  const { data: creditAccount } = useQuery({
    queryKey: ['workspace-credits', activeWorkspace.id],
    queryFn: () => billingApi.getCredits(activeWorkspace.id),
    staleTime: 30_000,
  });

  const initials = user.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <header className="h-14 gap-2 sm:gap-3 px-3 sm:px-6 flex shrink-0 items-center justify-between border-b border-border bg-background z-30">
      {/* Left: Mobile trigger, Branding & Workspace Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleMobile}
          className="md:hidden shrink-0"
          aria-label="Toggle studio navigation"
        >
          <Bot className="size-4" />
        </Button>

        <Link
          to="/overview"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90 shrink-0"
        >
          <span className="size-7 text-xs font-semibold flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
            O
          </span>
          <h1 className="hidden sm:block text-sm font-semibold truncate">
            OneTab AI — Agent Studio
          </h1>
        </Link>

        <div className="hidden sm:block h-4 w-px bg-border mx-1" />

        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-2 text-xs font-medium text-foreground hover:bg-surface-raised"
            >
              <div className="flex size-5 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary shrink-0">
                {activeWorkspace.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden sm:inline max-w-[160px] truncate">
                {activeWorkspace.name}
              </span>
              <ChevronsUpDown className="size-3 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch Workspace
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="flex size-5 items-center justify-center rounded bg-surface-raised text-[10px] font-bold">
                    {ws.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate">{ws.name}</span>
                </div>
                {ws.id === activeWorkspace.id && (
                  <Check className="size-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Credits, Main Platform Link, Theme Toggle & User Profile */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Shared Credits Indicator */}
        {creditAccount ? (
          <Badge variant="neutral" className="hidden md:inline-flex gap-1">
            <Coins className="size-3 text-warning" />
            {creditAccount.balance.toLocaleString()} credits
          </Badge>
        ) : null}

        {/* Link back to Main Platform */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
          asChild
        >
          <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
            <span>Main Platform</span>
            <ExternalLink className="size-3" />
          </a>
        </Button>

        {/* Segmented Theme Toggle matching Admin */}
        <ThemeToggle />

        {/* User Avatar Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full p-0"
              aria-label="User account"
            >
              <Avatar className="size-7">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : null}
                <AvatarFallback className="text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-xs font-semibold leading-none text-foreground">
                {user.name}
              </p>
              <p className="text-[11px] leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs">
              <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}/settings`}>
                Workspace Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs">
              <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}/billing`}>
                Billing & Credits
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

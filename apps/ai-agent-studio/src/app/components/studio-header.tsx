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
} from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronsUpDown,
  Coins,
  ExternalLink,
  Laptop,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useStudioSession } from '../session-guard.js';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

export function StudioHeader() {
  const { user, workspaces, activeWorkspace, setActiveWorkspace } =
    useStudioSession();
  const { theme, setTheme } = useTheme();

  // Load credits for active workspace
  const { data: creditAccount } = useQuery({
    queryKey: ['workspace-credits', activeWorkspace.id],
    queryFn: () => billingApi.getAccount(activeWorkspace.id),
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
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md">
      {/* Left: Branding & Workspace Switcher */}
      <div className="flex items-center gap-3">
        <a
          href="/overview"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-xs">
            <Sparkles className="size-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              OneTab
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              Agent Studio
            </span>
          </div>
        </a>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-2 text-xs font-medium text-foreground hover:bg-surface-raised"
            >
              <div className="flex size-5 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">
                {activeWorkspace.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="max-w-[120px] truncate sm:max-w-[180px]">
                {activeWorkspace.name}
              </span>
              <ChevronsUpDown className="size-3 text-muted-foreground" />
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

      {/* Right: Credits, Theme, Main Platform Link & User Profile */}
      <div className="flex items-center gap-2">
        {/* Shared Credits Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs">
          <Coins className="size-3 text-amber-500" />
          <span>
            {creditAccount ? `${creditAccount.balance.toLocaleString()} credits` : 'Active'}
          </span>
        </div>

        {/* Link back to Main Platform */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          asChild
        >
          <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
            <span>Main Platform</span>
            <ExternalLink className="size-3" />
          </a>
        </Button>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Moon className="size-4" />
              ) : theme === 'light' ? (
                <Sun className="size-4" />
              ) : (
                <Laptop className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => setTheme('light')} className="text-xs gap-2">
              <Sun className="size-3.5" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')} className="text-xs gap-2">
              <Moon className="size-3.5" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')} className="text-xs gap-2">
              <Laptop className="size-3.5" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full p-0"
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

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
  ChevronRight,
  Coins,
  ExternalLink,
  Monitor,
  Moon,
  PanelLeft,
  Sun,
} from 'lucide-react';
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onToggleMobile?: () => void;
  breadcrumb?: { section: string; page: string };
}

/**
 * Top Header bar for the main area matching the reference image layout:
 * - Left: Collapse/Expand Sidebar Trigger + Breadcrumb Navigation (Dashboard > Overview)
 * - Right: Credits balance, Main Platform link, Theme Toggle, User Avatar dropdown
 */
export function StudioHeader({
  collapsed = false,
  onToggleCollapse,
  onToggleMobile,
  breadcrumb = { section: 'Platform', page: 'Studio Overview' },
}: StudioHeaderProps) {
  const { user, activeWorkspace } = useStudioSession();

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
    : 'NB';

  const displayName = user.name || 'Nick Bold';
  const displayEmail = user.email || 'admin@onetab.ai';

  return (
    <header className="h-14 border-b border-border/60 bg-background/95 backdrop-blur-xs px-4 sm:px-6 flex shrink-0 items-center justify-between z-30">
      {/* Left: Sidebar toggle button + Breadcrumb Navigation */}
      <div className="flex items-center gap-3 min-w-0">
        <Hint label={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (window.innerWidth < 768) {
                onToggleMobile?.();
              } else {
                onToggleCollapse?.();
              }
            }}
            className="size-8 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Toggle navigation"
          >
            <PanelLeft className="size-4" />
          </Button>
        </Hint>

        {/* Breadcrumb Navigation matching ref image: Dashboard > Overview */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs font-medium truncate">
          <span className="text-muted-foreground hover:text-foreground transition-colors truncate">
            {breadcrumb.section}
          </span>
          <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
          <span className="text-foreground font-semibold truncate">
            {breadcrumb.page}
          </span>
        </nav>
      </div>

      {/* Right: Credits, Main Platform Link, Theme Toggle & User Profile */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Shared Credits Indicator */}
        {creditAccount ? (
          <Badge variant="neutral" className="hidden md:inline-flex gap-1 border border-border/60 text-xs">
            <Coins className="size-3 text-warning" />
            {creditAccount.balance.toLocaleString()} credits
          </Badge>
        ) : null}

        {/* Link back to Main Platform */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex border-border/60"
          asChild
        >
          <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
            <span>Main Platform</span>
            <ExternalLink className="size-3" />
          </a>
        </Button>

        {/* Segmented Theme Toggle */}
        <ThemeToggle />

        {/* User Avatar Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full p-0 ml-1"
              aria-label="User account"
            >
              <Avatar className="size-7 border border-border/60">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="text-xs font-medium bg-foreground text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none text-foreground">
                  {displayName}
                </p>
                <p className="text-[11px] leading-none text-muted-foreground">
                  {displayEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 text-xs">
              <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
                <ExternalLink className="size-3.5 text-muted-foreground" />
                <span>Main Platform</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

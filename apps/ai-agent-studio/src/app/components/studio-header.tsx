import { useTheme } from '@org/design-system';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  PlanBadge,
  UserAvatar,
} from '@org/ui';
import {
  ChevronRight,
  Coins,
  ExternalLink,
  Monitor,
  Moon,
  PanelLeft,
  Sun,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStudioPlan } from '../plan/use-studio-plan.js';
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
  breadcrumb = { section: 'Plan, Run & Approve', page: 'Studio Home' },
}: StudioHeaderProps) {
  const { user, activeWorkspace } = useStudioSession();

  // Same plan record the main app's billing page reads.
  const { plan, planName, credits, lowCredits, canManageBilling, subscription, billingUrl } = useStudioPlan();
  const isFree = plan === 'free';
  const pastDue = subscription?.status === 'PAST_DUE' || subscription?.status === 'UNPAID';

  const displayName = user.name || user.email || 'Studio user';
  const displayEmail = user.email || '';

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
        {/* Plan + shared credits */}
        {plan ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 px-2 text-xs"
                aria-label={`Plan: ${planName}. ${credits !== null ? `${credits.toFixed(2)} dollars of AI credits.` : ''}`}
              >
                <PlanBadge plan={plan} size="xs" variant="gradient" />
                {credits !== null ? (
                  <span className={`hidden md:inline-flex items-center gap-1 tabular-nums ${lowCredits ? 'text-warning-text font-semibold' : 'text-muted-foreground'}`}>
                    <Coins className="size-3" aria-hidden />${credits.toFixed(2)}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs font-semibold text-foreground">{planName} plan</p>
                {credits !== null ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    ${credits.toFixed(2)} shared AI credits{lowCredits ? ' — running low' : ''}
                  </p>
                ) : null}
                {pastDue ? <p className="mt-0.5 text-[11px] text-destructive-text">Last payment failed</p> : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2 text-xs">
                <Link to="/settings?tab=usage">Usage & limits</Link>
              </DropdownMenuItem>
              {canManageBilling ? (
                <>
                  <DropdownMenuItem asChild className="gap-2 text-xs">
                    <a href={billingUrl()}>{isFree ? 'Upgrade plan' : 'Manage plan & billing'}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="gap-2 text-xs">
                    <a href={billingUrl({ topUp: true })}>Top up credits</a>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild className="gap-2 text-xs">
                  <a href={billingUrl()}>View plans</a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
              <UserAvatar
                name={displayName}
                src={user.avatarUrl ?? undefined}
                seed={user.id}
                size="sm"
                indicator={false}
              />
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

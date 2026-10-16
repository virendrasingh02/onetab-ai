import { useTheme } from '@org/design-system';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  PlanBadge,
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
import { Link } from '../router.js';
import { useStudioPlan } from '../plan/use-studio-plan.js';
import { useStudioSession } from '../session-guard.js';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/** One compact theme menu instead of three always-visible buttons. */
function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const TriggerIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <Hint label="Theme">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Change theme"
          >
            <TriggerIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="gap-2 text-sm">
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
 * - Right: Credits balance, Main Platform link, Theme menu. The account menu
 *   lives only in the sidebar footer, so the user avatar appears once.
 */
export function StudioHeader({
  collapsed = false,
  onToggleCollapse,
  onToggleMobile,
  breadcrumb = { section: 'Plan, Run & Approve', page: 'Studio Home' },
}: StudioHeaderProps) {
  const { activeWorkspace } = useStudioSession();

  // Same plan record the main app's billing page reads.
  const { plan, planName, credits, lowCredits, canManageBilling, subscription, billingUrl } = useStudioPlan();
  const isFree = plan === 'free';
  const pastDue = subscription?.status === 'PAST_DUE' || subscription?.status === 'UNPAID';

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

      {/* Right: Credits, Main Platform Link & Theme */}
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

        <ThemeMenu />
      </div>
    </header>
  );
}

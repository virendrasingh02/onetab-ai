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
  KbdShortcut,
  PlanBadge,
  UserAvatar,
  WorkspaceAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  ExternalLink,
  HelpCircle,
  LogOut,
  Monitor,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Link, useNavigate } from '../router.js';
import { useStudioPlan } from '../plan/use-studio-plan.js';
import { useStudioSession } from '../session-guard.js';
import { lastStudioRoute } from './studio-sidebar.js';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export interface StudioHeaderProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onToggleMobile?: () => void;
  breadcrumb?: { section: string; page: string };
  onOpenCommandPalette?: () => void;
}

/**
 * Top full-width header bar matching the main app architecture:
 * - Left: Workspace Switcher Dropdown, Sidebar Collapse Trigger, Studio Tag & Breadcrumbs
 * - Center: Global Search Command Affordance (Search… with ⌘K / Ctrl+K)
 * - Right: Help, Ask AI and the account menu (plan & credits, theme, sign out)
 */
export function StudioHeader({
  collapsed = false,
  onToggleCollapse,
  onToggleMobile,
  breadcrumb = { section: 'Plan, Run & Approve', page: 'Studio Home' },
  onOpenCommandPalette,
}: StudioHeaderProps) {
  const { user, activeWorkspace, workspaces, setActiveWorkspace, signOut } = useStudioSession();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Same plan record the main app's billing page reads.
  const { plan, planName, credits, lowCredits, canManageBilling, subscription, billingUrl } = useStudioPlan();
  const isFree = plan === 'free';
  const pastDue = subscription?.status === 'PAST_DUE' || subscription?.status === 'UNPAID';
  const creditsAlert = pastDue ? 'Last payment failed' : lowCredits ? 'AI credits running low' : null;

  // The URL owns the workspace: go to the target workspace's last page (else its
  // Studio home) and the route guard swaps the session to match.
  const switchWorkspace = (ws: (typeof workspaces)[number]) => {
    if (ws.id === activeWorkspace.id) return;
    setActiveWorkspace(ws);
    navigate(lastStudioRoute(ws.slug));
  };

  const displayName = user.name || user.email || 'Studio user';
  const displayEmail = user.email || '';

  return (
    <header className="h-11 gap-2 px-2.5 sm:gap-3 sm:px-4 flex shrink-0 items-center select-none border-b border-border/40 bg-background/80 backdrop-blur-md z-30">
      {/* Left Section: Workspace Switcher, Sidebar Toggle & Breadcrumbs */}
      <div className="min-w-0 gap-1.5 sm:gap-2.5 flex flex-1 items-center">
        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Current workspace: ${activeWorkspace.name}`}
              className={cn(
                'group/trigger gap-2 px-1.5 py-1 flex min-w-0 items-center rounded-lg text-left',
                'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent/70',
                'cursor-pointer outline-none select-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              <WorkspaceAvatar
                name={activeWorkspace.name || 'Workspace'}
                src={activeWorkspace.avatarUrl}
                icon={activeWorkspace.icon}
                iconColor={activeWorkspace.iconColor}
                avatarColor={activeWorkspace.avatarColor}
                seed={activeWorkspace.id}
                size="xs"
              />
              <span className="gap-1 flex min-w-0 items-center">
                <span className="truncate max-w-28 sm:max-w-44 text-xs font-semibold text-foreground">
                  {activeWorkspace.name || 'Workspace'}
                </span>
                <ChevronDown className="size-3 text-muted-foreground transition-transform duration-(--duration-fast) group-data-[state=open]/trigger:rotate-180 shrink-0" />
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-68 p-1.5 space-y-1 shadow-2xl rounded-xl border border-border bg-popover text-foreground select-none"
          >
            <DropdownMenuLabel className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
              Workspaces
            </DropdownMenuLabel>
            <div className="space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => switchWorkspace(ws)}
                  className="gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                >
                  <WorkspaceAvatar
                    name={ws.name || 'Workspace'}
                    src={ws.avatarUrl}
                    icon={ws.icon}
                    iconColor={ws.iconColor}
                    avatarColor={ws.avatarColor}
                    seed={ws.id}
                    size="xs"
                  />
                  <span className="truncate flex-1 font-medium">{ws.name}</span>
                  {ws.id === activeWorkspace.id && <Check className="size-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 px-2 py-1.5 text-xs cursor-pointer">
              <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
                <ExternalLink className="size-3.5 text-muted-foreground" />
                <span>Open main platform</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sidebar Toggle Button */}
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
            className="size-7 p-0 touch-target shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Toggle navigation"
          >
            <PanelLeft className="size-4" />
          </Button>
        </Hint>

        {/* Studio Badge & Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="hidden md:inline-flex items-center rounded-md bg-brand/10 px-1.5 py-0.5 text-2xs font-semibold text-brand-text ring-1 ring-brand/20 ring-inset">
            Studio
          </span>
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs font-medium truncate">
            <span className="text-muted-foreground hover:text-foreground transition-colors truncate hidden sm:inline">
              {breadcrumb.section}
            </span>
            <ChevronRight className="size-3 text-muted-foreground/60 shrink-0 hidden sm:inline" />
            <span className="text-foreground font-semibold truncate">
              {breadcrumb.page}
            </span>
          </nav>
        </div>
      </div>

      {/* Center Section: Centered Search Command Trigger matching Main Platform AppHeader */}
      <div className="gap-1.5 sm:gap-2 flex shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className={cn(
            'h-7.5 w-52 sm:w-64 md:w-80 gap-2 px-2.5 sm:flex hidden items-center rounded-lg',
            'text-xs shadow-2xs border border-border/80 bg-card text-muted-foreground',
            'cursor-pointer transition-colors duration-(--duration-fast) ease-standard',
            'hover:border-border-strong hover:bg-accent/40 hover:text-foreground',
            'outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">Search…</span>
          <KbdShortcut keys={['mod', 'K']} size="xs" variant="muted" className="ml-auto shrink-0" />
        </button>
      </div>

      {/* Right Section: Mobile Search, Help, Ask AI and the account menu */}
      <div className="gap-1 sm:gap-1.5 flex flex-1 shrink-0 items-center justify-end">
        {/* Mobile Search Button */}
        <Hint label="Search">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenCommandPalette}
            aria-label="Search"
            className="sm:hidden size-7 p-0 flex touch-target text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Search className="size-4" />
          </Button>
        </Hint>

        {/* Help & Resources (matches (?) circle icon in main app header) */}
        <Hint label="Help & Resources">
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            className="size-7 p-0 hidden sm:flex text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Help & Resources"
          >
            <Link to="/developer">
              <HelpCircle className="size-4" />
            </Link>
          </Button>
        </Hint>

        {/* Ask AI Button (matches [✨ Ask AI] button in main app header) */}
        <Hint label="Ask AI Studio Assistant">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1 px-2 text-xs font-medium sm:gap-1.5 sm:px-3 h-7 touch-target cursor-pointer"
            aria-label="Ask AI"
          >
            <Link to="/create">
              <Sparkles className="size-3.5" />
              <span className="sm:inline hidden">Ask AI</span>
            </Link>
          </Button>
        </Hint>

        {/* Account menu: identity, plan & credits, theme, sign out */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative ml-0.5 flex touch-target cursor-pointer items-center justify-center rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={creditsAlert ? `Account menu — ${creditsAlert}` : 'Account menu'}
            >
              <UserAvatar
                name={displayName}
                src={user.avatarUrl ?? undefined}
                seed={user.id}
                size="sm"
                indicator={false}
              />
              {/* The plan chip moved into this menu; keep billing trouble visible from the bar. */}
              {creditsAlert ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-background',
                    pastDue ? 'bg-destructive' : 'bg-warning',
                  )}
                />
              ) : null}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={6} className="w-72">
            <div className="flex items-center gap-3 px-2 py-1.5">
              <UserAvatar
                name={displayName}
                src={user.avatarUrl ?? undefined}
                seed={user.id}
                size="md"
                indicator={false}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                {displayEmail ? (
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                ) : null}
              </div>
            </div>

            {plan ? (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <PlanBadge plan={plan} size="xs" variant="gradient" />
                      <span className="text-xs font-semibold text-foreground">{planName} plan</span>
                    </span>
                    {credits !== null ? (
                      <span
                        className={cn(
                          'flex items-center gap-1 text-xs tabular-nums',
                          lowCredits ? 'font-semibold text-warning-text' : 'text-muted-foreground',
                        )}
                      >
                        <Coins className="size-3" aria-hidden />${credits.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                  {creditsAlert ? (
                    <p className={cn('mt-1 text-xs', pastDue ? 'text-destructive-text' : 'text-warning-text')}>
                      {creditsAlert}
                    </p>
                  ) : null}
                </div>
                <DropdownMenuItem asChild className="gap-2.5 text-xs">
                  <Link to="/settings?tab=usage">Usage & limits</Link>
                </DropdownMenuItem>
                {canManageBilling ? (
                  <>
                    <DropdownMenuItem asChild className="gap-2.5 text-xs">
                      <a href={billingUrl()}>{isFree ? 'Upgrade plan' : 'Manage plan & billing'}</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="gap-2.5 text-xs">
                      <a href={billingUrl({ topUp: true })}>Top up credits</a>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem asChild className="gap-2.5 text-xs">
                    <a href={billingUrl()}>View plans</a>
                  </DropdownMenuItem>
                )}
              </>
            ) : null}

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')} className="gap-2.5 text-xs">
              <Settings className="size-3.5 text-muted-foreground" />
              <span>Studio Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/developer')} className="gap-2.5 text-xs">
              <HelpCircle className="size-3.5 text-muted-foreground" />
              <span>Documentation</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value} className="gap-2 text-xs">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void signOut()}
              className="gap-2.5 text-xs"
            >
              <LogOut className="size-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

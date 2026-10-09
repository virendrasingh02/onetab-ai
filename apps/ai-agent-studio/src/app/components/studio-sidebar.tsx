import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  Input,
  ScrollArea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Code2,
  ExternalLink,
  GitBranch,
  Layers,
  LayoutDashboard,
  MoreHorizontal,
  Plug,
  Settings,
  ShieldAlert,
  UserPlus,
  Wrench,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  fetchWorkspaceApprovals,
  workspaceApprovalsKey,
} from '../services/approvals-query.js';
import { useStudioSession } from '../session-guard.js';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  showsPendingApprovals?: boolean;
}

export interface NavGroup {
  id: string;
  title: string;
  icon?: ComponentType<{ className?: string }>;
  items: NavItem[];
  badge?: string;
  showsPendingApprovals?: boolean;
}

/**
 * Navigation groups matching the studio architecture with authentic nav names.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'build-orchestrate',
    title: 'Build & Orchestrate',
    items: [
      {
        to: '/agents',
        label: 'My Agents',
        icon: Bot,
      },
      {
        to: '/workflows',
        label: 'Visual Workflows',
        icon: GitBranch,
      },
      {
        to: '/templates',
        label: 'Agent Templates',
        icon: Layers,
      },
    ],
  },
  {
    id: 'intelligence-tools',
    title: 'Intelligence & Tools',
    items: [
      {
        to: '/connectors',
        label: 'App Connectors',
        icon: Boxes,
      },
      {
        to: '/widgets',
        label: 'Widget Center',
        icon: LayoutDashboard,
      },
      {
        to: '/knowledge',
        label: 'Knowledge & RAG',
        icon: BookOpen,
      },
      {
        to: '/tools',
        label: 'Tools & Integrations',
        icon: Wrench,
      },
      {
        to: '/mcp',
        label: 'MCP Registry',
        icon: Plug,
      },
    ],
  },
  {
    id: 'operations-governance',
    title: 'Operations & Governance',
    showsPendingApprovals: true,
    items: [
      {
        to: '/executions',
        label: 'Executions & Logs',
        icon: Activity,
      },
      {
        to: '/approvals',
        label: 'Human Approvals',
        icon: ShieldAlert,
        showsPendingApprovals: true,
      },
      {
        to: '/analytics',
        label: 'Studio Analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'platform-config',
    title: 'Platform & Config',
    items: [
      {
        to: '/settings',
        label: 'Settings & Security',
        icon: Settings,
      },
      {
        to: '/developer',
        label: 'Developer Hub',
        icon: Code2,
      },
    ],
  },
];

/**
 * Invite Team Dialog
 */
function InviteTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [sent, setSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setEmail('');
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Invite Team Members</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Invite engineers, AI architects, or operators to this workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email address</label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Studio Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
            >
              <option value="developer">Agent Developer (Full Builder)</option>
              <option value="operator">Operator (Run & Monitor)</option>
              <option value="auditor">Auditor (Read-Only Traces)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={sent}>
              {sent ? 'Invitation Sent!' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/*
 * Row geometry mirrors the main platform sidebar (`navRowClass` /
 * `IconOnlyNavRow` / `Section` in @org/web-layout's nav-primitives) so the
 * Studio and the platform read as one product: 14px labels, 16px icons,
 * `rounded-xl` rows and a primary-tinted selected state.
 */
const ROW_BASE =
  'group relative flex w-full items-center gap-2.5 rounded-xl py-1.5 pl-2.5 pr-2 text-left text-sm tracking-[-0.01em] pointer-coarse:min-h-11 transition-all duration-(--duration-fast) ease-standard outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer';

const ROW_ACTIVE =
  'font-semibold text-primary-text bg-primary/12 shadow-2xs ring-1 ring-inset ring-primary/20';

const ROW_IDLE = 'font-medium text-foreground/90 hover:bg-accent/70 hover:text-foreground';

const ICON_ROW =
  'relative mx-auto flex size-9 items-center justify-center rounded-xl transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer';

const ICON_ACTIVE =
  'bg-primary/12 text-primary-text shadow-2xs ring-1 ring-inset ring-primary/20';

const ICON_IDLE = 'text-muted-foreground hover:bg-accent/70 hover:text-foreground';

function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive/12 px-1.5 font-mono text-[10px] font-semibold tabular-nums text-destructive',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** One navigation row; renders an icon-only tile with a tooltip when collapsed. */
function StudioNavRow({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  count,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  collapsed: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const hasCount = count !== undefined && count > 0;

  if (collapsed) {
    return (
      <Hint side="right" label={hasCount ? `${label} (${count})` : label}>
        <NavLink
          to={to}
          end={end}
          onClick={onNavigate}
          aria-label={label}
          className={({ isActive }) => cn(ICON_ROW, isActive ? ICON_ACTIVE : ICON_IDLE)}
        >
          <Icon className="size-4 shrink-0" />
          {hasCount ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive ring-2 ring-card" />
          ) : null}
        </NavLink>
      </Hint>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => cn(ROW_BASE, isActive ? ROW_ACTIVE : ROW_IDLE)}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {hasCount ? <CountBadge count={count} /> : null}
    </NavLink>
  );
}

/** Collapsible titled group — same header treatment as the platform's `Section`. */
function StudioNavSection({
  title,
  open,
  onOpenChange,
  collapsedCount,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown beside the title while the section is folded, so nothing hides. */
  collapsedCount?: number;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <section aria-label={title} className="mt-3">
        <div className="group/section flex items-center px-2.5 py-1 select-none">
          <CollapsibleTrigger
            aria-label={`Toggle ${title} section`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-[11px] font-semibold uppercase tracking-wide text-foreground/75 outline-none transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="truncate">{title}</span>
            <ChevronDown
              className={cn(
                'size-3 shrink-0 text-foreground/60 opacity-0 transition-all duration-150 group-hover/section:opacity-100 group-focus-within/section:opacity-100 pointer-coarse:opacity-100',
                !open && '-rotate-90 opacity-100',
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          {!open && collapsedCount ? <CountBadge count={collapsedCount} /> : null}
        </div>
        <CollapsibleContent>
          <div className="mt-0.5 space-y-0.5">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

const EXPANDED_GROUPS_KEY = 'onetab_studio_sidebar_expanded_groups';

function persistExpanded(value: Record<string, boolean>) {
  try {
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface StudioSidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Full-height Studio sidebar: workspace switcher header, Overview, collapsible
 * nav sections, and a pinned footer (Invite Team + profile menu).
 */
export function StudioSidebar({
  className,
  collapsed: collapsedProp = false,
  mobileOpen = false,
  onCloseMobile,
}: StudioSidebarProps) {
  const { user, activeWorkspace, workspaces, setActiveWorkspace } = useStudioSession();
  const location = useLocation();
  const navigate = useNavigate();

  // The mobile drawer is always full width, whatever the desktop rail state.
  const collapsed = collapsedProp && !mobileOpen;

  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: workspaceApprovalsKey(activeWorkspace.id, 'PENDING'),
    queryFn: () => fetchWorkspaceApprovals(activeWorkspace.id, 'PENDING'),
    staleTime: 30_000,
  });
  const pendingCount = pendingApprovals.length;

  // All sections open by default; the user's folds persist across reloads.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const defaults = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, true]));
    try {
      const saved = localStorage.getItem(EXPANDED_GROUPS_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return defaults;
  });

  const setGroupOpen = useCallback((groupId: string, open: boolean) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [groupId]: open };
      persistExpanded(next);
      return next;
    });
  }, []);

  // Unfold the section holding the current route on direct navigation.
  useEffect(() => {
    const p = location.pathname;
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) =>
        item.end ? p === item.to : p === item.to || p.startsWith(item.to + '/'),
      ),
    );
    if (!activeGroup) return;
    setExpandedGroups((prev) => {
      if (prev[activeGroup.id]) return prev;
      const next = { ...prev, [activeGroup.id]: true };
      persistExpanded(next);
      return next;
    });
  }, [location.pathname]);

  const displayName = user.name || user.email || 'Studio user';
  const displayEmail = user.email || '';
  const initials =
    displayName
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  const workspaceInitial = (activeWorkspace.name || 'W').charAt(0).toUpperCase();

  const workspaceMark = (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-2xs">
      {workspaceInitial}
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'flex flex-col border-r border-border/70 bg-card z-50 md:z-auto transition-all duration-200 select-none shrink-0 h-dvh',
          mobileOpen
            ? 'fixed inset-y-0 left-0 w-[272px] shadow-2xl md:relative md:shadow-none'
            : cn('hidden md:flex', collapsed ? 'w-[68px]' : 'w-[272px]'),
          className,
        )}
      >
        {/* Header: workspace switcher */}
        <div className="h-14 px-2.5 flex items-center border-b border-border/40 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full min-w-0 items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-accent/70 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  collapsed && 'justify-center',
                )}
                aria-label="Switch workspace"
              >
                {workspaceMark}
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold leading-tight text-foreground">
                        {activeWorkspace.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">AI Agent Studio</div>
                    </div>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws)}
                  className="gap-2 text-sm"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-foreground">
                    {(ws.name || 'W').charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspace.id && <Check className="size-4 ml-auto text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setInviteOpen(true)} className="gap-2 text-sm">
                <UserPlus className="size-4" />
                <span>Invite Team…</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 text-sm">
                <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
                  <ExternalLink className="size-4" />
                  <span>Open main platform</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Scrollable Navigation Body */}
        <ScrollArea className="flex-1 px-2.5 py-3">
          <nav className="space-y-0.5" aria-label="Studio">
            <StudioNavRow
              to="/overview"
              end
              label="Studio Overview"
              icon={LayoutDashboard}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
            />

            {NAV_GROUPS.map((group) => {
              const rows = group.items.map((item) => (
                <StudioNavRow
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  label={item.label}
                  icon={item.icon}
                  collapsed={collapsed}
                  count={item.showsPendingApprovals ? pendingCount : undefined}
                  onNavigate={onCloseMobile}
                />
              ));

              if (collapsed) {
                return (
                  <div
                    key={group.id}
                    className="mt-2 space-y-0.5 border-t border-border/40 pt-2"
                    aria-label={group.title}
                  >
                    {rows}
                  </div>
                );
              }

              return (
                <StudioNavSection
                  key={group.id}
                  title={group.title}
                  open={expandedGroups[group.id] ?? true}
                  onOpenChange={(open) => setGroupOpen(group.id, open)}
                  collapsedCount={group.showsPendingApprovals ? pendingCount : undefined}
                >
                  {rows}
                </StudioNavSection>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Pinned Footer: Invite Team + profile */}
        <div className="p-2.5 border-t border-border/40 space-y-1 shrink-0">
          {collapsed ? (
            <Hint side="right" label="Invite Team">
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                aria-label="Invite Team"
                className={cn(ICON_ROW, ICON_IDLE)}
              >
                <UserPlus className="size-4 shrink-0" />
              </button>
            </Hint>
          ) : (
            <button type="button" onClick={() => setInviteOpen(true)} className={cn(ROW_BASE, ROW_IDLE)}>
              <UserPlus className="size-4 shrink-0" />
              <span className="flex-1 truncate">Invite Team</span>
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-accent/70 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  collapsed && 'justify-center',
                )}
                aria-label="Account menu"
              >
                <Avatar className="size-8 rounded-lg border border-border/60">
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback className="rounded-lg bg-foreground text-background text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold leading-tight text-foreground">
                        {displayName}
                      </div>
                      {displayEmail ? (
                        <div className="truncate text-xs text-muted-foreground">{displayEmail}</div>
                      ) : null}
                    </div>
                    <MoreHorizontal className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" side="top" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold leading-none text-foreground">{displayName}</p>
                  {displayEmail ? (
                    <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 text-sm">
                <Settings className="size-4 text-muted-foreground" />
                <span>Studio Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/developer')} className="gap-2 text-sm">
                <BookOpen className="size-4 text-muted-foreground" />
                <span>Documentation</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 text-sm">
                <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
                  <ExternalLink className="size-4 text-muted-foreground" />
                  <span>Main Platform</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Invite Team Dialog */}
      <InviteTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

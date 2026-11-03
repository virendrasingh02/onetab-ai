import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Hint,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetTitle,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  ChevronDown,
  Code2,
  Home,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldAlert,
  UserPlus,
  Wand2,
  Wrench,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, scopeStudioPath, useLocation, useNavigate } from '../router.js';
import {
  fetchWorkspaceApprovals,
  workspaceApprovalsKey,
} from '../services/approvals-query.js';
import { useStudioSession } from '../session-guard.js';
import { studioCorePath } from '../studio-core-bridge.js';
import { studioSectionPaths } from './section-tabs.js';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** Other routes this row stands for (sibling pages behind its section tabs). */
  match?: string[];
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
export function buildNavGroups(slug: string): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: 'plan-run',
      title: 'Plan, Run & Approve',
      showsPendingApprovals: true,
      items: [
        { to: studioCorePath(slug), label: 'Studio Home', icon: Home, end: true },
        { to: studioCorePath(slug, 'runs'), label: 'Runs', icon: Activity },
        {
          to: studioCorePath(slug, 'approvals'),
          label: 'Human Approvals',
          icon: ShieldAlert,
          showsPendingApprovals: true,
        },
      ],
    },
    {
      id: 'build-orchestrate',
      title: 'Build & Orchestrate',
      items: [
        {
          to: '/agents',
          label: 'Agents & Workflows',
          icon: Bot,
          match: studioSectionPaths(slug, 'agents'),
        },
        {
          to: '/templates',
          label: 'Templates',
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
          label: 'Tools',
          icon: Wrench,
          match: studioSectionPaths(slug, 'tools'),
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
          label: 'Agent Chat Logs',
          icon: MessageSquare,
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
  return groups.map((g) => ({
    ...g,
    items: g.items.map((item) => ({ ...item, to: scopeStudioPath(slug, item.to) })),
  }));
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
        'ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive/12 px-1.5 font-mono text-2xs font-semibold tabular-nums text-destructive',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Whether `pathname` is this row's page, or one of the pages it stands for. */
function isNavItemActive(item: Pick<NavItem, 'to' | 'end' | 'match'>, pathname: string): boolean {
  const under = (to: string) => pathname === to || pathname.startsWith(to + '/');
  if (item.end ? pathname === item.to : under(item.to)) return true;
  return item.match?.some(under) ?? false;
}

/** One navigation row; renders an icon-only tile with a tooltip when collapsed. */
function StudioNavRow({
  to,
  label,
  icon: Icon,
  end,
  match,
  collapsed,
  count,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  match?: string[];
  collapsed: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const hasCount = count !== undefined && count > 0;
  const { pathname } = useLocation();
  // NavLink's own matching only knows `to`; a section row is also active on its siblings.
  // Resolved here as a plain string: under `Hint` (Radix Slot) a function className is
  // stringified into the class attribute, which silently drops every style.
  const active = isNavItemActive({ to, end, match }, pathname);

  if (collapsed) {
    return (
      <Hint side="right" label={hasCount ? `${label} (${count})` : label}>
        <NavLink
          to={to}
          end={end}
          onClick={onNavigate}
          aria-label={label}
          className={cn(ICON_ROW, active ? ICON_ACTIVE : ICON_IDLE)}
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
      className={cn(ROW_BASE, active ? ROW_ACTIVE : ROW_IDLE)}
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
      <section aria-label={title} className="mt-3.5 first:mt-1">
        <div className="group/section flex items-center px-2 py-1 select-none">
          <CollapsibleTrigger
            aria-label={`Toggle ${title} section`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-xs font-semibold uppercase tracking-wide text-foreground/75 outline-none transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
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
const LAST_ROUTE_KEY = 'onetab_studio_last_route_by_workspace';

function readLastRoutes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_ROUTE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Where to land when switching to `slug`: its last Studio page, else its Studio home. */
export function lastStudioRoute(slug: string): string {
  const saved = readLastRoutes()[slug];
  return saved?.startsWith(`/w/${slug}/ai`) ? saved : `/w/${slug}/ai`;
}

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
 * Clean floating card Studio sidebar matching the main platform shell layout:
 * - Top CTA: Create with AI button
 * - Scrollable Navigation: Authentic categorized sections with collapsible state
 * - Pinned Footer: Invite Team button
 */
export function StudioSidebar({
  className,
  collapsed: collapsedProp = false,
  mobileOpen = false,
  onCloseMobile,
}: StudioSidebarProps) {
  const { activeWorkspace } = useStudioSession();
  const location = useLocation();
  const navigate = useNavigate();

  const openInvite = () => {
    onCloseMobile?.();
    navigate('/settings?tab=members&invite=1');
  };
  const navGroups = useMemo(() => buildNavGroups(activeWorkspace.slug), [activeWorkspace.slug]);

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: workspaceApprovalsKey(activeWorkspace.id, 'PENDING'),
    queryFn: () => fetchWorkspaceApprovals(activeWorkspace.id, 'PENDING'),
    staleTime: 30_000,
  });
  const pendingCount = pendingApprovals.length;

  // All sections open by default; the user's folds persist across reloads.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const defaults = Object.fromEntries(navGroups.map((g) => [g.id, true]));
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
    const activeGroup = navGroups.find((g) =>
      g.items.some((item) => isNavItemActive(item, p)),
    );
    if (!activeGroup) return;
    setExpandedGroups((prev) => {
      if (prev[activeGroup.id]) return prev;
      const next = { ...prev, [activeGroup.id]: true };
      persistExpanded(next);
      return next;
    });
  }, [location.pathname, navGroups]);

  // Remember where the user was in each workspace so switching back resumes it.
  useEffect(() => {
    const prefix = `/w/${activeWorkspace.slug}/ai`;
    if (!location.pathname.startsWith(prefix)) return;
    try {
      localStorage.setItem(
        LAST_ROUTE_KEY,
        JSON.stringify({
          ...readLastRoutes(),
          [activeWorkspace.slug]: `${location.pathname}${location.search}`,
        }),
      );
    } catch {
      // Storage blocked: the page just isn't remembered.
    }
  }, [activeWorkspace.slug, location.pathname, location.search]);

  /** The navigation panel, shared by the desktop rail and the mobile sheet. */
  const renderPanel = (collapsed: boolean) => (
    <>
      {/* Primary journey entry: describe → plan → build */}
      <div className="shrink-0 p-2.5 pb-2.5 border-b border-border/40">
        {collapsed ? (
          <div className="flex justify-center">
            <Hint side="right" label="Create with AI">
              <Button asChild size="icon-lg" className="size-9 rounded-xl shadow-xs cursor-pointer">
                <NavLink to="/create" onClick={onCloseMobile} aria-label="Create with AI">
                  <Wand2 className="size-4 shrink-0" />
                </NavLink>
              </Button>
            </Hint>
          </div>
        ) : (
          <Button
            asChild
            size="lg"
            className="w-full gap-2 rounded-xl font-semibold shadow-xs cursor-pointer pointer-coarse:min-h-11"
          >
            <NavLink to="/create" onClick={onCloseMobile}>
              <Wand2 className="size-4 shrink-0" />
              <span>Create with AI</span>
            </NavLink>
          </Button>
        )}
      </div>

      {/* Scrollable Navigation Body */}
      <ScrollArea className="flex-1 min-h-0" contentClassName="p-2.5 pt-3 pb-3 space-y-2">
        <nav className="space-y-0.5" aria-label="Studio">
          {navGroups.map((group) => {
            const rows = group.items.map((item) => (
              <StudioNavRow
                key={item.to}
                to={item.to}
                end={item.end}
                match={item.match}
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

      {/* Pinned Footer: Invite Team */}
      <div className="p-2.5 border-t border-border/40 shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <Hint side="right" label="Invite Team">
              <button
                type="button"
                onClick={() => openInvite()}
                aria-label="Invite Team"
                className={cn(ICON_ROW, ICON_IDLE)}
              >
                <UserPlus className="size-4 shrink-0" />
              </button>
            </Hint>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openInvite()}
            className={cn(ROW_BASE, ROW_IDLE)}
          >
            <UserPlus className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">Invite Team</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop floating card rail */}
      <aside
        className={cn(
          'group/sidebar hidden md:flex flex-col h-full shrink-0 overflow-hidden rounded-xl border border-border bg-surface-muted text-sidebar-foreground transition-[width] duration-150',
          collapsedProp ? 'w-[68px]' : 'w-[260px]',
          className,
        )}
        aria-label="Studio navigation"
      >
        {renderPanel(collapsedProp)}
      </aside>

      {/* Mobile drawer: a sheet gives it focus trapping, Escape and scroll lock */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onCloseMobile?.()}>
        <SheetContent
          side="left"
          hideCloseButton
          aria-describedby={undefined}
          className="w-[260px] max-w-[85vw] gap-0 border-r border-border bg-surface-muted p-0 select-none md:hidden"
        >
          <SheetTitle className="sr-only">Studio navigation</SheetTitle>
          {renderPanel(false)}
        </SheetContent>
      </Sheet>
    </>
  );
}

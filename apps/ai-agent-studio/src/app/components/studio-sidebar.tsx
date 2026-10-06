import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
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
  Input,
  ScrollArea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  GitBranch,
  Layers,
  LayoutDashboard,
  MoreHorizontal,
  Plug,
  Settings,
  Shield,
  ShieldAlert,
  UserPlus,
  Wrench,
} from 'lucide-react';
import type { ComponentType } from 'react';
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
  icon: ComponentType<{ className?: string }>;
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
    icon: GitBranch,
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
    icon: Wrench,
    items: [
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
    icon: Activity,
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
    icon: Shield,
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

export interface StudioSidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Full-height left sidebar matching reference image layout.
 * Features:
 * - Brand header: [U/O] ReUI / OneTab AI + ... options
 * - Platform section (Overview + Live Activity)
 * - Hierarchical collapsible groups (Pipelines, Infrastructure, Observability, Security)
 * - Indented tree lines and capsule active items
 * - Collapsible Resources telemetry section (API Gateway, ML Pipeline, Database, CDN, Authentication)
 * - Pinned footer: Settings, Invite Team, Documentation, and User Profile card (Nick Bold)
 */
export function StudioSidebar({
  className,
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
}: StudioSidebarProps) {
  const { user, activeWorkspace, workspaces, setActiveWorkspace } = useStudioSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: workspaceApprovalsKey(activeWorkspace.id, 'PENDING'),
    queryFn: () => fetchWorkspaceApprovals(activeWorkspace.id, 'PENDING'),
    staleTime: 30_000,
  });
  const pendingCount = pendingApprovals.length;

  // Track expanded groups with persistence & auto-expansion (all open by default so all navs are visible)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const defaultExpanded: Record<string, boolean> = {
      'build-orchestrate': true,
      'intelligence-tools': true,
      'operations-governance': true,
      'platform-config': true,
    };
    try {
      const saved = localStorage.getItem('onetab_studio_sidebar_expanded_groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultExpanded, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaultExpanded;
  });

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const updated = {
        ...prev,
        [groupId]: !prev[groupId],
      };
      try {
        localStorage.setItem('onetab_studio_sidebar_expanded_groups', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  // Auto-expand group upon direct navigation
  useEffect(() => {
    const p = location.pathname;
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) =>
        item.end
          ? p === item.to
          : p === item.to || p.startsWith(item.to + '/'),
      ),
    );

    if (activeGroup) {
      setExpandedGroups((prev) => {
        if (prev[activeGroup.id]) return prev;
        const next = { ...prev, [activeGroup.id]: true };
        try {
          localStorage.setItem('onetab_studio_sidebar_expanded_groups', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [location.pathname]);

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
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl md:relative md:shadow-none'
            : cn('hidden md:flex', collapsed ? 'w-[68px]' : 'w-64'),
          className,
        )}
      >
        {/* Top Header: Logo + Brand + 3-dots options (Ref Image: ReUI ...) */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark */}
            <div className="size-7 rounded-md bg-foreground text-background flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <span className="font-extrabold tracking-tight">U</span>
            </div>

            {!collapsed && (
              <span className="font-bold text-sm tracking-tight text-foreground truncate">
                ReUI
              </span>
            )}
          </div>

          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                  aria-label="Workspace options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws)}
                    className="gap-2 text-xs"
                  >
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspace.id && <Check className="size-3.5 ml-auto text-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setInviteOpen(true)} className="gap-2 text-xs">
                  <UserPlus className="size-3.5" />
                  <span>Invite Team…</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Scrollable Navigation Body */}
        <ScrollArea className="flex-1 px-2.5 py-3">
          <nav className="space-y-4">
            {/* Section: Platform */}
            <div className="space-y-1">
              {!collapsed && (
                <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground tracking-tight">
                  Platform
                </div>
              )}

              {/* Studio Overview */}
              <NavLink
                to="/overview"
                end
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    collapsed && 'justify-center px-0 py-2',
                  )
                }
                title={collapsed ? 'Studio Overview' : undefined}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                {!collapsed && <span>Studio Overview</span>}
              </NavLink>
            </div>

            {/* Hierarchical Navigation Groups (Build & Orchestrate, Intelligence & Tools, Operations & Governance, Platform & Config) */}
            <div className="space-y-1 pt-1">
              {NAV_GROUPS.map((group) => {
                const isGroupExpanded = expandedGroups[group.id] ?? false;

                return (
                  <div key={group.id} className="space-y-0.5">
                    {/* Group Header Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (collapsed && onToggleCollapsed) {
                          onToggleCollapsed();
                        }
                        toggleGroup(group.id);
                      }}
                      className={cn(
                        'group/btn w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground tracking-tight hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer select-none',
                        collapsed && 'justify-center px-0 py-2',
                      )}
                      title={collapsed ? group.title : undefined}
                    >
                      <group.icon className="size-3.5 shrink-0 text-muted-foreground group-hover/btn:text-foreground transition-colors" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate text-muted-foreground group-hover/btn:text-foreground transition-colors">
                            {group.title}
                          </span>
                          {group.showsPendingApprovals && pendingCount > 0 && !isGroupExpanded && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 mr-1 tabular-nums">
                              {pendingCount}
                            </span>
                          )}
                          {group.badge && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 mr-1 tabular-nums">
                              {group.badge}
                            </span>
                          )}
                          <ChevronRight
                            className={cn(
                              'size-3.5 text-muted-foreground/60 group-hover/btn:text-foreground transition-transform duration-200 shrink-0 origin-center',
                              isGroupExpanded && 'rotate-90',
                            )}
                          />
                        </>
                      )}
                    </button>

                    {/* Group Indented Children (Ref image: tree line + sleek capsule active item) */}
                    {!collapsed && (
                      <div
                        className={cn(
                          'grid transition-all duration-200 ease-in-out',
                          isGroupExpanded
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0 pointer-events-none',
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-3.5 pl-3 border-l border-border/40 my-1 space-y-0.5">
                            {group.items.map((item) => (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={onCloseMobile}
                                className={({ isActive }) =>
                                  cn(
                                    'group/item flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors font-medium',
                                    isActive
                                      ? 'bg-accent text-foreground font-semibold shadow-2xs'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
                                  )
                                }
                              >
                                <item.icon className="size-3.5 shrink-0 text-muted-foreground/80 group-hover/item:text-foreground transition-colors" />
                                <span className="truncate flex-1 text-left">{item.label}</span>
                                {item.showsPendingApprovals && pendingCount > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 tabular-nums shrink-0">
                                    {pendingCount}
                                  </span>
                                )}
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </ScrollArea>

        {/* Pinned Footer (Ref image: Settings, Invite Team, Documentation, User Profile Card) */}
        <div className="p-2 border-t border-border/40 space-y-0.5 shrink-0">
          {/* Settings */}
          <NavLink
            to="/settings"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-accent text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </NavLink>

          {/* Invite Team */}
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors text-left cursor-pointer',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? 'Invite Team' : undefined}
          >
            <UserPlus className="size-4 shrink-0" />
            {!collapsed && <span>Invite Team</span>}
          </button>

          {/* Documentation */}
          <NavLink
            to="/developer"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-accent text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? 'Documentation' : undefined}
          >
            <BookOpen className="size-4 shrink-0" />
            {!collapsed && <span>Documentation</span>}
          </NavLink>

          {/* User Profile Card (Ref image: Nick Bold with 3-dots) */}
          <div className="pt-1.5 mt-1 border-t border-border/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2.5 p-1 rounded-lg hover:bg-accent/60 transition-colors text-left group cursor-pointer',
                    collapsed && 'justify-center p-1',
                  )}
                >
                  <Avatar className="size-7 rounded-md border border-border/60">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback className="rounded-md bg-foreground text-background text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {!collapsed && (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate leading-tight">
                          {displayName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {displayEmail}
                        </div>
                      </div>
                      <MoreHorizontal className="size-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56">
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
                <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 text-xs">
                  <Settings className="size-3.5 text-muted-foreground" />
                  <span>Studio Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2 text-xs">
                  <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}`}>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                    <span>Main Platform</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Invite Team Dialog */}
      <InviteTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

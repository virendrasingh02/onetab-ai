import { useTheme } from '@org/design-system';
import {
  Avatar,
  AvatarFallback,
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
  Hint,
  Input,
  LoadingState,
  ScrollArea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  BarChart3,
  Blocks,
  BookOpen,
  Bot,
  Bug,
  Building2,
  Check,
  CheckSquare,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileStack,
  FileText,
  Gauge,
  Globe,
  HardDrive,
  HeartPulse,
  Laptop,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Palette,
  PanelLeft,
  Plug,
  Puzzle,
  Radio,
  Rocket,
  Scale,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Store,
  Sun,
  UserPlus,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: string;
  end?: boolean;
  badge?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
  badge?: string;
}

/**
 * All original navigation routes organized into hierarchical groups
 * matching the ReUI collapsible sidebar architecture.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'analytics',
    title: 'Analytics',
    icon: BarChart3,
    items: [
      { to: '/analytics/users', label: 'Users & Growth', icon: Users },
      { to: '/analytics/platform-usage', label: 'Web vs Desktop', icon: Laptop },
      { to: '/analytics/workspaces', label: 'Workspaces', icon: Building2 },
      { to: '/analytics/apis', label: 'API Intelligence', icon: Server },
      { to: '/analytics/messaging', label: 'Messaging', icon: MessageSquare },
      { to: '/analytics/storage', label: 'Storage & Files', icon: HardDrive },
      { to: '/analytics/devices', label: 'Devices & Clients', icon: Monitor },
      { to: '/analytics/locations', label: 'Geographic', icon: Globe },
      { to: '/analytics/engagement', label: 'Engagement', icon: Zap },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    icon: DollarSign,
    items: [
      { to: '/analytics/revenue', label: 'Revenue & Finance', icon: DollarSign },
      { to: '/analytics/subscriptions', label: 'Subscriptions', icon: CreditCard },
    ],
  },
  {
    id: 'system',
    title: 'System',
    icon: HeartPulse,
    badge: '14',
    items: [
      { to: '/health', label: 'System Health', icon: HeartPulse },
      { to: '/performance', label: 'Performance', icon: Gauge },
      { to: '/errors', label: 'Error Tracking', icon: Bug },
      { to: '/emails', label: 'Email Deliveries', icon: Mail },
    ],
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    icon: Building2,
    items: [
      { to: '/enterprise', label: 'Governance', icon: Building2, end: true },
      { to: '/enterprise/sso', label: 'SSO & SCIM', icon: Shield },
      { to: '/enterprise/audit-logs', label: 'Audit Log', icon: ShieldAlert },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    icon: Store,
    items: [
      { to: '/marketplace', label: 'Catalog', icon: Store, end: true },
      { to: '/marketplace/plugins', label: 'Plugin SDK', icon: Puzzle },
      { to: '/marketplace/themes', label: 'Themes', icon: Palette },
      { to: '/marketplace/agents', label: 'Agents', icon: Bot },
      { to: '/marketplace/workflows', label: 'Workflows', icon: Workflow },
      { to: '/marketplace/components', label: 'Components', icon: Blocks },
      { to: '/marketplace/integrations', label: 'Integrations', icon: Plug },
      { to: '/marketplace/templates', label: 'Templates', icon: FileStack },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Stores',
    icon: ShieldCheck,
    items: [
      { to: '/compliance', label: 'Overview', icon: ShieldCheck, end: true },
      { to: '/compliance/platforms', label: 'Platforms & Stores', icon: Monitor },
      { to: '/compliance/countries', label: 'Jurisdictions', icon: Globe },
      { to: '/compliance/requirements', label: 'Rules & Guidelines', icon: Scale },
      { to: '/compliance/checklist', label: 'Pre-Submission', icon: CheckSquare },
      { to: '/compliance/issues', label: 'Store Rejections', icon: AlertTriangle },
      { to: '/compliance/versions', label: 'Release Gates', icon: Rocket },
      { to: '/compliance/legal', label: 'Legal & Privacy', icon: FileText },
      { to: '/compliance/audit-logs', label: 'Audit Ledger', icon: Shield },
    ],
  },
  {
    id: 'releases',
    title: 'Releases',
    icon: Layers,
    items: [
      { to: '/versions', label: 'Versions & Deployments', icon: Layers },
    ],
  },
];

interface ResourceStatusItem {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'active' | 'live';
  badge: string;
  color: string;
  to: string;
}

const RESOURCE_ITEMS: ResourceStatusItem[] = [
  { id: 'res-1', name: 'API Gateway', status: 'online', badge: 'Prod', color: 'bg-emerald-500', to: '/analytics/apis' },
  { id: 'res-2', name: 'ML Pipeline', status: 'active', badge: 'Active', color: 'bg-purple-500', to: '/performance' },
  { id: 'res-3', name: 'PostgreSQL Cluster', status: 'online', badge: 'US-East', color: 'bg-blue-500', to: '/health' },
  { id: 'res-4', name: 'Object Storage', status: 'online', badge: 'S3', color: 'bg-amber-500', to: '/analytics/storage' },
  { id: 'res-5', name: 'Authentication SSO', status: 'live', badge: 'Secured', color: 'bg-rose-500', to: '/enterprise/sso' },
];

// Flat list for search & title resolution
const ALL_FLAT_NAV_ITEMS: (NavItem & { groupTitle: string })[] = [
  { to: '/overview', label: 'Platform Overview', icon: LayoutDashboard, groupTitle: 'Platform', end: true },
  { to: '/analytics/live', label: 'Live Activity Stream', icon: Radio, groupTitle: 'Platform' },
  { to: '/plans', label: 'Plans & Pricing', icon: Settings, groupTitle: 'Settings' },
  ...NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupTitle: group.title,
    })),
  ),
];

function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Moon className="size-4" />
          ) : theme === 'light' ? (
            <Sun className="size-4" />
          ) : (
            <Monitor className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2">
          <Sun className="size-4" />
          <span>Light</span>
          {theme === 'light' && <Check className="size-3.5 ml-auto text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2">
          <Moon className="size-4" />
          <span>Dark</span>
          {theme === 'dark' && <Check className="size-3.5 ml-auto text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2">
          <Monitor className="size-4" />
          <span>System</span>
          {theme === 'system' && <Check className="size-3.5 ml-auto text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Command Palette (Ctrl+K / Cmd+K)
 */
function SearchCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filteredItems = useMemo(() => {
    if (!query.trim()) return ALL_FLAT_NAV_ITEMS;
    const q = query.toLowerCase();
    return ALL_FLAT_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.groupTitle.toLowerCase().includes(q) ||
        item.to.toLowerCase().includes(q),
    );
  }, [query]);

  const handleSelect = (to: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-xl">
        <div className="flex items-center border-b px-3.5 py-2.5 gap-2">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search pages..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground rounded border">
            ESC
          </kbd>
        </div>

        <ScrollArea className="max-h-72 p-2">
          <div className="text-[11px] font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">
            All Navigation Pages
          </div>
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No matching pages found.
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.to + item.label}
                onClick={() => handleSelect(item.to)}
                type="button"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-accent/80 transition-colors text-left"
              >
                <item.icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.groupTitle}</div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {item.to}
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

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
  const [role, setRole] = useState('operator');
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
            Invite engineers, operators, or compliance officers to access this console.
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
            <label className="text-xs font-medium text-foreground">Console Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground"
            >
              <option value="operator">Platform Operator (Read/Write)</option>
              <option value="admin">Administrator (Full Access)</option>
              <option value="auditor">Auditor (Read-Only Telemetry)</option>
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

/**
 * Modern, Minimalist Sidebar matching the reference image layout.
 * Features:
 * - Slim top brand row with logo mark, name, and 3-dots popover
 * - Collapsible navigation groups with smooth expand/collapse and child route highlighting
 * - Collapsible Resources section with colored status indicators
 * - Pinned footer with Settings, Invite Team, Documentation, and User Profile card
 */
export function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('onetab_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [searchOpen, setSearchOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Active route matching to determine which groups should be initially expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('onetab_admin_sidebar_expanded_groups');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    const p = location.pathname;
    return {
      analytics: p.startsWith('/analytics') && p !== '/analytics/live' && !p.startsWith('/analytics/revenue') && !p.startsWith('/analytics/subscriptions'),
      business: true, // open by default like reference image
      system: p === '/health' || p === '/performance' || p === '/errors' || p === '/emails',
      enterprise: true, // open by default like reference image
      marketplace: p.startsWith('/marketplace'),
      compliance: p.startsWith('/compliance'),
      releases: p.startsWith('/versions'),
      resources: true,
    };
  });

  // Auto-expand active group upon route transition without collapsing user-opened groups
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
          localStorage.setItem('onetab_admin_sidebar_expanded_groups', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [location.pathname]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const updated = {
        ...prev,
        [groupId]: !prev[groupId],
      };
      try {
        localStorage.setItem('onetab_admin_sidebar_expanded_groups', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('onetab_admin_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B for sidebar, Ctrl+K / Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapsed]);

  // Derive human-readable breadcrumb parts based on pathname
  const breadcrumb = useMemo(() => {
    const p = location.pathname;
    const match = ALL_FLAT_NAV_ITEMS.find((item) =>
      item.end ? item.to === p : p === item.to || p.startsWith(item.to + '/'),
    );
    if (match) {
      return {
        section: match.groupTitle,
        page: match.label,
      };
    }
    if (p.includes('/overview') || p === '/') return { section: 'Dashboard', page: 'Overview' };
    if (p.includes('/plans')) return { section: 'Settings', page: 'Plans & Pricing' };
    return { section: 'Dashboard', page: 'Console' };
  }, [location.pathname]);

  const handleSignOut = () => {
    try {
      localStorage.removeItem('onetab_access_token');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground antialiased font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* ====================================================================
          LEFT SIDEBAR (Ref image layout: Sleek header, ReUI navigation, Resources, Pinned footer)
          ==================================================================== */}
      <aside
        className={cn(
          'flex flex-col border-r border-border/70 bg-card z-50 md:z-auto transition-all duration-200 select-none shrink-0',
          mobileOpen
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl md:relative md:shadow-none'
            : cn(
                'hidden md:flex',
                collapsed ? 'w-[68px]' : 'w-64',
              ),
        )}
      >
        {/* Top Header: Logo + Brand + 3-dots options (Ref Image: ReUI ...) */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark */}
            <div className="size-7 rounded-md bg-foreground text-background flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <span className="font-extrabold tracking-tight">O</span>
            </div>

            {!collapsed && (
              <span className="font-bold text-sm tracking-tight text-foreground truncate">
                OneTab AI
              </span>
            )}
          </div>

          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  aria-label="Workspace options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
                <DropdownMenuItem className="gap-2 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Production Console</span>
                  <Check className="size-3.5 ml-auto text-primary" />
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-muted-foreground">
                  <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Staging Cluster</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-muted-foreground">
                  <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                  <span>Sandbox Environment</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSearchOpen(true)} className="gap-2">
                  <Search className="size-3.5" />
                  <span>Search Pages…</span>
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">⌘K</kbd>
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

              {/* 1. Overview */}
              <NavLink
                to="/overview"
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    collapsed && 'justify-center px-0 py-2',
                  )
                }
                title={collapsed ? 'Overview' : undefined}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                {!collapsed && <span>Overview</span>}
              </NavLink>

              {/* 2. Live Activity Stream */}
              <NavLink
                to="/analytics/live"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    collapsed && 'justify-center px-0 py-2',
                  )
                }
                title={collapsed ? 'Live Activity Stream' : undefined}
              >
                <Radio className="size-4 shrink-0 text-emerald-500" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">Live Activity</span>
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  </>
                )}
              </NavLink>

              {/* 3. Collapsible Navigation Groups (Analytics, Business, System, Enterprise, Marketplace, Compliance, Releases) */}
              {NAV_GROUPS.map((group) => {
                const isGroupExpanded = expandedGroups[group.id] ?? false;
                const isAnyChildActive = group.items.some((item) =>
                  item.end
                    ? location.pathname === item.to
                    : location.pathname === item.to || location.pathname.startsWith(item.to + '/'),
                );

                return (
                  <div key={group.id} className="space-y-0.5">
                    {/* Group Header Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (collapsed) {
                          toggleCollapsed();
                        }
                        toggleGroup(group.id);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none',
                        isAnyChildActive && !isGroupExpanded
                          ? 'bg-accent/70 text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        collapsed && 'justify-center px-0 py-2',
                      )}
                      title={collapsed ? group.title : undefined}
                    >
                      <group.icon className="size-4 shrink-0 text-muted-foreground/80" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{group.title}</span>
                          {group.badge && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 mr-1 tabular-nums">
                              {group.badge}
                            </span>
                          )}
                          <ChevronRight
                            className={cn(
                              'size-3.5 text-muted-foreground/60 transition-transform duration-200 shrink-0 origin-center',
                              isGroupExpanded && 'rotate-90 text-foreground',
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
                          <div className="ml-4 pl-3.5 border-l border-border/40 my-1 space-y-0.5">
                            {group.items.map((item) => (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) =>
                                  cn(
                                    'block w-full px-3 py-1.5 rounded-lg text-xs transition-colors truncate font-medium',
                                    isActive
                                      ? 'bg-accent text-foreground font-semibold shadow-2xs'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
                                  )
                                }
                              >
                                {item.label}
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

            {/* Section: Resources (Ref image: Resources v with status dots & pill badges) */}
            <div className="pt-2 border-t border-border/40 space-y-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup('resources')}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-muted-foreground tracking-tight hover:text-foreground transition-colors cursor-pointer select-none"
                >
                  <span>Resources</span>
                  <ChevronRight
                    className={cn(
                      'size-3.5 text-muted-foreground/60 transition-transform duration-200 shrink-0 origin-center',
                      (expandedGroups['resources'] ?? true) && 'rotate-90 text-foreground',
                    )}
                  />
                </button>
              )}

              {(!collapsed ? (expandedGroups['resources'] ?? true) : true) && (
                <div
                  className={cn(
                    'grid transition-all duration-200 ease-in-out',
                    (!collapsed ? (expandedGroups['resources'] ?? true) : true)
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none',
                  )}
                >
                  <div className="overflow-hidden space-y-0.5">
                    {RESOURCE_ITEMS.map((res) => (
                      <NavLink
                        key={res.id}
                        to={res.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors',
                          collapsed && 'justify-center px-0 py-2',
                        )}
                        title={collapsed ? res.name : undefined}
                      >
                        <span className={cn('size-1.5 rounded-full shrink-0', res.color)} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate text-left">{res.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-muted-foreground bg-muted border border-border/50 shrink-0">
                              {res.badge}
                            </span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </ScrollArea>

        {/* Pinned Footer (Ref image: Settings, Invite Team, Documentation, User Profile Card) */}
        <div className="p-2 border-t border-border/40 space-y-0.5 shrink-0">
          {/* Settings */}
          <NavLink
            to="/plans"
            onClick={() => setMobileOpen(false)}
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
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors text-left',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? 'Invite Team' : undefined}
          >
            <UserPlus className="size-4 shrink-0" />
            {!collapsed && <span>Invite Team</span>}
          </button>

          {/* Documentation */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? 'Documentation' : undefined}
          >
            <BookOpen className="size-4 shrink-0" />
            {!collapsed && <span>Documentation</span>}
          </a>

          {/* User Profile Card (Ref image: Nick Bold with 3-dots) */}
          <div className="pt-1.5 mt-1 border-t border-border/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2.5 p-1 rounded-lg hover:bg-accent/60 transition-colors text-left group',
                    collapsed && 'justify-center p-1',
                  )}
                >
                  <Avatar className="size-7 rounded-md border border-border/60">
                    <AvatarFallback className="rounded-md bg-foreground text-background text-xs font-bold">
                      NB
                    </AvatarFallback>
                  </Avatar>

                  {!collapsed && (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate leading-tight">
                          Nick Bold
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          admin@onetab.ai
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
                      Nick Bold
                    </p>
                    <p className="text-[11px] leading-none text-muted-foreground">
                      admin@onetab.ai
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/analytics/users')} className="gap-2">
                  <Users className="size-3.5 text-muted-foreground" />
                  <span>Operator Accounts</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/plans')} className="gap-2">
                  <Settings className="size-3.5 text-muted-foreground" />
                  <span>Platform Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="size-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          RIGHT MAIN CONTENT AREA
          ==================================================================== */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOP BAR: Breadcrumbs (Ref image: Dashboard > Overview) + Controls */}
        <header className="h-14 border-b border-border/60 bg-background/95 backdrop-blur-xs px-4 sm:px-6 flex shrink-0 items-center justify-between z-30">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button */}
            <Hint label={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setMobileOpen((prev) => !prev);
                  } else {
                    toggleCollapsed();
                  }
                }}
                className="size-8 text-muted-foreground hover:text-foreground"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="size-4" />
              </Button>
            </Hint>

            {/* Breadcrumb Navigation matching ref image: Dashboard > Section > Page */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-muted-foreground">{breadcrumb.section}</span>
              <ChevronRight className="size-3 text-muted-foreground/60" />
              <span className="text-foreground font-semibold">{breadcrumb.page}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Search shortcut button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground bg-accent/40 hover:bg-accent hover:text-foreground rounded-md border border-border/50 transition-colors"
            >
              <Search className="size-3.5" />
              <span>Search…</span>
              <kbd className="text-[10px] font-mono bg-background px-1 py-0.2 rounded border">⌘K</kbd>
            </button>

            {/* GitHub Link */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent/60"
            >
              <GithubIcon className="size-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>

            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/80 bg-background/50 text-[11px] font-medium text-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Live</span>
            </div>

            {/* Theme switcher */}
            <ThemeToggleCompact />
          </div>
        </header>

        {/* MAIN OUTLET CONTAINER: 100% fluid full-width display */}
        <main className="flex-1 overflow-y-auto w-full min-w-0 bg-background">
          <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
            <Suspense
              fallback={
                <div className="py-24 flex items-center justify-center">
                  <LoadingState label="Loading console view…" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <SearchCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <InviteTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

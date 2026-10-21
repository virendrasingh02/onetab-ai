import { useTheme } from '@org/design-system';
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
  LoadingState,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetTitle,
  AppSelect,
  toast,
} from '@org/ui';
import { cn, initials } from '@org/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  adminBillingApi,
  analyticsApi,
  appVersionsApi,
  authApi,
  complianceApi,
  emailTemplatesApi,
  queryKeys,
  setAccessToken,
} from '@org/api-client';
import { SystemRole } from '@org/types';
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
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  DollarSign,
  ExternalLink,
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
  RefreshCw,
  Rocket,
  Scale,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  UserPlus,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

const STUDIO_APP_URL =
  (import.meta.env?.['VITE_STUDIO_APP_URL'] as string | undefined) ??
  'http://localhost:4201';

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
 * All navigation routes organized into hierarchical groups
 * matching the AI Agent Studio and design system architecture.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'analytics',
    title: 'Analytics Intelligence',
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
    title: 'Business & Finance',
    icon: DollarSign,
    items: [
      { to: '/analytics/revenue', label: 'Revenue & Finance', icon: DollarSign },
      { to: '/analytics/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { to: '/billing', label: 'Billing & Coupons', icon: CreditCard },
    ],
  },
  {
    id: 'system',
    title: 'System Operations',
    icon: HeartPulse,
    items: [
      { to: '/health', label: 'System Health', icon: HeartPulse },
      { to: '/performance', label: 'Performance', icon: Gauge },
      { to: '/errors', label: 'Error Tracking', icon: Bug },
      { to: '/emails', label: 'Email Deliveries', icon: Mail },
    ],
  },
  {
    id: 'enterprise',
    title: 'Enterprise Governance',
    icon: Building2,
    items: [
      { to: '/enterprise', label: 'Governance', icon: Building2, end: true },
      { to: '/enterprise/sso', label: 'SSO & SCIM', icon: Shield },
      { to: '/enterprise/audit-logs', label: 'Audit Log', icon: ShieldAlert },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace & Extensions',
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
    title: 'Release Engineering',
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

const DEFAULT_RESOURCE_ITEMS: ResourceStatusItem[] = [
  { id: 'res-api', name: 'API Server', status: 'online', badge: 'Live', color: 'bg-emerald-500', to: '/analytics/apis' },
  { id: 'res-db', name: 'PostgreSQL', status: 'online', badge: 'Live', color: 'bg-emerald-500', to: '/health' },
  { id: 'res-matrix', name: 'Matrix Chat', status: 'online', badge: 'Live', color: 'bg-emerald-500', to: '/analytics/messaging' },
  { id: 'res-storage', name: 'Object Store', status: 'online', badge: 'Live', color: 'bg-emerald-500', to: '/analytics/storage' },
  { id: 'res-cache', name: 'Cache Layer', status: 'online', badge: 'Live', color: 'bg-emerald-500', to: '/performance' },
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

/*
 * Unified design system tokens mirroring AI Agent Studio (`studio-sidebar.tsx`)
 * and the main platform (`nav-primitives.tsx` in @org/web-layout):
 * 14px labels, 16px icons, `rounded-xl` geometry, and primary-tinted selection.
 */
const ROW_BASE =
  'group relative flex w-full items-center gap-2.5 rounded-xl py-1.5 pl-2.5 pr-2 text-left text-sm tracking-[-0.01em] pointer-coarse:min-h-11 transition-all duration-150 ease-standard outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer';

const ROW_ACTIVE =
  'font-semibold text-primary-text bg-primary/12 shadow-2xs ring-1 ring-inset ring-primary/20';

const ROW_IDLE = 'font-medium text-foreground/90 hover:bg-accent/70 hover:text-foreground';

const ICON_ROW =
  'relative mx-auto flex size-9 items-center justify-center rounded-xl transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer';

const ICON_ACTIVE =
  'bg-primary/12 text-primary-text shadow-2xs ring-1 ring-inset ring-primary/20';

const ICON_IDLE = 'text-muted-foreground hover:bg-accent/70 hover:text-foreground';

/** One navigation row; renders an icon-only tile with a tooltip when collapsed. */
function AdminNavRow({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  badge,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  collapsed: boolean;
  badge?: string;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <Hint side="right" label={badge ? `${label} (${badge})` : label}>
        <NavLink
          to={to}
          end={end}
          onClick={onNavigate}
          aria-label={label}
          className={({ isActive }) => cn(ICON_ROW, isActive ? ICON_ACTIVE : ICON_IDLE)}
        >
          <Icon className="size-4 shrink-0" />
          {badge ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-card" />
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
      {badge ? (
        <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums bg-muted border border-border/50 text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

/** Collapsible titled group — matches AI Agent Studio's Section treatment. */
function AdminNavSection({
  title,
  open,
  onOpenChange,
  badge,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <section aria-label={title} className="mt-3">
        <div className="group/section flex items-center px-2.5 py-1 select-none">
          <CollapsibleTrigger
            aria-label={`Toggle ${title} section`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-[11px] font-semibold uppercase tracking-wide text-foreground/75 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
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
          {badge ? (
            <span
              className={cn(
                'ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums border shrink-0',
                badge.includes('Alert')
                  ? 'bg-destructive/12 text-destructive border-destructive/20'
                  : badge.includes('Degraded')
                    ? 'bg-amber-500/12 text-amber-500 border-amber-500/20'
                    : 'bg-primary/12 text-primary border-primary/20',
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <CollapsibleContent>
          <div className="mt-0.5 space-y-0.5">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
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
 * Real live search across pages, workspaces, and user accounts
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

  const trimmed = query.trim();

  const filteredNavItems = useMemo(() => {
    if (!trimmed) return ALL_FLAT_NAV_ITEMS;
    const q = trimmed.toLowerCase();
    return ALL_FLAT_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.groupTitle.toLowerCase().includes(q) ||
        item.to.toLowerCase().includes(q),
    );
  }, [trimmed]);

  // Live real workspace search
  const { data: workspacesData, isLoading: isWorkspacesLoading } = useQuery({
    queryKey: ['admin-search-workspaces', trimmed],
    queryFn: () => adminApi.workspaces({ q: trimmed, pageSize: 4 }),
    enabled: open && trimmed.length >= 2,
    staleTime: 10_000,
  });

  // Live real user accounts search
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['admin-search-users', trimmed],
    queryFn: () => adminApi.users({ q: trimmed, pageSize: 4 }),
    enabled: open && trimmed.length >= 2,
    staleTime: 10_000,
  });

  const handleSelect = (to: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(to);
  };

  const matchingWorkspaces = workspacesData?.items ?? [];
  const matchingUsers = usersData?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 rounded-2xl">
        <div className="flex items-center border-b px-3.5 py-2.5 gap-2">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search console pages, workspaces, or operator accounts..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
            autoFocus
          />
          {(isWorkspacesLoading || isUsersLoading) && (
            <RefreshCw className="size-3.5 text-primary animate-spin shrink-0" />
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground rounded border">
            ESC
          </kbd>
        </div>

        <ScrollArea className="max-h-80 p-2 space-y-3">
          {/* Workspaces Section */}
          {matchingWorkspaces.length > 0 && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-primary px-2.5 py-1 uppercase tracking-wider flex items-center justify-between">
                <span>Platform Workspaces</span>
                <span className="text-[10px] text-muted-foreground font-normal">Real Database</span>
              </div>
              {matchingWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(`/analytics/workspaces/${ws.id}`)}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-foreground hover:bg-accent/80 transition-colors text-left"
                >
                  <Building2 className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{ws.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate font-mono">
                      /{ws.slug} • {ws._count?.members ?? 0} members
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-muted border">
                    {ws.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Users Section */}
          {matchingUsers.length > 0 && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-primary px-2.5 py-1 uppercase tracking-wider flex items-center justify-between">
                <span>Accounts & Operators</span>
                <span className="text-[10px] text-muted-foreground font-normal">Real Database</span>
              </div>
              {matchingUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(`/analytics/users`)}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-foreground hover:bg-accent/80 transition-colors text-left"
                >
                  <Users className="size-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{user.name || user.email}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {user.systemRole}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Navigation Pages */}
          <div>
            <div className="text-[11px] font-medium text-muted-foreground px-2.5 py-1 uppercase tracking-wider">
              Navigation Pages
            </div>
            {filteredNavItems.length === 0 && matchingWorkspaces.length === 0 && matchingUsers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No matching pages, workspaces or accounts found.
              </div>
            ) : (
              filteredNavItems.slice(0, 10).map((item) => (
                <button
                  key={item.to + item.label}
                  onClick={() => handleSelect(item.to)}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-foreground hover:bg-accent/80 transition-colors text-left"
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Invite Team Dialog with real user checking and operator role allocation
 */
function InviteTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'SUPERADMIN' | 'SUPPORT'>('SUPPORT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsSubmitting(true);
    try {
      // Check if this account already exists on the platform
      const userList = await adminApi.users({ q: cleanEmail, pageSize: 1 });
      const existingUser = userList.items.find(
        (u) => u.email.toLowerCase() === cleanEmail,
      );

      const targetRole = role === 'SUPERADMIN' ? SystemRole.SUPERADMIN : SystemRole.SUPPORT;

      if (existingUser) {
        await adminApi.setUserRole(existingUser.id, targetRole);
        toast.success(`Updated permissions for ${existingUser.email} to ${targetRole}`);
      } else {
        // Send actual transactional operator invitation email
        await emailTemplatesApi.test('WORKSPACE_INVITATION', {
          recipient: cleanEmail,
          data: {
            workspace: { name: 'Platform Administration' },
            inviter: { name: 'Platform Superadmin' },
            invitee: { name: cleanEmail.split('@')[0] },
            invitation: {
              url: window.location.origin,
              expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            },
            role: { name: targetRole },
          },
        });
        toast.success(`Platform invitation email dispatched to ${cleanEmail}`);
      }

      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all(), 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-search-users'] });
      setEmail('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Invite Operator or Admin</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Provision or upgrade operator privileges across tenant boundaries.
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
            <label className="text-xs font-medium text-foreground">Assigned System Role</label>
            <AppSelect
              value={role}
              onValueChange={(v) => setRole(v as 'SUPERADMIN' | 'SUPPORT')}
              aria-label="Console role"
              options={[
                { value: 'SUPPORT', label: 'Platform Operator (Telemetry, Support)' },
                { value: 'SUPERADMIN', label: 'Super Administrator (Full System Authority)' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                  Processing…
                </>
              ) : (
                'Save & Send Access'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EXPANDED_GROUPS_KEY = 'onetab_admin_sidebar_expanded_groups';
const COLLAPSED_KEY = 'onetab_admin_sidebar_collapsed';

function persistExpanded(value: Record<string, boolean>) {
  try {
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * Modern Admin Console Shell.
 * Consistent layout, geometry, and design system tokens with AI Agent Studio:
 * - 272px standard desktop rail / 68px icon-only collapsed state
 * - Sleek tenant and platform dropdown header
 * - Prominent Search Console hero CTA button with Cmd+K badge
 * - Collapsible titled sections with live telemetries and primary-tinted selection
 * - Live Infrastructure Health section with latency indicators
 * - Standard Radix Sheet for mobile navigation drawer
 * - Pinned footer with Platform Settings, Invite Operator, Documentation, and User Profile menu
 */
export function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [searchOpen, setSearchOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Real authenticated user data
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authApi.me(),
    staleTime: 60_000,
  });

  // Real system service health telemetries
  const { data: healthData } = useQuery({
    queryKey: queryKeys.analytics.health(),
    queryFn: () => analyticsApi.health(),
    refetchInterval: 15_000,
  });

  // Real platform overview counters
  const { data: adminOverview } = useQuery({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => adminApi.overview(),
    staleTime: 30_000,
  });

  // Real workspaces directory for the workspace switcher
  const { data: workspacesList } = useQuery({
    queryKey: ['admin-sidebar-workspaces'],
    queryFn: () => adminApi.workspaces({ pageSize: 6 }),
    staleTime: 30_000,
  });

  // Real compliance score & issues
  const { data: complianceOverview } = useQuery({
    queryKey: queryKeys.compliance.overview(),
    queryFn: () => complianceApi.overview(),
    staleTime: 30_000,
  });

  // Real app version release counts
  const { data: appVersionsOverview } = useQuery({
    queryKey: queryKeys.appVersions.overview(),
    queryFn: () => appVersionsApi.overview(),
    staleTime: 30_000,
  });

  // Real billing telemetry
  const { data: billingStats } = useQuery({
    queryKey: queryKeys.admin.billing.stats(),
    queryFn: () => adminBillingApi.stats(),
    staleTime: 30_000,
  });

  const liveResources: ResourceStatusItem[] = useMemo(() => {
    if (healthData?.services && healthData.services.length > 0) {
      const routeMap: Record<string, string> = {
        database: '/health',
        postgres: '/health',
        api: '/analytics/apis',
        server: '/analytics/apis',
        gateway: '/performance',
        ollama: '/performance',
        nvidia: '/performance',
        cache: '/performance',
        storage: '/analytics/storage',
        minio: '/analytics/storage',
        matrix: '/analytics/messaging',
      };
      return healthData.services.map((svc) => {
        const key = svc.name.toLowerCase();
        let targetRoute = '/health';
        for (const [k, r] of Object.entries(routeMap)) {
          if (key.includes(k)) {
            targetRoute = r;
            break;
          }
        }

        const isHealthy = svc.status === 'HEALTHY';
        const isDegraded = svc.status === 'DEGRADED';
        const color = isHealthy
          ? 'bg-emerald-500'
          : isDegraded
            ? 'bg-amber-500'
            : 'bg-rose-500';

        const badge =
          svc.latencyMs !== undefined && svc.latencyMs !== null
            ? `${svc.latencyMs}ms`
            : svc.status === 'HEALTHY'
              ? 'OK'
              : svc.status;

        return {
          id: svc.name,
          name: svc.name,
          status: isHealthy ? 'online' : isDegraded ? 'degraded' : 'active',
          badge,
          color,
          to: targetRoute,
        };
      });
    }
    return DEFAULT_RESOURCE_ITEMS;
  }, [healthData]);

  // Compute live navigation groups with real API telemetry badges
  const navGroups: NavGroup[] = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      let badge: string | undefined = undefined;

      if (group.id === 'system') {
        if (healthData) {
          const healthy = healthData.services.filter((s) => s.status === 'HEALTHY').length;
          const total = healthData.services.length;
          if (healthData.status === 'HEALTHY') {
            badge = `${healthy}/${total} UP`;
          } else {
            badge = healthData.status === 'DEGRADED' ? 'Degraded' : 'Alert';
          }
        }
      } else if (group.id === 'enterprise') {
        if (adminOverview?.organizations && adminOverview.organizations > 0) {
          badge = `${adminOverview.organizations} orgs`;
        }
      } else if (group.id === 'compliance') {
        if (complianceOverview?.openIssuesCount?.total && complianceOverview.openIssuesCount.total > 0) {
          badge = `${complianceOverview.openIssuesCount.total} alerts`;
        } else if (complianceOverview?.overallScore !== undefined) {
          badge = `${Math.round(complianceOverview.overallScore)}%`;
        }
      } else if (group.id === 'releases') {
        if (appVersionsOverview?.metrics?.activeReleases) {
          badge = `${appVersionsOverview.metrics.activeReleases} live`;
        }
      } else if (group.id === 'business') {
        if (billingStats?.subscriptionsByPlan && billingStats.subscriptionsByPlan.length > 0) {
          const totalSubs = billingStats.subscriptionsByPlan.reduce((acc, p) => acc + p.count, 0);
          if (totalSubs > 0) {
            badge = `${totalSubs} active`;
          }
        }
      } else if (group.id === 'marketplace') {
        const totalItems = (adminOverview?.agents ?? 0) + (adminOverview?.workflows ?? 0);
        if (totalItems > 0) {
          badge = `${totalItems} items`;
        }
      }

      return {
        ...group,
        badge,
      };
    });
  }, [healthData, adminOverview, complianceOverview, appVersionsOverview, billingStats]);

  // Section expand/collapse state with persistent storage
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {
      analytics: true,
      business: true,
      system: true,
      enterprise: true,
      marketplace: false,
      compliance: false,
      releases: false,
      resources: true,
    };
    try {
      const saved = localStorage.getItem(EXPANDED_GROUPS_KEY);
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
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

  // Auto-expand active group upon route transition
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
        persistExpanded(next);
        return next;
      });
    }
  }, [location.pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts: Ctrl+B / Cmd+B for sidebar, Ctrl+K / Cmd+K for search
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

  const handleSignOut = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network errors on signout
    }
    setAccessToken(null);
    try {
      localStorage.removeItem('onetab_auth_token');
      localStorage.removeItem('onetab_access_token');
      sessionStorage.clear();
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  const displayName =
    currentUser?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    'Platform Operator';

  const displayEmail = currentUser?.email || 'operator@onetab.ai';

  /**
   * Shared Navigation Panel Renderer.
   * Matches AI Agent Studio's exact structure:
   * Header -> Hero Slot -> ScrollArea Nav -> Pinned Footer.
   */
  const renderPanel = (isCollapsed: boolean, onCloseMobile?: () => void) => (
    <>
      {/* 1. Top Header: Platform Switcher & Brand Info */}
      <div className="h-14 px-2.5 flex items-center border-b border-border/40 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full min-w-0 items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-accent/70 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                isCollapsed && 'justify-center',
              )}
              aria-label="Platform console menu"
            >
              <div className="size-8 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                <span className="font-extrabold tracking-tight">O</span>
              </div>
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight text-foreground flex items-center gap-1.5">
                      <span>Onetab AI</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                        Admin
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">Platform Console</div>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Tenants & Workspaces</span>
              {adminOverview?.workspaces !== undefined && (
                <span className="text-[10px] font-mono text-primary font-semibold">
                  {adminOverview.workspaces} Total
                </span>
              )}
            </DropdownMenuLabel>
            {workspacesList?.items && workspacesList.items.length > 0 ? (
              workspacesList.items.slice(0, 5).map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => {
                    onCloseMobile?.();
                    navigate(`/analytics/workspaces/${ws.id}`);
                  }}
                  className="gap-2 cursor-pointer text-sm"
                >
                  <span
                    className={cn(
                      'size-2 rounded-full shrink-0',
                      ws.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : ws.status === 'ARCHIVED'
                          ? 'bg-muted-foreground'
                          : 'bg-amber-500',
                    )}
                  />
                  <span className="font-medium truncate flex-1">{ws.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">/{ws.slug}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  onCloseMobile?.();
                  navigate('/analytics/workspaces');
                }}
                className="gap-2 text-muted-foreground text-sm"
              >
                <Building2 className="size-4" />
                <span>View all workspaces</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onCloseMobile?.();
                navigate('/enterprise');
              }}
              className="gap-2 text-sm"
            >
              <Shield className="size-4 text-muted-foreground" />
              <span>Enterprise Governance ({adminOverview?.organizations ?? 0})</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 text-sm">
              <a href={STUDIO_APP_URL}>
                <Sparkles className="size-4 text-primary" />
                <span className="flex-1">Open AI Agent Studio</span>
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 text-sm">
              <a href={WEB_APP_URL}>
                <Laptop className="size-4 text-muted-foreground" />
                <span className="flex-1">Open Main Platform</span>
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Hero Action: Fast Command Search */}
      <div className="shrink-0 px-2.5 pt-3">
        {isCollapsed ? (
          <Hint side="right" label="Search console (⌘K)">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search console (⌘K)"
              className="mx-auto flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground transition-all duration-150 hover:bg-accent/70 hover:text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Search className="size-4 shrink-0" />
            </button>
          </Hint>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-accent/70 hover:text-foreground hover:border-border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring pointer-coarse:min-h-11"
            aria-label="Search console (⌘K)"
          >
            <Search className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="flex-1 truncate">Search console…</span>
            <kbd className="inline-flex h-5 items-center rounded border border-border/60 bg-background px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* 3. Scrollable Navigation Body */}
      <ScrollArea className="flex-1 px-2.5 py-3">
        <nav className="space-y-0.5" aria-label="Admin Navigation">
          {/* Core Platform Routes */}
          <AdminNavRow
            to="/overview"
            end
            label="Platform Overview"
            icon={LayoutDashboard}
            collapsed={isCollapsed}
            onNavigate={onCloseMobile}
          />

          {isCollapsed ? (
            <Hint side="right" label="Live Activity (Streaming)">
              <NavLink
                to="/analytics/live"
                onClick={onCloseMobile}
                aria-label="Live Activity"
                className={({ isActive }) => cn(ICON_ROW, isActive ? ICON_ACTIVE : ICON_IDLE)}
              >
                <Radio className="size-4 shrink-0 text-emerald-500" />
                <span className="absolute right-1 top-1 size-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-card" />
              </NavLink>
            </Hint>
          ) : (
            <NavLink
              to="/analytics/live"
              onClick={onCloseMobile}
              className={({ isActive }) => cn(ROW_BASE, isActive ? ROW_ACTIVE : ROW_IDLE)}
            >
              <Radio className="size-4 shrink-0 text-emerald-500" />
              <span className="flex-1 truncate">Live Activity</span>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </NavLink>
          )}

          {/* Group Sections */}
          {navGroups.map((group) => {
            const rows = group.items.map((item) => (
              <AdminNavRow
                key={item.to}
                to={item.to}
                end={item.end}
                label={item.label}
                icon={item.icon}
                collapsed={isCollapsed}
                badge={item.badge}
                onNavigate={onCloseMobile}
              />
            ));

            if (isCollapsed) {
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
              <AdminNavSection
                key={group.id}
                title={group.title}
                open={expandedGroups[group.id] ?? true}
                onOpenChange={(open) => setGroupOpen(group.id, open)}
                badge={group.badge}
              >
                {rows}
              </AdminNavSection>
            );
          })}

          {/* Live Infrastructure / Resources Section */}
          {isCollapsed ? (
            <div className="mt-2 space-y-0.5 border-t border-border/40 pt-2" aria-label="Infrastructure">
              {liveResources.map((res) => (
                <Hint side="right" key={res.id} label={`${res.name} (${res.badge})`}>
                  <NavLink
                    to={res.to}
                    onClick={onCloseMobile}
                    aria-label={res.name}
                    className={({ isActive }) => cn(ICON_ROW, isActive ? ICON_ACTIVE : ICON_IDLE)}
                  >
                    <span className={cn('size-2.5 rounded-full shrink-0', res.color)} />
                  </NavLink>
                </Hint>
              ))}
            </div>
          ) : (
            <AdminNavSection
              title="Infrastructure"
              open={expandedGroups['resources'] ?? true}
              onOpenChange={(open) => setGroupOpen('resources', open)}
              badge={healthData?.status === 'HEALTHY' ? 'All Live' : healthData?.status}
            >
              {liveResources.map((res) => (
                <NavLink
                  key={res.id}
                  to={res.to}
                  onClick={onCloseMobile}
                  className={({ isActive }) => cn(ROW_BASE, isActive ? ROW_ACTIVE : ROW_IDLE)}
                >
                  <span className={cn('size-2 rounded-full shrink-0', res.color)} />
                  <span className="flex-1 truncate">{res.name}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-muted-foreground bg-muted border border-border/50 shrink-0">
                    {res.badge}
                  </span>
                </NavLink>
              ))}
            </AdminNavSection>
          )}
        </nav>
      </ScrollArea>

      {/* 4. Pinned Footer: Settings, Operator Invite, Docs, Account Card */}
      <div className="p-2.5 border-t border-border/40 space-y-1 shrink-0">
        {/* Platform Settings */}
        <AdminNavRow
          to="/plans"
          label="Platform Settings"
          icon={Settings}
          collapsed={isCollapsed}
          onNavigate={onCloseMobile}
        />

        {/* Invite Operator */}
        {isCollapsed ? (
          <Hint side="right" label="Invite Operator">
            <button
              type="button"
              onClick={() => {
                onCloseMobile?.();
                setInviteOpen(true);
              }}
              aria-label="Invite Operator"
              className={cn(ICON_ROW, ICON_IDLE)}
            >
              <UserPlus className="size-4 shrink-0" />
            </button>
          </Hint>
        ) : (
          <button
            type="button"
            onClick={() => {
              onCloseMobile?.();
              setInviteOpen(true);
            }}
            className={cn(ROW_BASE, ROW_IDLE)}
          >
            <UserPlus className="size-4 shrink-0" />
            <span className="flex-1 truncate">Invite Operator</span>
          </button>
        )}

        {/* Documentation */}
        {isCollapsed ? (
          <Hint side="right" label="Documentation">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Documentation"
              className={cn(ICON_ROW, ICON_IDLE)}
            >
              <BookOpen className="size-4 shrink-0" />
            </a>
          </Hint>
        ) : (
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className={cn(ROW_BASE, ROW_IDLE)}
          >
            <BookOpen className="size-4 shrink-0" />
            <span className="flex-1 truncate">Documentation</span>
            <ExternalLink className="size-3.5 text-muted-foreground ml-auto" />
          </a>
        )}

        {/* User Profile Card */}
        <div className="pt-1 mt-1 border-t border-border/40">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-accent/70 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isCollapsed && 'justify-center',
                )}
                aria-label="Account menu"
              >
                <Avatar className="size-8 rounded-xl border border-border/60 shrink-0">
                  {currentUser?.avatarUrl ? (
                    <AvatarImage src={currentUser.avatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="rounded-xl bg-foreground text-background text-xs font-bold">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>

                {!isCollapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold leading-tight text-foreground">
                        {displayName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{displayEmail}</div>
                    </div>
                    <MoreHorizontal className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" side="top" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold leading-none text-foreground truncate max-w-[150px]">
                      {displayName}
                    </p>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                      {currentUser?.systemRole || 'SUPERADMIN'}
                    </span>
                  </div>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {displayEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  onCloseMobile?.();
                  navigate('/analytics/users');
                }}
                className="gap-2 text-sm"
              >
                <Users className="size-4 text-muted-foreground" />
                <span>Operator Accounts</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onCloseMobile?.();
                  navigate('/plans');
                }}
                className="gap-2 text-sm"
              >
                <Settings className="size-4 text-muted-foreground" />
                <span>Platform Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 text-sm">
                <a href="https://github.com" target="_blank" rel="noreferrer">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span>Documentation</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={handleSignOut}
                className="gap-2 text-sm cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground antialiased font-sans">
      {/* Desktop rail: 272px expanded / 68px collapsed, matching AI Agent Studio */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border/70 bg-card transition-all duration-200 select-none shrink-0 h-dvh',
          collapsed ? 'w-[68px]' : 'w-[272px]',
        )}
      >
        {renderPanel(collapsed)}
      </aside>

      {/* Mobile drawer: Radix Sheet matching AI Agent Studio */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && setMobileOpen(false)}>
        <SheetContent
          side="left"
          hideCloseButton
          aria-describedby={undefined}
          className="w-[272px] max-w-[272px] gap-0 border-r border-border/70 bg-card p-0 select-none md:hidden"
        >
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          {renderPanel(false, () => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header: Breadcrumbs + Quick Actions */}
        <header className="h-14 border-b border-border/60 bg-background/95 backdrop-blur-xs px-4 sm:px-6 flex shrink-0 items-center justify-between z-30">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button */}
            <Hint label={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setMobileOpen((prev) => !prev);
                  } else {
                    toggleCollapsed();
                  }
                }}
                className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="size-4" />
              </Button>
            </Hint>

            {/* Breadcrumb Navigation: Dashboard > Section > Page */}
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
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground bg-accent/40 hover:bg-accent hover:text-foreground rounded-lg border border-border/50 transition-colors cursor-pointer"
            >
              <Search className="size-3.5" />
              <span>Search…</span>
              <kbd className="text-[10px] font-mono bg-background px-1 py-0.2 rounded border">⌘K</kbd>
            </button>

            {/* Cross-App Link to AI Agent Studio */}
            <a
              href={STUDIO_APP_URL}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-lg transition-colors border border-border/40"
              title="Open AI Agent Studio"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>AI Agent Studio</span>
            </a>

            {/* GitHub Link */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-accent/60"
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

        {/* Main Content View Container */}
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

      {/* Global Dialogs */}
      <SearchCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <InviteTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

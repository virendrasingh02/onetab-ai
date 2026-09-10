import { useTheme } from '@org/design-system';
import { Badge, Button, Hint, LoadingState, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  BarChart3,
  Blocks,
  Bot,
  Bug,
  Building2,
  CheckSquare,
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
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Plug,
  Puzzle,
  Radio,
  Rocket,
  Scale,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Store,
  Sun,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  /** Marks the group's index route so it does not stay active on children. */
  end?: boolean;
}

/**
 * The console's whole surface, as data.
 *
 * Groups mirror the primary domains: watching platform intelligence, governing
 * organizations, maintaining systems, and curating the catalogue.
 */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      {
        to: '/overview',
        label: 'Platform Overview',
        icon: BarChart3,
        tone: 'text-primary',
        end: true,
      },
      {
        to: '/analytics/live',
        label: 'Live Activity Stream',
        icon: Radio,
        tone: 'text-success',
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        to: '/analytics/users',
        label: 'Users & Growth',
        icon: Users,
        tone: 'text-accent-blue',
      },
      {
        to: '/analytics/platform-usage',
        label: 'Web vs Desktop',
        icon: Laptop,
        tone: 'text-accent-violet',
      },
      {
        to: '/analytics/workspaces',
        label: 'Workspaces',
        icon: Building2,
        tone: 'text-accent-cyan',
      },
      {
        to: '/analytics/apis',
        label: 'API Intelligence',
        icon: Server,
        tone: 'text-warning',
      },
      {
        to: '/analytics/messaging',
        label: 'Messaging',
        icon: MessageSquare,
        tone: 'text-accent-pink',
      },
      {
        to: '/analytics/storage',
        label: 'Storage & Files',
        icon: HardDrive,
        tone: 'text-accent-blue',
      },
      {
        to: '/analytics/devices',
        label: 'Devices & Clients',
        icon: Monitor,
        tone: 'text-muted-foreground',
      },
      {
        to: '/analytics/locations',
        label: 'Geographic',
        icon: Globe,
        tone: 'text-success',
      },
      {
        to: '/analytics/engagement',
        label: 'Engagement & Stickiness',
        icon: Zap,
        tone: 'text-warning',
      },
    ],
  },
  {
    title: 'Business',
    items: [
      {
        to: '/analytics/revenue',
        label: 'Revenue & Finance',
        icon: DollarSign,
        tone: 'text-success',
      },
      {
        to: '/analytics/subscriptions',
        label: 'Subscriptions',
        icon: CreditCard,
        tone: 'text-accent-blue',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        to: '/health',
        label: 'System Health',
        icon: HeartPulse,
        tone: 'text-success',
      },
      {
        to: '/performance',
        label: 'Performance',
        icon: Gauge,
        tone: 'text-warning',
      },
      {
        to: '/errors',
        label: 'Error Tracking',
        icon: Bug,
        tone: 'text-destructive',
      },
    ],
  },
  {
    title: 'Application Management',
    items: [
      {
        to: '/versions',
        label: 'Versions & Releases',
        icon: Layers,
        tone: 'text-accent-blue',
      },
    ],
  },
  {
    title: 'Enterprise',
    items: [
      {
        to: '/enterprise',
        label: 'Governance',
        icon: Building2,
        tone: 'text-accent-blue',
        end: true,
      },
      {
        to: '/enterprise/sso',
        label: 'SSO & SCIM',
        icon: Shield,
        tone: 'text-accent-violet',
      },
      {
        to: '/enterprise/audit-logs',
        label: 'Audit Log',
        icon: ShieldAlert,
        tone: 'text-destructive',
      },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      {
        to: '/marketplace',
        label: 'Catalog',
        icon: Store,
        tone: 'text-accent-blue',
        end: true,
      },
      {
        to: '/marketplace/plugins',
        label: 'Plugin SDK',
        icon: Puzzle,
        tone: 'text-accent-blue',
      },
      {
        to: '/marketplace/themes',
        label: 'Themes',
        icon: Palette,
        tone: 'text-accent-pink',
      },
      {
        to: '/marketplace/agents',
        label: 'Agents',
        icon: Bot,
        tone: 'text-success',
      },
      {
        to: '/marketplace/workflows',
        label: 'Workflows',
        icon: Workflow,
        tone: 'text-warning',
      },
      {
        to: '/marketplace/components',
        label: 'Components',
        icon: Blocks,
        tone: 'text-accent-violet',
      },
      {
        to: '/marketplace/integrations',
        label: 'Integrations',
        icon: Plug,
        tone: 'text-accent-cyan',
      },
      {
        to: '/marketplace/templates',
        label: 'Templates',
        icon: FileStack,
        tone: 'text-destructive',
      },
    ],
  },
  {
    title: 'Compliance & Stores',
    items: [
      {
        to: '/compliance',
        label: 'Overview',
        icon: ShieldCheck,
        tone: 'text-success',
        end: true,
      },
      {
        to: '/compliance/platforms',
        label: 'Platforms & Stores',
        icon: Monitor,
        tone: 'text-accent-blue',
      },
      {
        to: '/compliance/countries',
        label: 'Regional Jurisdictions',
        icon: Globe,
        tone: 'text-accent-cyan',
      },
      {
        to: '/compliance/requirements',
        label: 'Rules & Guidelines',
        icon: Scale,
        tone: 'text-accent-violet',
      },
      {
        to: '/compliance/checklist',
        label: 'Pre-Submission',
        icon: CheckSquare,
        tone: 'text-warning',
      },
      {
        to: '/compliance/issues',
        label: 'Store Rejections',
        icon: AlertTriangle,
        tone: 'text-destructive',
      },
      {
        to: '/compliance/versions',
        label: 'Release Gates',
        icon: Rocket,
        tone: 'text-accent-blue',
      },
      {
        to: '/compliance/legal',
        label: 'Legal & Privacy Links',
        icon: FileText,
        tone: 'text-accent-pink',
      },
      {
        to: '/compliance/audit-logs',
        label: 'Audit Ledger',
        icon: Shield,
        tone: 'text-muted-foreground',
      },
    ],
  },
];

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
            <Icon />
          </Button>
        </Hint>
      ))}
    </div>
  );
}

function AdminNav() {
  return (
    <ScrollArea className="flex-1">
      <nav className="px-1 py-2">
        {NAV_GROUPS.map((group) => (
          <div
            key={group.title}
            className="mt-2 mb-3 px-1 pb-3 space-y-px border-b border-sidebar-border last:border-b-0"
          >
            <div className="px-2 py-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'gap-1.5 py-1 px-2 text-sm flex items-center rounded-md transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                    isActive
                      ? 'font-medium bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
                  )
                }
              >
                <item.icon className={cn('size-3.5 shrink-0', item.tone)} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}

/**
 * Two-column console shell: nav sidebar, content.
 *
 * Deliberately simpler than the web app's `AppShell` — there is no workspace
 * rail, because nothing in the console is scoped to a workspace, and no
 * command palette or AI sidebar. It is also unauthenticated for now: the
 * console is internal, and the platform-admin API surface that will gate it
 * has not landed. Anything it renders still goes through the shared API
 * client, so a request only succeeds if the browser already holds a session.
 */
export function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col relative">
      <header className="h-14 gap-2 sm:gap-3 px-3 sm:px-6 flex shrink-0 items-center border-b">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden"
          aria-label="Toggle admin menu"
        >
          <Building2 className="size-4" />
        </Button>

        <span className="size-7 text-xs font-semibold flex items-center justify-center rounded-md bg-primary text-primary-foreground">
          O
        </span>
        <div className="flex-1">
          <h1 className="text-sm font-semibold truncate">OneTab AI — Admin</h1>
        </div>
        <Badge variant="warning" className="hidden xs:inline-flex">Internal</Badge>
        <ThemeToggle />
      </header>

      <div className="min-h-0 flex flex-1 relative">
        {/* Mobile Backdrop */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        <aside
          className={cn(
            'flex flex-col border-r bg-sidebar transition-all duration-200 shrink-0',
            mobileOpen
              ? 'fixed inset-y-0 left-0 z-50 w-60 shadow-2xl md:relative md:z-auto md:shadow-none'
              : 'hidden md:flex md:w-60',
          )}
        >
          <AdminNav />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="flex min-h-full flex-col p-3 sm:p-6"
          >
            <Suspense fallback={<LoadingState fullPage />}>
              <Outlet />
            </Suspense>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

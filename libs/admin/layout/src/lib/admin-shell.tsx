import { useTheme } from '@org/design-system';
import { Badge, Button, Hint, LoadingState, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import {
  Blocks,
  Bot,
  Bug,
  Building2,
  FileStack,
  Gauge,
  HeartPulse,
  Monitor,
  Moon,
  Palette,
  Plug,
  Puzzle,
  Shield,
  ShieldAlert,
  Store,
  Sun,
  Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Suspense } from 'react';
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
 * Groups mirror the three things the admin console is for: watching the
 * platform run, governing the organization, and curating the catalogue.
 */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Platform',
    items: [
      {
        to: '/health',
        label: 'Health',
        icon: HeartPulse,
        tone: 'text-emerald-400',
      },
      {
        to: '/performance',
        label: 'Performance',
        icon: Gauge,
        tone: 'text-amber-400',
      },
      { to: '/errors', label: 'Error Tracking', icon: Bug, tone: 'text-red-400' },
    ],
  },
  {
    title: 'Enterprise',
    items: [
      {
        to: '/enterprise',
        label: 'Governance',
        icon: Building2,
        tone: 'text-blue-400',
        end: true,
      },
      {
        to: '/enterprise/sso',
        label: 'SSO & SCIM',
        icon: Shield,
        tone: 'text-purple-400',
      },
      {
        to: '/enterprise/audit-logs',
        label: 'Audit Log',
        icon: ShieldAlert,
        tone: 'text-rose-400',
      },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      {
        to: '/marketplace',
        label: 'Catalogue',
        icon: Store,
        tone: 'text-blue-400',
        end: true,
      },
      {
        to: '/marketplace/plugins',
        label: 'Plugin SDK',
        icon: Puzzle,
        tone: 'text-blue-400',
      },
      {
        to: '/marketplace/themes',
        label: 'Themes',
        icon: Palette,
        tone: 'text-pink-400',
      },
      {
        to: '/marketplace/agents',
        label: 'Agents',
        icon: Bot,
        tone: 'text-emerald-400',
      },
      {
        to: '/marketplace/workflows',
        label: 'Workflows',
        icon: Workflow,
        tone: 'text-amber-400',
      },
      {
        to: '/marketplace/components',
        label: 'Components',
        icon: Blocks,
        tone: 'text-purple-400',
      },
      {
        to: '/marketplace/integrations',
        label: 'Integrations',
        icon: Plug,
        tone: 'text-cyan-400',
      },
      {
        to: '/marketplace/templates',
        label: 'Templates',
        icon: FileStack,
        tone: 'text-rose-400',
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
    <ScrollArea className="scrollbar-subtle flex-1">
      <nav className="px-1 py-2">
        {NAV_GROUPS.map((group) => (
          <div
            key={group.title}
            className="mt-2 mb-3 px-1 space-y-px border-b border-sidebar-border pb-3 last:border-b-0"
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
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 gap-3 px-6 flex shrink-0 items-center border-b">
        <span className="size-7 text-xs font-semibold flex items-center justify-center rounded-md bg-primary text-primary-foreground">
          O
        </span>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">OneTab AI — Admin</h1>
        </div>
        <Badge variant="warning">Internal</Badge>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-60 shrink-0 flex flex-col border-r bg-sidebar">
          <AdminNav />
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          <Suspense fallback={<LoadingState fullPage />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

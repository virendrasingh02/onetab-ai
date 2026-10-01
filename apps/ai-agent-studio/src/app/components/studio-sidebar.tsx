import { Badge, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Code2,
  GitBranch,
  Layers,
  LayoutDashboard,
  Plug,
  Settings,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  fetchWorkspaceApprovals,
  workspaceApprovalsKey,
} from '../services/approvals-query.js';
import { useStudioSession } from '../session-guard.js';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  end?: boolean;
  /** Shows the live pending-approval count. */
  showsPendingApprovals?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Build & Orchestrate',
    items: [
      {
        to: '/overview',
        label: 'Studio Overview',
        icon: LayoutDashboard,
        tone: 'text-primary',
        end: true,
      },
      {
        to: '/agents',
        label: 'My Agents',
        icon: Bot,
        tone: 'text-accent-blue',
      },
      {
        to: '/workflows',
        label: 'Visual Workflows',
        icon: GitBranch,
        tone: 'text-accent-cyan',
      },
      {
        to: '/templates',
        label: 'Agent Templates',
        icon: Layers,
        tone: 'text-accent-violet',
      },
    ],
  },
  {
    title: 'Intelligence & Tools',
    items: [
      {
        to: '/knowledge',
        label: 'Knowledge & RAG',
        icon: BookOpen,
        tone: 'text-success',
      },
      {
        to: '/tools',
        label: 'Tools & Integrations',
        icon: Wrench,
        tone: 'text-warning',
      },
      {
        to: '/mcp',
        label: 'MCP Registry',
        icon: Plug,
        tone: 'text-accent-pink',
      },
    ],
  },
  {
    title: 'Operations & Governance',
    items: [
      {
        to: '/executions',
        label: 'Executions & Logs',
        icon: Activity,
        tone: 'text-accent-cyan',
      },
      {
        to: '/approvals',
        label: 'Human Approvals',
        icon: ShieldAlert,
        tone: 'text-destructive',
        showsPendingApprovals: true,
      },
      {
        to: '/analytics',
        label: 'Studio Analytics',
        icon: BarChart3,
        tone: 'text-accent-violet',
      },
    ],
  },
  {
    title: 'Platform & Config',
    items: [
      {
        to: '/settings',
        label: 'Settings & Security',
        icon: Settings,
        tone: 'text-muted-foreground',
      },
      {
        to: '/developer',
        label: 'Developer Hub',
        icon: Code2,
        tone: 'text-primary',
      },
    ],
  },
];

export interface StudioSidebarProps {
  className?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function StudioSidebar({
  className,
  mobileOpen = false,
  onCloseMobile,
}: StudioSidebarProps) {
  const { activeWorkspace } = useStudioSession();
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: workspaceApprovalsKey(activeWorkspace.id, 'PENDING'),
    queryFn: () => fetchWorkspaceApprovals(activeWorkspace.id, 'PENDING'),
    staleTime: 30_000,
  });
  const pendingCount = pendingApprovals.length;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 shrink-0 select-none',
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 w-60 shadow-2xl md:relative md:z-auto md:shadow-none'
            : 'hidden md:flex md:w-60',
          className,
        )}
      >
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
                    onClick={onCloseMobile}
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
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.showsPendingApprovals && pendingCount > 0 ? (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                        {pendingCount}
                      </Badge>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}

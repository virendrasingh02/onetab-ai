import { cn } from '@org/utils';
import {
  Activity,
  BookOpen,
  Bot,
  CheckCircle2,
  Cpu,
  FileCode,
  Flame,
  Globe,
  Layers,
  LayoutDashboard,
  Plug,
  ShieldAlert,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string | number;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/overview', icon: LayoutDashboard },
  { id: 'agents', label: 'My Agents', href: '/agents', icon: Bot },
  { id: 'templates', label: 'Templates', href: '/templates', icon: Layers },
  { id: 'executions', label: 'Executions', href: '/executions', icon: Activity },
  { id: 'tools', label: 'Tools & Firecrawl', href: '/tools', icon: Flame },
  { id: 'mcp', label: 'MCP Registry', href: '/mcp', icon: Plug },
  { id: 'knowledge', label: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { id: 'approvals', label: 'Approvals', href: '/approvals', icon: ShieldAlert },
];

export function StudioSidebar({ className }: { className?: string }) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'flex w-60 shrink-0 flex-col border-r border-border bg-surface select-none',
        className,
      )}
    >
      <div className="flex flex-1 flex-col justify-between p-3">
        <div className="space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Agent Studio
          </div>

          <nav className="space-y-0.5">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/overview'
                  ? location.pathname === '/' || location.pathname === '/overview'
                  : location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className={cn(
                    'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge != null && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Quick Card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>Firecrawl Enabled</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            Native web search, scraping, crawl and schema extraction connected to the visual workflow canvas.
          </p>
        </div>
      </div>
    </aside>
  );
}

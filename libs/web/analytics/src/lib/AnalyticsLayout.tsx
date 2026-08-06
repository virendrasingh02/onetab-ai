import { ScrollArea, ScrollBar, Tabs, TabsList, TabsTrigger } from '@org/ui';
import {
  BarChart3,
  Building2,
  FileSpreadsheet,
  HardDrive,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

interface AnalyticsTab {
  /** Path segment below `/w/:workspaceSlug/analytics`; empty for the index. */
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The tab set mirrors the sidebar's Analytics dropdown — the dropdown picks a
 * tab, and this bar is how you move between them once you are here.
 */
export const ANALYTICS_TABS: readonly AnalyticsTab[] = [
  { value: '', label: 'Dashboard', icon: BarChart3 },
  { value: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'ai-usage', label: 'AI Usage', icon: Sparkles },
  { value: 'workspace', label: 'Workspace', icon: Building2 },
  { value: 'storage', label: 'Storage', icon: HardDrive },
];

/**
 * Shell for the analytics section: one tab bar above the routed screen.
 *
 * The tabs are routes rather than local state, so a tab is linkable, survives
 * a reload and keeps the browser's back button meaningful. Each screen still
 * renders its own header below the bar.
 */
export function AnalyticsLayout() {
  const { workspaceSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const base = `/w/${workspaceSlug}/analytics`;

  // Everything after `…/analytics/`; the index route leaves this empty.
  const segment = location.pathname.startsWith(base)
    ? location.pathname.slice(base.length).replace(/^\/|\/$/g, '')
    : '';
  const active =
    ANALYTICS_TABS.find((tab) => tab.value === segment)?.value ?? '';

  return (
    <div className="min-h-full flex flex-col">
      <div className="px-6 pt-4 pb-3 border-b border-border">
        <Tabs
          value={active}
          onValueChange={(value) => navigate(value ? `${base}/${value}` : base)}
        >
          <ScrollArea className="w-full">
            <TabsList aria-label="Analytics views" className="w-max">
              {ANALYTICS_TABS.map((tab) => (
                <TabsTrigger key={tab.value || 'index'} value={tab.value}>
                  <tab.icon aria-hidden />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Tabs>
      </div>

      <Outlet />
    </div>
  );
}

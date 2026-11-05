import {
  CommandPalette,
  type CommandItem,
  LoadingState,
  ScrollArea,
} from '@org/ui';
import { Wand2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from './router.js';
import { StudioHeader } from './components/studio-header.js';
import { STUDIO_SECTIONS } from './components/section-tabs.js';
import { StudioSidebar, buildNavGroups } from './components/studio-sidebar.js';
import { Providers } from './providers.js';
import { studioCoreRoutes } from './studio-core-bridge.js';
import { SessionGuard, useStudioSession } from './session-guard.js';

/** Each page is its own chunk: the shell should not wait for the canvas or charts. */
const AgentDetailPage = lazy(() =>
  import('./pages/agent-detail-page.js').then((module) => ({
    default: module.AgentDetailPage,
  })),
);
const AgentsListPage = lazy(() =>
  import('./pages/agents-list-page.js').then((module) => ({
    default: module.AgentsListPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/analytics-page.js').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const CreateAgentPage = lazy(() =>
  import('./pages/create-agent-page.js').then((module) => ({
    default: module.CreateAgentPage,
  })),
);
const DeveloperPage = lazy(() =>
  import('./pages/developer-page.jsx').then((module) => ({
    default: module.DeveloperPage,
  })),
);
const ExecutionsPage = lazy(() =>
  import('./pages/executions-page.js').then((module) => ({
    default: module.ExecutionsPage,
  })),
);
const KnowledgePage = lazy(() =>
  import('./pages/knowledge-page.js').then((module) => ({
    default: module.KnowledgePage,
  })),
);
const McpPage = lazy(() =>
  import('./pages/mcp-page.js').then((module) => ({ default: module.McpPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/settings-page.js').then((module) => ({
    default: module.SettingsPage,
  })),
);
const TemplatesPage = lazy(() =>
  import('./pages/templates-page.js').then((module) => ({
    default: module.TemplatesPage,
  })),
);
const ToolAccessPage = lazy(() =>
  import('./pages/tool-access-page.js').then((module) => ({
    default: module.ToolAccessPage,
  })),
);
const ToolsPage = lazy(() =>
  import('./pages/tools-page.js').then((module) => ({
    default: module.ToolsPage,
  })),
);
const ConnectorsPage = lazy(() =>
  import('./pages/connectors-page.js').then((module) => ({
    default: module.ConnectorsPage,
  })),
);
const CoworkersPage = lazy(() =>
  import('./pages/coworkers-page.js').then((module) => ({
    default: module.CoworkersPage,
  })),
);
const ConnectorDetailPage = lazy(() =>
  import('./pages/connector-detail-page.js').then((module) => ({
    default: module.ConnectorDetailPage,
  })),
);
const ConnectorGroupsPage = lazy(() =>
  import('./pages/connector-groups-page.js').then((module) => ({
    default: module.ConnectorGroupsPage,
  })),
);
const CustomConnectorPage = lazy(() =>
  import('./pages/custom-connector-page.js').then((module) => ({
    default: module.CustomConnectorPage,
  })),
);
const UserChatPage = lazy(() =>
  import('./pages/user-chat-page.jsx').then((module) => ({
    default: module.UserChatPage,
  })),
);
const WorkflowsPage = lazy(() =>
  import('./pages/workflows-page.jsx').then((module) => ({
    default: module.WorkflowsPage,
  })),
);
const WidgetCenterPage = lazy(() =>
  import('./pages/widget-center-page.js').then((module) => ({
    default: module.WidgetCenterPage,
  })),
);
const WidgetBuilderPage = lazy(() =>
  import('./pages/widget-builder-page.js').then((module) => ({
    default: module.WidgetBuilderPage,
  })),
);

const BREADCRUMB_MAP: Record<string, { section: string; page: string }> = {
  '/create': { section: 'Build & Orchestrate', page: 'Create with AI' },
  '/connectors/new': {
    section: 'Intelligence & Tools',
    page: 'New Custom Connector',
  },
  '/agents': { section: 'Agents & Workflows', page: 'Agents' },
  '/coworkers': { section: 'Agents & Workflows', page: 'AI Coworkers' },
  '/workflows': { section: 'Agents & Workflows', page: 'Workflows' },
  '/templates': { section: 'Build & Orchestrate', page: 'Templates' },
  '/connectors': { section: 'Intelligence & Tools', page: 'App Connectors' },
  '/widgets': { section: 'Intelligence & Tools', page: 'Widget Center' },
  '/widgets/new': { section: 'Intelligence & Tools', page: 'Widget Builder' },
  '/knowledge': { section: 'Intelligence & Tools', page: 'Knowledge & RAG' },
  '/tools': { section: 'Intelligence & Tools', page: 'Tools' },
  '/tool-access': { section: 'Intelligence & Tools', page: 'Tools' },
  '/mcp': { section: 'Intelligence & Tools', page: 'Tools' },
  '/executions': {
    section: 'Operations & Governance',
    page: 'Agent Chat Logs',
  },
  '/approvals': { section: 'Operations & Governance', page: 'Human Approvals' },
  '/analytics': {
    section: 'Operations & Governance',
    page: 'Studio Analytics',
  },
  '/settings': { section: 'Platform & Config', page: 'Settings & Security' },
  '/developer': { section: 'Platform & Config', page: 'Developer Hub' },
};

const SCOPED_ROOT = /^\/w\/[^/]+\/ai(?=\/|$)/;

function getBreadcrumb(pathname: string): { section: string; page: string } {
  const rest = pathname.replace(SCOPED_ROOT, '') || '/';
  const first = rest.split('/')[1] ?? '';
  const core: Record<string, string> = {
    '': 'Studio Home',
    runs: 'Runs',
    approvals: 'Human Approvals',
  };
  if (rest === '/planned')
    return { section: 'Agents & Workflows', page: 'Planned' };
  if (first === 'planned')
    return { section: 'Plan, Run & Approve', page: 'Planned Agent' };
  if (first in core) {
    return { section: 'Plan, Run & Approve', page: core[first] };
  }
  if (/^\/workflows\/[^/]+/.test(rest))
    return { section: 'Plan, Run & Approve', page: 'Workflow Canvas' };
  if (BREADCRUMB_MAP[rest]) return BREADCRUMB_MAP[rest];
  for (const [prefix, value] of Object.entries(BREADCRUMB_MAP)) {
    if (rest.startsWith(prefix)) return value;
  }
  return { section: 'Plan, Run & Approve', page: 'Studio Home' };
}

function StudioShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('onetab_studio_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const { activeWorkspace } = useStudioSession();
  const location = useLocation();
  const navigate = useNavigate();
  const isAgentCanvas = /^\/w\/[^/]+\/ai\/agents\/[^/]+/.test(
    location.pathname,
  );
  const isUserChat = /^\/w\/[^/]+\/ai\/chat\/[^/]+/.test(location.pathname);

  const breadcrumb = useMemo(
    () => getBreadcrumb(location.pathname),
    [location.pathname],
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('onetab_studio_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B for sidebar toggle, Ctrl+K / Cmd+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer upon route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Same destinations, labels and icons as the sidebar, plus the pages behind each
  // section's tabs, so the palette can never drift from the nav.
  const paletteCommands = useMemo<CommandItem[]>(() => {
    const go = (path: string) => () => {
      setCommandPaletteOpen(false);
      navigate(path);
    };
    const commands: CommandItem[] = [];
    for (const group of buildNavGroups(activeWorkspace.slug)) {
      // The sidebar's "Create with AI" button leads its build group here.
      if (group.id === 'build-orchestrate') {
        commands.push({
          id: '/create',
          category: group.title,
          label: 'Create with AI',
          icon: <Wand2 className="size-4" />,
          action: go('/create'),
        });
      }
      for (const { to, label, icon: Icon, match } of group.items) {
        commands.push({
          id: to,
          category: group.title,
          label,
          icon: <Icon className="size-4" />,
          action: go(to),
        });
        // A row with `match` stands for a section: list its sibling pages too.
        if (!match) continue;
        const section = Object.values(STUDIO_SECTIONS).find((pages) =>
          pages.some((p) => to.endsWith(`/ai/${p.segment}`)),
        );
        for (const page of section ?? []) {
          const path = `/w/${activeWorkspace.slug}/ai/${page.segment}`;
          if (path === to) continue;
          const PageIcon = page.icon;
          commands.push({
            id: path,
            category: group.title,
            label: page.label,
            keywords: label,
            icon: <PageIcon className="size-4" />,
            action: go(path),
          });
        }
      }
    }
    return commands;
  }, [navigate, activeWorkspace.slug]);

  if (isUserChat) {
    return (
      <Suspense fallback={<LoadingState fullPage />}>
        <Routes>
          {studioCoreRoutes(
            <Route path="chat/:agentId" element={<UserChatPage />} />,
          )}
        </Routes>
      </Suspense>
    );
  }

  if (isAgentCanvas) {
    return (
      <Suspense fallback={<LoadingState fullPage />}>
        <Routes>
          {studioCoreRoutes(
            <Route path="agents/:agentId" element={<AgentDetailPage />} />,
          )}
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background bg-app-gradient font-sans text-foreground">
      {/* Top Header Bar spanning full width across the entire top */}
      <StudioHeader
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onToggleMobile={() => setMobileOpen((prev) => !prev)}
        breadcrumb={breadcrumb}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Pane Gutter Row: rounded floating card panels matching the main app */}
      <div className="min-h-0 gap-1.5 p-1.5 pt-0 relative flex flex-1 overflow-hidden">
        {/* Column 1 / Box 1: Navigation sidebar */}
        <StudioSidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Column 2 / Box 2: Main Content Panel */}
        <div className="app-content-panel min-w-0 shadow-2xs flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
          <main className="min-w-0 flex flex-1 flex-col overflow-hidden">
            <ScrollArea
              className="min-h-0 flex-1"
              contentClassName="flex min-h-full w-full flex-col"
            >
              <Suspense fallback={<LoadingState fullPage />}>
                <Routes>
                  {studioCoreRoutes(
                    <>
                      <Route path="create" element={<CreateAgentPage />} />
                      <Route path="agents" element={<AgentsListPage />} />
                      <Route path="coworkers" element={<CoworkersPage />} />
                      <Route path="workflows" element={<WorkflowsPage />} />
                      <Route path="templates" element={<TemplatesPage />} />
                      <Route path="executions" element={<ExecutionsPage />} />
                      <Route path="connectors" element={<ConnectorsPage />} />
                      <Route
                        path="connectors/groups"
                        element={<ConnectorGroupsPage />}
                      />
                      <Route
                        path="connectors/new"
                        element={<CustomConnectorPage />}
                      />
                      <Route
                        path="connectors/:connectorId"
                        element={<ConnectorDetailPage />}
                      />
                      <Route
                        path="connectors/:connectorId/edit"
                        element={<CustomConnectorPage />}
                      />
                      <Route path="widgets" element={<WidgetCenterPage />} />
                      <Route
                        path="widgets/new"
                        element={<WidgetBuilderPage />}
                      />
                      <Route
                        path="widgets/:widgetId"
                        element={<WidgetBuilderPage />}
                      />
                      <Route path="tools" element={<ToolsPage />} />
                      <Route path="tool-access" element={<ToolAccessPage />} />
                      <Route path="mcp" element={<McpPage />} />
                      <Route path="knowledge" element={<KnowledgePage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="developer" element={<DeveloperPage />} />
                    </>,
                  )}
                </Routes>
              </Suspense>
            </ScrollArea>
          </main>
        </div>
      </div>

      {/* Studio Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        placeholder="Search studio, agents, tools, workflows…"
        commands={paletteCommands}
      />
    </div>
  );
}

export function App() {
  return (
    <Providers>
      <SessionGuard>
        <StudioShell />
      </SessionGuard>
    </Providers>
  );
}

export default App;

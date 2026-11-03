import { CommandPalette, type CommandItem, LoadingState, ScrollArea } from '@org/ui';
import { Wand2 } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from './router.js';
import { StudioHeader } from './components/studio-header.js';
import { STUDIO_SECTIONS } from './components/section-tabs.js';
import { StudioSidebar, buildNavGroups } from './components/studio-sidebar.js';
import { AgentDetailPage } from './pages/agent-detail-page.js';
import { AgentsListPage } from './pages/agents-list-page.js';
import { AnalyticsPage } from './pages/analytics-page.js';
import { CreateAgentPage } from './pages/create-agent-page.js';
import { DeveloperPage } from './pages/developer-page.jsx';
import { ExecutionsPage } from './pages/executions-page.js';
import { KnowledgePage } from './pages/knowledge-page.js';
import { McpPage } from './pages/mcp-page.js';
import { SettingsPage } from './pages/settings-page.js';
import { TemplatesPage } from './pages/templates-page.js';
import { ToolAccessPage } from './pages/tool-access-page.js';
import { ToolsPage } from './pages/tools-page.js';
import { ConnectorsPage } from './pages/connectors-page.js';
import { CoworkersPage } from './pages/coworkers-page.js';
import { ConnectorDetailPage } from './pages/connector-detail-page.js';
import { ConnectorGroupsPage } from './pages/connector-groups-page.js';
import { CustomConnectorPage } from './pages/custom-connector-page.js';
import { UserChatPage } from './pages/user-chat-page.jsx';
import { WorkflowsPage } from './pages/workflows-page.jsx';
import { WidgetCenterPage } from './pages/widget-center-page.js';
import { WidgetBuilderPage } from './pages/widget-builder-page.js';
import { Providers } from './providers.js';
import { studioCoreRoutes } from './studio-core-bridge.js';
import { SessionGuard, useStudioSession } from './session-guard.js';

const BREADCRUMB_MAP: Record<string, { section: string; page: string }> = {
  '/create': { section: 'Build & Orchestrate', page: 'Create with AI' },
  '/connectors/new': { section: 'Intelligence & Tools', page: 'New Custom Connector' },
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
  '/executions': { section: 'Operations & Governance', page: 'Agent Chat Logs' },
  '/approvals': { section: 'Operations & Governance', page: 'Human Approvals' },
  '/analytics': { section: 'Operations & Governance', page: 'Studio Analytics' },
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
    studio: 'Planned Agent',
  };
  if (first === 'agents') return { section: 'Agents & Workflows', page: 'Planned' };
  if (first in core) {
    return { section: 'Plan, Run & Approve', page: core[first] };
  }
  if (/^\/workflows\/[^/]+/.test(rest)) return { section: 'Plan, Run & Approve', page: 'Workflow Canvas' };
  const key = rest.startsWith('/my-agents') ? rest.replace('/my-agents', '/agents') : rest;
  if (BREADCRUMB_MAP[key]) return BREADCRUMB_MAP[key];
  for (const [prefix, value] of Object.entries(BREADCRUMB_MAP)) {
    if (key.startsWith(prefix)) return value;
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
  const isAgentCanvas = /^\/w\/[^/]+\/ai\/my-agents\/[^/]+/.test(location.pathname);
  const isUserChat = /^\/w\/[^/]+\/ai\/chat\/[^/]+/.test(location.pathname);

  const breadcrumb = useMemo(() => getBreadcrumb(location.pathname), [location.pathname]);

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
        commands.push({ id: to, category: group.title, label, icon: <Icon className="size-4" />, action: go(to) });
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
      <Routes>{studioCoreRoutes(<Route path="chat/:agentId" element={<UserChatPage />} />)}</Routes>
    );
  }

  if (isAgentCanvas) {
    return (
      <Routes>{studioCoreRoutes(<Route path="my-agents/:agentId" element={<AgentDetailPage />} />)}</Routes>
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
                      <Route path="my-agents" element={<AgentsListPage />} />
                      <Route path="coworkers" element={<CoworkersPage />} />
                      <Route path="workflows" element={<WorkflowsPage />} />
                      <Route path="templates" element={<TemplatesPage />} />
                      <Route path="executions" element={<ExecutionsPage />} />
                      <Route path="connectors" element={<ConnectorsPage />} />
                      <Route path="connectors/groups" element={<ConnectorGroupsPage />} />
                      <Route path="connectors/new" element={<CustomConnectorPage />} />
                      <Route path="connectors/:connectorId" element={<ConnectorDetailPage />} />
                      <Route path="connectors/:connectorId/edit" element={<CustomConnectorPage />} />
                      <Route path="widgets" element={<WidgetCenterPage />} />
                      <Route path="widgets/new" element={<WidgetBuilderPage />} />
                      <Route path="widgets/:widgetId" element={<WidgetBuilderPage />} />
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

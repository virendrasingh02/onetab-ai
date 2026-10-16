import { LoadingState, ScrollArea } from '@org/ui';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation } from './router.js';
import { StudioHeader } from './components/studio-header.js';
import { StudioSidebar } from './components/studio-sidebar.js';
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
import { ToolsPage } from './pages/tools-page.js';
import { ConnectorsPage } from './pages/connectors-page.js';
import { ConnectorDetailPage } from './pages/connector-detail-page.js';
import { ConnectorGroupsPage } from './pages/connector-groups-page.js';
import { CustomConnectorPage } from './pages/custom-connector-page.js';
import { UserChatPage } from './pages/user-chat-page.jsx';
import { WorkflowsPage } from './pages/workflows-page.jsx';
import { WidgetCenterPage } from './pages/widget-center-page.js';
import { WidgetBuilderPage } from './pages/widget-builder-page.js';
import { Providers } from './providers.js';
import { studioCoreRoutes } from './studio-core-bridge.js';
import { SessionGuard } from './session-guard.js';

const BREADCRUMB_MAP: Record<string, { section: string; page: string }> = {
  '/create': { section: 'Build & Orchestrate', page: 'Create with AI' },
  '/connectors/new': { section: 'Intelligence & Tools', page: 'New Custom Connector' },
  '/agents': { section: 'Build & Orchestrate', page: 'My Agents' },
  '/workflows': { section: 'Build & Orchestrate', page: 'Visual Workflows' },
  '/templates': { section: 'Build & Orchestrate', page: 'Agent Templates' },
  '/connectors': { section: 'Intelligence & Tools', page: 'App Connectors' },
  '/widgets': { section: 'Intelligence & Tools', page: 'Widget Center' },
  '/widgets/new': { section: 'Intelligence & Tools', page: 'Widget Builder' },
  '/knowledge': { section: 'Intelligence & Tools', page: 'Knowledge & RAG' },
  '/tools': { section: 'Intelligence & Tools', page: 'Tools & Integrations' },
  '/mcp': { section: 'Intelligence & Tools', page: 'MCP Registry' },
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
    agents: 'Planned Agents',
    runs: 'Runs',
    approvals: 'Human Approvals',
    studio: 'Planned Agent',
  };
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('onetab_studio_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const location = useLocation();
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

  // Keyboard shortcut Ctrl+B / Cmd+B for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer upon route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <StudioSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col h-dvh overflow-hidden">
        <StudioHeader
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
          breadcrumb={breadcrumb}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
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

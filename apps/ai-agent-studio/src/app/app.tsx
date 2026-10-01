import { LoadingState, ScrollArea } from '@org/ui';
import { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StudioHeader } from './components/studio-header.js';
import { StudioSidebar } from './components/studio-sidebar.js';
import { AgentDetailPage } from './pages/agent-detail-page.js';
import { AgentsListPage } from './pages/agents-list-page.js';
import { AnalyticsPage } from './pages/analytics-page.jsx';
import { ApprovalsPage } from './pages/approvals-page.js';
import { DeveloperPage } from './pages/developer-page.jsx';
import { ExecutionsPage } from './pages/executions-page.js';
import { KnowledgePage } from './pages/knowledge-page.js';
import { McpPage } from './pages/mcp-page.js';
import { OverviewPage } from './pages/overview-page.js';
import { SettingsPage } from './pages/settings-page.js';
import { TemplatesPage } from './pages/templates-page.js';
import { ToolsPage } from './pages/tools-page.js';
import { UserChatPage } from './pages/user-chat-page.jsx';
import { WorkflowsPage } from './pages/workflows-page.jsx';
import { Providers } from './providers.js';
import { SessionGuard } from './session-guard.js';

function StudioShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isAgentCanvas =
    location.pathname.startsWith('/agents/') && location.pathname !== '/agents';
  const isUserChat = location.pathname.startsWith('/chat/');

  // Close mobile drawer upon route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (isUserChat) {
    return (
      <Routes>
        <Route path="/chat/:agentId" element={<UserChatPage />} />
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Routes>
    );
  }

  if (isAgentCanvas) {
    return (
      <Routes>
        <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col relative bg-background">
      <StudioHeader onToggleMobile={() => setMobileOpen((prev) => !prev)} />

      <div className="min-h-0 flex flex-1 relative">
        <StudioSidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="flex min-h-full flex-col p-3 sm:p-6"
          >
            <Suspense fallback={<LoadingState fullPage />}>
              <Routes>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/agents" element={<AgentsListPage />} />
                <Route path="/workflows" element={<WorkflowsPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/executions" element={<ExecutionsPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/mcp" element={<McpPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/developer" element={<DeveloperPage />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
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

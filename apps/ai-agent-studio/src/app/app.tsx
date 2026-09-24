import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Providers } from './providers.js';
import { SessionGuard } from './session-guard.js';
import { StudioHeader } from './components/studio-header.js';
import { StudioSidebar } from './components/studio-sidebar.js';
import { OverviewPage } from './pages/overview-page.js';
import { AgentsListPage } from './pages/agents-list-page.js';
import { AgentDetailPage } from './pages/agent-detail-page.js';
import { TemplatesPage } from './pages/templates-page.js';
import { ExecutionsPage } from './pages/executions-page.js';
import { ToolsPage } from './pages/tools-page.js';
import { McpPage } from './pages/mcp-page.js';
import { KnowledgePage } from './pages/knowledge-page.js';
import { ApprovalsPage } from './pages/approvals-page.js';

function StudioShell() {
  const location = useLocation();
  const isAgentCanvas = location.pathname.startsWith('/agents/') && location.pathname !== '/agents';

  if (isAgentCanvas) {
    return (
      <Routes>
        <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <StudioHeader />
      <div className="flex flex-1 overflow-hidden">
        <StudioSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/agents" element={<AgentsListPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/executions" element={<ExecutionsPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/mcp" element={<McpPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
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

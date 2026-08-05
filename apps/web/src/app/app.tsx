import {
  ForgotPasswordPage,
  LoginPage,
  ProtectedRoute,
  PublicOnlyRoute,
  RegisterPage,
  ResetPasswordPage,
  useSessionBootstrap,
} from '@org/auth';
import { Button, EmptyState, LoadingState } from '@org/ui';
import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

/**
 * Authenticated areas are lazily loaded so the initial bundle carries only the
 * shell and the sign-in screens.
 *
 * `@org/auth` is deliberately *static*: the route guards and session bootstrap
 * run on first paint, so splitting it would add a round trip before the app
 * can decide whether the visitor is signed in — and mixing static and lazy
 * imports of one library puts it in the main chunk anyway.
 */
const AppShell = lazy(() =>
  import('@org/web-layout').then((m) => ({ default: m.AppShell })),
);
const DashboardPage = lazy(() =>
  import('@org/web-dashboard').then((m) => ({ default: m.DashboardPage })),
);
const ChannelPage = lazy(() =>
  import('@org/web-channels').then((m) => ({ default: m.ChannelPage })),
);
const CreateChannelPage = lazy(() =>
  import('@org/web-channels').then((m) => ({ default: m.CreateChannelPage })),
);
const BrowseChannelsPage = lazy(() =>
  import('@org/web-channels').then((m) => ({ default: m.BrowseChannelsPage })),
);
const MembersPage = lazy(() =>
  import('@org/web-members').then((m) => ({ default: m.MembersPage })),
);
const InvitationsPage = lazy(() =>
  import('@org/web-invitations').then((m) => ({ default: m.InvitationsPage })),
);
const AcceptInvitationPage = lazy(() =>
  import('@org/web-invitations').then((m) => ({
    default: m.AcceptInvitationPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@org/web-profile').then((m) => ({ default: m.ProfilePage })),
);
const SettingsPage = lazy(() =>
  import('@org/web-settings').then((m) => ({ default: m.SettingsPage })),
);
const CreateWorkspacePage = lazy(() =>
  import('@org/web-workspace').then((m) => ({
    default: m.CreateWorkspacePage,
  })),
);
const WorkspaceSettingsPage = lazy(() =>
  import('@org/web-workspace').then((m) => ({
    default: m.WorkspaceSettingsPage,
  })),
);
const WorkspaceRedirect = lazy(() =>
  import('@org/web-workspace').then((m) => ({ default: m.WorkspaceRedirect })),
);
const KanbanBoard = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.KanbanBoard })),
);
const DocumentEditor = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.DocumentEditor })),
);
const WhiteboardCanvas = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.WhiteboardCanvas })),
);
const CalendarView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.CalendarView })),
);
const FileManagerView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.FileManagerView })),
);
const ActivityTimelineView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.ActivityTimelineView })),
);
const AIChatView = lazy(() =>
  import('@org/web-ai').then((m) => ({ default: m.AIChatView })),
);
const PromptLibraryView = lazy(() =>
  import('@org/web-ai').then((m) => ({ default: m.PromptLibraryView })),
);
const AIImageGeneratorView = lazy(() =>
  import('@org/web-ai').then((m) => ({ default: m.AIImageGeneratorView })),
);
const AgentMarketplaceView = lazy(() =>
  import('@org/web-agents').then((m) => ({ default: m.AgentMarketplaceView })),
);
const AgentBuilderView = lazy(() =>
  import('@org/web-agents').then((m) => ({ default: m.AgentBuilderView })),
);
const AgentMonitoringView = lazy(() =>
  import('@org/web-agents').then((m) => ({ default: m.AgentMonitoringView })),
);
const WorkflowListView = lazy(() =>
  import('@org/web-automations').then((m) => ({ default: m.WorkflowListView })),
);
const WorkflowCanvasView = lazy(() =>
  import('@org/web-automations').then((m) => ({ default: m.WorkflowCanvasView })),
);
const WorkflowExecutionLogsView = lazy(() =>
  import('@org/web-automations').then((m) => ({ default: m.WorkflowExecutionLogsView })),
);
const EnterpriseDashboardView = lazy(() =>
  import('@org/web-enterprise').then((m) => ({ default: m.EnterpriseDashboardView })),
);
const SSOConfigView = lazy(() =>
  import('@org/web-enterprise').then((m) => ({ default: m.SSOConfigView })),
);
const AuditLogView = lazy(() =>
  import('@org/web-enterprise').then((m) => ({ default: m.AuditLogView })),
);
const IntegrationHubView = lazy(() =>
  import('@org/web-integrations').then((m) => ({ default: m.IntegrationHubView })),
);
const SlackNotionImportView = lazy(() =>
  import('@org/web-integrations').then((m) => ({ default: m.SlackNotionImportView })),
);
const AnalyticsDashboardView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.AnalyticsDashboardView })),
);
const ReportsView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.ReportsView })),
);
const UserAnalyticsView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.UserAnalyticsView })),
);
const AIUsageView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.AIUsageView })),
);
const WorkspaceAnalyticsView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.WorkspaceAnalyticsView })),
);
const StorageAnalyticsView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.StorageAnalyticsView })),
);
const PerformanceMonitoringView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.PerformanceMonitoringView })),
);
const ErrorTrackingView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.ErrorTrackingView })),
);
const HealthDashboardView = lazy(() =>
  import('@org/web-analytics').then((m) => ({ default: m.HealthDashboardView })),
);

function NotFoundPage() {
  return (
    <div className="p-6 grid min-h-dvh place-items-center">
      <EmptyState
        size="lg"
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        }
      />
    </div>
  );
}

export function App() {
  // Exchanges the httpOnly refresh cookie for a session before routing decides
  // whether the visitor is anonymous.
  useSessionBootstrap();

  return (
    <Suspense fallback={<LoadingState fullPage />}>
      <Routes>
        {/* --- public ---------------------------------------------------- */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* --- authenticated --------------------------------------------- */}
        <Route element={<ProtectedRoute />}>
          <Route path="/invite/:token" element={<AcceptInvitationPage />} />
          <Route path="/workspaces/new" element={<CreateWorkspacePage />} />

          {/* Bare "/" resolves to the user's first workspace. */}
          <Route path="/" element={<WorkspaceRedirect />} />

          <Route path="/w/:workspaceSlug" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="c/:channelSlug" element={<ChannelPage />} />
            <Route path="channels" element={<BrowseChannelsPage />} />
            <Route path="channels/new" element={<CreateChannelPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="tasks" element={<KanbanBoard />} />
            <Route path="kanban" element={<KanbanBoard />} />
            <Route path="docs" element={<DocumentEditor />} />
            <Route path="whiteboard" element={<WhiteboardCanvas />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="files" element={<FileManagerView />} />
            <Route path="timeline" element={<ActivityTimelineView />} />
            <Route path="ai-chat" element={<AIChatView />} />
            <Route path="prompts" element={<PromptLibraryView />} />
            <Route path="ai-images" element={<AIImageGeneratorView />} />
            <Route path="agents" element={<AgentMarketplaceView />} />
            <Route path="agents/builder" element={<AgentBuilderView />} />
            <Route path="agents/logs" element={<AgentMonitoringView />} />
            <Route path="automations" element={<WorkflowListView />} />
            <Route path="automations/builder" element={<WorkflowCanvasView />} />
            <Route path="automations/logs" element={<WorkflowExecutionLogsView />} />
            <Route path="enterprise" element={<EnterpriseDashboardView />} />
            <Route path="enterprise/sso" element={<SSOConfigView />} />
            <Route path="enterprise/audit-logs" element={<AuditLogView />} />
            <Route path="integrations" element={<IntegrationHubView />} />
            <Route path="integrations/import" element={<SlackNotionImportView />} />
            <Route path="analytics" element={<AnalyticsDashboardView />} />
            <Route path="analytics/reports" element={<ReportsView />} />
            <Route path="analytics/users" element={<UserAnalyticsView />} />
            <Route path="analytics/ai-usage" element={<AIUsageView />} />
            <Route path="analytics/workspace" element={<WorkspaceAnalyticsView />} />
            <Route path="analytics/storage" element={<StorageAnalyticsView />} />
            <Route path="analytics/performance" element={<PerformanceMonitoringView />} />
            <Route path="analytics/errors" element={<ErrorTrackingView />} />
            <Route path="analytics/health" element={<HealthDashboardView />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="settings/workspace"
              element={<WorkspaceSettingsPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

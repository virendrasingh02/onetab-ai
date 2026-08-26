import {
  DesktopAuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  MobileDeviceConfirmPage,
  MobileDevicePairPage,
  ProtectedRoute,
  PublicOnlyRoute,
  RegisterPage,
  ResetPasswordPage,
  useSessionBootstrap,
} from '@org/auth';
import { Button, EmptyState, LoadingState } from '@org/ui';
/*
 * `@org/web-chat` is already in the main chunk — `Providers` mounts its
 * `MatrixProvider` on every render — so its screens are imported statically
 * too. Splitting them would only add a chunk boundary with nothing behind it.
 */
import { SavedView, ThreadsView } from '@org/web-chat';
/*
 * `@org/web-desktop` is already in the main chunk too — `Providers` mounts its
 * `DesktopProvider`/`DesktopChrome` on every render (see providers.tsx) — so
 * this is static for the same reason `@org/web-chat` above is; lazy-loading
 * one export of an already-bundled library only adds a chunk boundary with
 * nothing behind it, and trips `@nx/enforce-module-boundaries`' check against
 * importing the same library both ways.
 */
import { PlatformDiagnosticsPage } from '@org/web-desktop';
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
const SlackNotionImportView = lazy(() =>
  import('@org/web-integrations').then((m) => ({
    default: m.SlackNotionImportView,
  })),
);
const WorkspaceKanbanSettings = lazy(() =>
  import('@org/web-work-tools').then((m) => ({
    default: m.WorkspaceKanbanSettings,
  })),
);

/**
 * The settings page with its two borrowed tabs supplied.
 *
 * `@org/web-workspace` sits below `@org/web-integrations` and
 * `@org/web-work-tools` in the dependency graph, so it cannot import either;
 * the route layer is the first place that may depend on all three. See
 * `WorkspaceSettingsPageProps`.
 */
function WorkspaceSettings() {
  return (
    <WorkspaceSettingsPage
      importPanel={<SlackNotionImportView embedded />}
      kanbanPanel={<WorkspaceKanbanSettings />}
    />
  );
}
const WorkspaceRedirect = lazy(() =>
  import('@org/web-workspace').then((m) => ({ default: m.WorkspaceRedirect })),
);
const AsanaProjectManager = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.AsanaProjectManager })),
);
const DocumentEditor = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.DocumentEditor })),
);
const FileManagerView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.FileManagerView })),
);
const ActivityTimelineView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.ActivityTimelineView })),
);
const InboxView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.InboxView })),
);
const ScheduleView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.ScheduleView })),
);
const MeetingsView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.MeetingsView })),
);
const WhiteboardCanvas = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.WhiteboardCanvas })),
);
const CardRegistryView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.CardRegistryView })),
);
const CardBuilderView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.CardBuilderView })),
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
const AgentChatView = lazy(() =>
  import('@org/web-agents').then((m) => ({ default: m.AgentChatView })),
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
const IntegrationHubView = lazy(() =>
  import('@org/web-integrations').then((m) => ({ default: m.IntegrationHubView })),
);
const AppChatView = lazy(() =>
  import('@org/web-integrations').then((m) => ({ default: m.AppChatView })),
);
const DesignSystemStudio = lazy(() =>
  import('@org/web-settings').then((m) => ({ default: m.DesignSystemStudio })),
);
/*
 * Composes `DirectMessagesView` (`web-chat`, already in the main chunk — see
 * the note above) with the agents and connected apps `web-agents`/
 * `web-integrations` provide, so the DM picker lists them alongside people.
 * Lazy despite `web-chat` being static: `web-agents` and `web-integrations`
 * are not, and this is the one place they meet without either becoming
 * eagerly bundled or `web-chat` depending back on them (see the page itself).
 */
const DirectMessagesPage = lazy(() =>
  import('@org/web-layout').then((m) => ({ default: m.DirectMessagesPage })),
);



function NotFoundPage() {
  return (
    <div className="p-6 grid min-h-full place-items-center">
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
    <Suspense fallback={<LoadingState fullPage label="Loading your workspace…" />}>
      <Routes>
        {/* --- public & callback routes -------------------------------- */}
        <Route path="/auth/callback" element={<DesktopAuthCallbackPage />} />
        <Route path="/auth/device" element={<MobileDeviceConfirmPage />} />
        <Route path="/auth/pair" element={<MobileDevicePairPage />} />
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

          {/*
            Never routable in a production build — not just unlinked. See
            PlatformDiagnosticsLink, the only thing that points here.
          */}
          {import.meta.env.DEV && (
            <Route path="/dev/platform-diagnostics" element={<PlatformDiagnosticsPage />} />
          )}

          {/* Bare "/" and "/open" resolve to the user's first workspace. */}
          <Route path="/" element={<WorkspaceRedirect />} />
          <Route path="/open" element={<WorkspaceRedirect />} />
          <Route path="/settings" element={<WorkspaceRedirect />} />

          {/* --- Separate Standalone Settings Routes --- */}
          <Route
            path="/w/:workspaceSlug/settings"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/settings/*"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/import-export"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/integrations/import"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/profile"
            element={<ProfilePage />}
          />
          <Route
            path="/w/:workspaceSlug/billing"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/plans"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/analytics/*"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/analytics"
            element={<WorkspaceSettings />}
          />

          {/* --- Main Workspace Shell with Navigation & Tools --- */}
          <Route path="/w/:workspaceSlug" element={<AppShell />}>
            <Route index element={<AIChatView />} />
            <Route path="home" element={<AIChatView />} />
            <Route path="overview" element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="c/:channelSlug" element={<ChannelPage />} />
            <Route path="channels" element={<BrowseChannelsPage />} />
            <Route path="channels/new" element={<CreateChannelPage />} />
            <Route path="members" element={<MembersPage />} />
            {/* The sidebar calls the member list "Directory". */}
            <Route path="directory" element={<MembersPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="inbox" element={<InboxView />} />
            <Route path="schedule" element={<ScheduleView />} />
            <Route path="tasks" element={<AsanaProjectManager />} />
            <Route path="kanban" element={<AsanaProjectManager />} />
            <Route path="work" element={<AsanaProjectManager />} />
            <Route path="projects" element={<AsanaProjectManager />} />
            <Route path="cycles" element={<AsanaProjectManager />} />
            <Route path="intake" element={<AsanaProjectManager />} />
            <Route path="initiatives" element={<AsanaProjectManager />} />
            <Route path="notes" element={<DocumentEditor />} />
            <Route path="docs" element={<DocumentEditor />} />
            <Route path="files" element={<FileManagerView />} />
            <Route path="pulse" element={<ActivityTimelineView />} />
            <Route path="timeline" element={<ActivityTimelineView />} />
            <Route path="activity" element={<ActivityTimelineView />} />
            <Route path="meetings" element={<MeetingsView />} />
            <Route path="dms" element={<DirectMessagesPage />} />
            <Route path="threads" element={<ThreadsView />} />
            <Route path="saved" element={<SavedView />} />
            <Route path="ai-chat" element={<AIChatView />} />
            <Route path="ai/prompts" element={<PromptLibraryView />} />
            <Route path="ai/images" element={<AIImageGeneratorView />} />
            <Route path="whiteboards" element={<WhiteboardCanvas />} />
            <Route path="agents" element={<AgentMarketplaceView />} />
            <Route path="agents/chat" element={<AgentChatView />} />
            <Route path="agents/:agentId/chat" element={<AgentChatView />} />
            <Route path="agents/builder" element={<AgentBuilderView />} />
            <Route path="agents/logs" element={<AgentMonitoringView />} />
            <Route path="automations" element={<WorkflowListView />} />
            <Route path="automations/builder" element={<WorkflowCanvasView />} />
            <Route path="automations/logs" element={<WorkflowExecutionLogsView />} />
            <Route path="integrations" element={<IntegrationHubView />} />
            <Route path="apps" element={<AppChatView />} />
            <Route path="apps/chat" element={<AppChatView />} />
            <Route path="apps/:appId/chat" element={<AppChatView />} />
            <Route path="cards" element={<CardRegistryView />} />
            <Route path="cards/builder" element={<CardBuilderView />} />
            <Route path="cards/:cardId/builder" element={<CardBuilderView />} />
            <Route path="design-system" element={<DesignSystemStudio />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="/design-system" element={<DesignSystemStudio />} />
        <Route path="/404" element={<NotFoundPage />} />

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

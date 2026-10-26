import {
  DesktopAuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  LogoutPage,
  MagicLinkVerifyPage,
  MobileDeviceConfirmPage,
  MobileDevicePairPage,
  ProtectedRoute,
  PublicOnlyRoute,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
  useSessionBootstrap,
} from '@org/auth';
import { Button, EmptyState, LoadingState } from '@org/ui';
/*
 * `@org/web-chat` is already in the main chunk — `Providers` mounts its
 * `MatrixProvider` on every render — so its screens are imported statically
 * too. Splitting them would only add a chunk boundary with nothing behind it.
 */
import { EncryptionSecurityPanel, SavedView, ThreadsView } from '@org/web-chat';
/*
 * `@org/web-desktop` is already in the main chunk too — `Providers` mounts its
 * `DesktopProvider`/`DesktopChrome` on every render (see providers.tsx) — so
 * this is static for the same reason `@org/web-chat` above is; lazy-loading
 * one export of an already-bundled library only adds a chunk boundary with
 * nothing behind it, and trips `@nx/enforce-module-boundaries`' check against
 * importing the same library both ways.
 */
import { studioAppUrl } from '@org/platform';
import { PlatformDiagnosticsPage } from '@org/web-desktop';
import { lazy, Suspense, useEffect } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { DocumentTitle } from './document-title';

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
const PeoplePage = lazy(() =>
  import('@org/web-members').then((m) => ({ default: m.PeoplePage })),
);
const InvitationsPage = lazy(() =>
  import('@org/web-invitations').then((m) => ({ default: m.InvitationsPage })),
);
const AcceptInvitationPage = lazy(() =>
  import('@org/web-invitations').then((m) => ({
    default: m.AcceptInvitationPage,
  })),
);
const GlobalInviteMembersDialog = lazy(() =>
  import('@org/web-invitations').then((m) => ({
    default: m.GlobalInviteMembersDialog,
  })),
);
const EmployeeSettingsPanel = lazy(() =>
  import('@org/web-members').then((m) => ({
    default: m.EmployeeSettingsPanel,
  })),
);
const ProfileSettingsPanel = lazy(() =>
  import('@org/web-profile').then((m) => ({ default: m.ProfileSettingsPanel })),
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
const PricingPage = lazy(() =>
  import('@org/web-workspace').then((m) => ({
    default: m.PricingPage,
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
const ThemeSettings = lazy(() =>
  import('@org/web-settings').then((m) => ({
    default: m.ThemeSettings,
  })),
);

/**
 * The settings page with its borrowed tabs supplied.
 *
 * `@org/web-workspace` sits below `@org/web-integrations`,
 * `@org/web-work-tools`, `@org/web-settings`, and `@org/web-profile` in the dependency graph,
 * so it cannot import either; the route layer is the first place that may depend on all. See
 * `WorkspaceSettingsPageProps`.
 */
function WorkspaceSettings() {
  return (
    <>
      <WorkspaceSettingsPage
        importPanel={<SlackNotionImportView embedded />}
        kanbanPanel={<WorkspaceKanbanSettings />}
        themePanel={<ThemeSettings />}
        profilePanel={<ProfileSettingsPanel />}
        workProfilePanel={<EmployeeSettingsPanel />}
        invitationsPanel={<InvitationsPage embedded />}
        encryptionSecurityPanel={<EncryptionSecurityPanel />}
      />
      {/* The settings surface renders outside AppShell, so it needs its own
          mount of the app-wide invite dialog for the Members "Invite" buttons. */}
      <Suspense fallback={null}>
        <GlobalInviteMembersDialog />
      </Suspense>
    </>
  );
}
const WorkspaceRedirect = lazy(() =>
  import('@org/web-workspace').then((m) => ({ default: m.WorkspaceRedirect })),
);
const AsanaProjectManager = lazy(() =>
  import('@org/web-work-tools').then((m) => ({
    default: m.AsanaProjectManager,
  })),
);
const DocumentEditor = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.DocumentEditor })),
);
const FileManagerView = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.FileManagerView })),
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
const CallDetailPage = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.CallDetailPage })),
);
const AIChatView = lazy(() =>
  import('@org/web-coworkers').then((m) => ({ default: m.AIChatView })),
);
/*
 * The AI Agent Studio is its own app (`apps/ai-agent-studio`). Anything under
 * `/w/:slug/ai` hands off to it; only the agent/coworker profile editor stays
 * here for coworkers, because the sidebar opens it; agents go to the Studio.
 */
const AIEntityEditorRoute = lazy(() =>
  import('@org/web-coworkers').then((m) => ({
    default: m.AIEntityEditorRoute,
  })),
);
const AgentMarketplaceView = lazy(() =>
  import('@org/web-agents').then((m) => ({ default: m.AgentMarketplaceView })),
);
const CoworkerCreateDialog = lazy(() =>
  import('@org/web-coworkers').then((m) => ({
    default: m.CoworkerCreateDialog,
  })),
);

/**
 * The marketplace, with coworker creation and the live connectors (both of
 * which live outside `@org/web-agents`) plugged in.
 */
function MarketplaceRoute() {
  return (
    <AgentMarketplaceView
      renderCoworkerCreate={(props) =>
        props.open ? (
          <Suspense fallback={null}>
            <CoworkerCreateDialog {...props} />
          </Suspense>
        ) : null
      }
      renderIntegrations={({ searchQuery }) => (
        <Suspense fallback={null}>
          <IntegrationHubView embedded searchQuery={searchQuery} />
        </Suspense>
      )}
    />
  );
}
const AgentChatView = lazy(() =>
  import('@org/web-agents').then((m) => ({ default: m.AgentChatView })),
);
const CoworkerChatView = lazy(() =>
  import('@org/web-coworkers').then((m) => ({
    default: m.CoworkerChatView,
  })),
);
const WorkflowCanvasView = lazy(() =>
  import('@org/web-automations').then((m) => ({
    default: m.WorkflowCanvasView,
  })),
);
const AutomationCenterLayout = lazy(() =>
  import('@org/web-automations').then((m) => ({
    default: m.AutomationCenterLayout,
  })),
);
const IntegrationHubView = lazy(() =>
  import('@org/web-integrations').then((m) => ({
    default: m.IntegrationHubView,
  })),
);
const AppChatView = lazy(() =>
  import('@org/web-integrations').then((m) => ({ default: m.AppChatView })),
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

const GlobalSearchView = lazy(() =>
  import('@org/web-search').then((m) => ({ default: m.GlobalSearchView })),
);

/**
 * Redirects a pre-nesting settings URL (`/w/:slug/billing`, `/w/:slug/profile`,
 * …) to its home under the nested surface (`/w/:slug/settings/<section>`), so
 * old bookmarks and external links keep resolving.
 */
function LegacySettingsRedirect({ section }: { section: string }) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return <Navigate to={`/w/${workspaceSlug}/settings/${section}`} replace />;
}

/**
 * Where each tab of the former AI Studio lives now. Models had no settings of
 * their own there (a static list); provider keys and models are configured in
 * Settings → AI providers.
 */
const STUDIO_TAB_TO_SECTION: Record<string, string> = {
  overview: '',
  agents: 'agents',
  coworkers: 'coworkers',
  workflows: 'workflows',
  executions: 'runs',
  approvals: 'approvals',
  knowledge: 'knowledge',
  prompts: 'prompts',
  tools: 'tools',
  mcp: 'tools',
  models: 'tools',
  apps: '',
  analytics: '',
};

/** Hands `/w/:slug/ai/...` to the standalone AI Agent Studio, same path. */
function StudioRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(
      studioAppUrl(`${location.pathname}${location.search}${location.hash}`),
    );
  }, [location.pathname, location.search, location.hash]);
  return <LoadingState fullPage />;
}

/**
 * Sends a bookmark or link to any former AI surface — AI Studio, the separate
 * Agent Studio app, the Agent Builder, Automations, the coworker directory —
 * to the AI Agent Studio, keeping the id it referred to.
 */
function LegacyAIRedirect({
  to,
}: {
  to:
    | 'studio'
    | 'agents'
    | 'agent-builder'
    | 'agent-logs'
    | 'coworkers'
    | 'automations'
    | 'workflow-builder'
    | 'workflow-logs';
}) {
  const { workspaceSlug, tab } = useParams<{
    workspaceSlug: string;
    tab?: string;
  }>();
  const [params] = useSearchParams();
  const base = `/w/${workspaceSlug}/ai`;
  const target = (() => {
    switch (to) {
      case 'studio': {
        const section = STUDIO_TAB_TO_SECTION[tab ?? 'overview'] ?? '';
        return section ? `${base}/${section}` : base;
      }
      case 'agents':
        return `${base}/agents`;
      case 'agent-builder': {
        const id = params.get('agentId');
        const name = params.get('name');
        return id
          ? `${base}/agents/${id}`
          : `${base}/agents/new${name ? `?name=${encodeURIComponent(name)}` : ''}`;
      }
      case 'agent-logs':
        return `${base}/runs?type=AGENT`;
      case 'coworkers':
        return `${base}/coworkers`;
      case 'automations': {
        const id = params.get('workflow');
        return id ? `${base}/workflows/${id}` : `${base}/workflows`;
      }
      case 'workflow-builder': {
        const id = params.get('id');
        return `${base}/workflows/${id ?? 'new'}`;
      }
      case 'workflow-logs': {
        const id = params.get('workflow');
        return `${base}/runs?type=WORKFLOW${id ? `&entity=${id}` : ''}`;
      }
    }
  })();
  return <Navigate to={target} replace />;
}

/** `/marketplace/apps/:slug` — the marketplace reads the item from `?app=` / `?agent=`. */
function MarketplaceItemRedirect({ kind }: { kind: 'app' | 'agent' }) {
  const { workspaceSlug, slug } = useParams<{
    workspaceSlug: string;
    slug: string;
  }>();
  return (
    <Navigate
      to={`/w/${workspaceSlug}/marketplace?${kind}=${encodeURIComponent(slug ?? '')}`}
      replace
    />
  );
}

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

export /**
 * Every page that lives inside the workspace shell. Declared once so the same
 * table serves the routed outlet and the split pane (`workspaceSplitPages`),
 * which renders any of these beside the current page.
 */
const workspaceChildRoutes = (
  <>
    <Route index element={<AIChatView />} />
    <Route path="home" element={<AIChatView />} />
    <Route path="overview" element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="c/:channelSlug" element={<ChannelPage />} />
    <Route path="channels" element={<BrowseChannelsPage />} />
    <Route path="channels/new" element={<CreateChannelPage />} />
    <Route path="members" element={<MembersPage />} />
    {/* People: employee directory and celebrations; profiles open in the right rail. `members` stays the role / AI-coworker admin page. */}
    <Route path="directory" element={<PeoplePage />} />
    <Route path="inbox" element={<InboxView />} />
    <Route path="schedule" element={<ScheduleView />} />
    <Route path="tasks" element={<AsanaProjectManager />} />
    <Route path="tasks/:projectId" element={<AsanaProjectManager />} />
    <Route path="kanban" element={<AsanaProjectManager />} />
    <Route path="work" element={<AsanaProjectManager />} />
    <Route path="projects" element={<AsanaProjectManager />} />
    <Route path="projects/:projectId" element={<AsanaProjectManager />} />
    <Route path="cycles" element={<AsanaProjectManager />} />
    <Route path="intake" element={<AsanaProjectManager />} />
    <Route path="initiatives" element={<AsanaProjectManager />} />
    <Route path="notes" element={<DocumentEditor />} />
    <Route path="notes/:docId" element={<DocumentEditor />} />
    <Route path="docs" element={<DocumentEditor />} />
    <Route path="docs/:docId" element={<DocumentEditor />} />
    <Route path="files" element={<FileManagerView />} />
    {/* Pulse was removed; old links land on the dashboard. */}
    <Route path="pulse" element={<Navigate to="../dashboard" replace />} />
    <Route path="timeline" element={<Navigate to="../dashboard" replace />} />
    <Route path="activity" element={<Navigate to="../dashboard" replace />} />
    <Route path="meetings" element={<MeetingsView />} />
    <Route path="calls" element={<CallDetailPage />} />
    <Route path="dms" element={<DirectMessagesPage />} />
    <Route path="dms/:peerId" element={<DirectMessagesPage />} />
    <Route path="threads" element={<ThreadsView />} />
    <Route path="saved" element={<SavedView />} />
    <Route path="ai-chat" element={<AIChatView />} />

    {/* --- AI Agent Studio: a separate app; published agents appear in the sidebar --- */}
    <Route
      path="ai/agents/:agentId"
      element={<AIEntityEditorRoute agentFallback={<StudioRedirect />} />}
    />
    <Route path="ai/*" element={<StudioRedirect />} />

    {/* Conversations with an agent or coworker stay where chat lives. */}
    <Route path="agents/chat" element={<AgentChatView />} />
    <Route path="agents/:agentId/chat" element={<AgentChatView />} />
    <Route path="coworkers/:id" element={<CoworkerChatView />} />

    {/* Former AI entry points, kept so bookmarks resolve. */}
    <Route path="agents" element={<LegacyAIRedirect to="agents" />} />
    <Route
      path="agents/builder"
      element={<LegacyAIRedirect to="agent-builder" />}
    />
    <Route path="agents/logs" element={<LegacyAIRedirect to="agent-logs" />} />
    <Route path="coworkers" element={<LegacyAIRedirect to="coworkers" />} />

    {/* Unified Automation Center */}
    <Route path="automations" element={<AutomationCenterLayout />} />
    <Route path="automations/builder" element={<WorkflowCanvasView />} />
    <Route
      path="automations/builder/:workflowId"
      element={<WorkflowCanvasView />}
    />
    <Route
      path="automations/logs"
      element={<Navigate to="../automations?tab=runs-logs" replace />}
    />

    {/* Apps & integrations: third-party apps and agents to install. */}
    <Route path="marketplace" element={<MarketplaceRoute />} />
    <Route
      path="marketplace/apps/:slug"
      element={<MarketplaceItemRedirect kind="app" />}
    />
    <Route
      path="marketplace/agents/:slug"
      element={<MarketplaceItemRedirect kind="agent" />}
    />
    <Route path="marketplace/developer" element={<MarketplaceRoute />} />
    {/* The Integration Hub lives in Marketplace → Apps & Integrations. */}
    <Route
      path="integrations"
      element={<Navigate to="../marketplace?tab=apps" replace />}
    />
    <Route path="apps" element={<AppChatView />} />
    <Route path="apps/chat" element={<AppChatView />} />
    <Route path="apps/:appId/chat" element={<AppChatView />} />
    <Route path="*" element={<NotFoundPage />} />
  </>
);

/** The page table for the split pane — resolved against the pane's own location. */
const workspaceSplitPages = (
  <Routes>
    <Route path="/w/:workspaceSlug">{workspaceChildRoutes}</Route>
  </Routes>
);

function App() {
  // Exchanges the httpOnly refresh cookie for a session before routing decides
  // whether the visitor is anonymous.
  useSessionBootstrap();

  return (
    /*
     * Neutral fallback, not "Loading your workspace…": this boundary also
     * catches a lazy route chunk loading on a later navigation (Settings,
     * Profile, and the other standalone routes have no closer boundary), and
     * flashing a full "workspace" loader there reads as the app reloading.
     * The genuine cold-start message lives in `ProtectedRoute`.
     */
    <Suspense fallback={<LoadingState fullPage />}>
      {/*
       * Single source of truth for the tab/window title — one derivation for
       * every route, so no page sets its own. Renders nothing.
       */}
      <DocumentTitle />
      <Routes>
        {/* --- public & callback routes -------------------------------- */}
        <Route path="/auth/callback" element={<DesktopAuthCallbackPage />} />
        <Route path="/auth/device" element={<MobileDeviceConfirmPage />} />
        <Route path="/auth/pair" element={<MobileDevicePairPage />} />
        <Route
          path="/auth/magic-link/verify"
          element={<MagicLinkVerifyPage />}
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* --- authenticated --------------------------------------------- */}
        <Route element={<ProtectedRoute />}>
          <Route path="/workspaces/new" element={<CreateWorkspacePage />} />
          {/* Cross-workspace search — spans every workspace, so it sits
              outside the /w/:slug shell (brief §4). */}
          <Route path="/search" element={<GlobalSearchView />} />

          {/*
            Never routable in a production build — not just unlinked. See
            PlatformDiagnosticsLink, the only thing that points here.
          */}
          {import.meta.env.DEV && (
            <Route
              path="/dev/platform-diagnostics"
              element={<PlatformDiagnosticsPage />}
            />
          )}

          {/* Bare "/" and "/open" resolve to the user's first workspace. */}
          <Route path="/" element={<WorkspaceRedirect />} />
          <Route path="/open" element={<WorkspaceRedirect />} />
          <Route path="/settings" element={<WorkspaceRedirect />} />

          {/*
            --- Settings ---
            One nested surface: /w/:slug/settings/<section>. Bare /settings
            lands on the first section; the pre-nesting top-level paths
            (/billing, /profile, /analytics, …) redirect in so old bookmarks
            keep working.
          */}
          <Route
            path="/w/:workspaceSlug/settings"
            element={<Navigate to="appearance" replace />}
          />
          <Route
            path="/w/:workspaceSlug/settings/:section"
            element={<WorkspaceSettings />}
          />
          <Route
            path="/w/:workspaceSlug/invitations"
            element={<LegacySettingsRedirect section="invitations" />}
          />
          <Route
            path="/w/:workspaceSlug/import-export"
            element={<LegacySettingsRedirect section="import-export" />}
          />
          <Route
            path="/w/:workspaceSlug/migrations"
            element={<LegacySettingsRedirect section="import-export" />}
          />
          <Route
            path="/w/:workspaceSlug/admin/migrations"
            element={<LegacySettingsRedirect section="import-export" />}
          />
          <Route
            path="/w/:workspaceSlug/integrations/import"
            element={<LegacySettingsRedirect section="import-export" />}
          />
          <Route
            path="/w/:workspaceSlug/integrations/slack"
            element={<LegacySettingsRedirect section="import-export" />}
          />
          <Route
            path="/w/:workspaceSlug/profile"
            element={<LegacySettingsRedirect section="profile" />}
          />
          <Route
            path="/w/:workspaceSlug/billing"
            element={<LegacySettingsRedirect section="billing" />}
          />
          <Route
            path="/w/:workspaceSlug/plans"
            element={<LegacySettingsRedirect section="billing" />}
          />
          <Route path="/w/:workspaceSlug/pricing" element={<PricingPage />} />
          <Route
            path="/w/:workspaceSlug/analytics"
            element={<LegacySettingsRedirect section="analytics" />}
          />

          {/* The former AI Studio and the separate Agent Studio app now live
              in the AI Workspace, inside the app shell. */}
          <Route
            path="/w/:workspaceSlug/studio"
            element={<LegacyAIRedirect to="studio" />}
          />
          <Route
            path="/w/:workspaceSlug/studio/:tab"
            element={<LegacyAIRedirect to="studio" />}
          />
          <Route
            path="/w/:workspaceSlug/ai-studio"
            element={<LegacyAIRedirect to="studio" />}
          />
          <Route
            path="/w/:workspaceSlug/ai-studio/:tab"
            element={<LegacyAIRedirect to="studio" />}
          />
          <Route
            path="/w/:workspaceSlug/agent-studio"
            element={<LegacyAIRedirect to="agents" />}
          />

          {/* --- Main Workspace Shell with Navigation & Tools --- */}
          <Route
            path="/w/:workspaceSlug"
            element={<AppShell splitPages={workspaceSplitPages} />}
          >
            {workspaceChildRoutes}
          </Route>
        </Route>

        <Route path="/404" element={<NotFoundPage />} />

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

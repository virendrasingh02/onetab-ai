import { useAuthStore } from '@org/auth';
import { RealtimeProvider } from '@org/realtime';
import { LoadingState } from '@org/ui';
import { Activity, ShieldAlert } from 'lucide-react';
import { lazy, useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  LEGACY_SEGMENTS,
  Navigate,
  Outlet,
  Route,
  scopeStudioPath,
  useLocation,
  useParams,
} from './router.js';

import { SectionHeader } from './components/section-tabs.js';
import { StudioPage } from './components/studio-page.js';

import { useStudioSession } from './session-guard.js';

const corePages = () => import('./pages/core-pages.js');
const AgentCreatePage = lazy(() =>
  corePages().then((module) => ({ default: module.AgentCreatePage })),
);
const AgentDetailPage = lazy(() =>
  corePages().then((module) => ({ default: module.AgentDetailPage })),
);
const AgentLibrary = lazy(() =>
  corePages().then((module) => ({ default: module.AgentLibrary })),
);
const AIApprovalsSection = lazy(() =>
  corePages().then((module) => ({ default: module.AIApprovalsSection })),
);
const AIRunsSection = lazy(() =>
  corePages().then((module) => ({ default: module.AIRunsSection })),
);
const WorkflowCanvasView = lazy(() =>
  corePages().then((module) => ({ default: module.WorkflowCanvasView })),
);
const StudioHomePage = lazy(() =>
  import('./pages/studio-home-page.js').then((module) => ({
    default: module.StudioHomePage,
  })),
);

/**
 * Plan-first agents (the in-app Studio: describe → plan → test → run → approve)
 * hosted inside this app. The pages are the same components the workspace uses,
 * mounted at the same `/w/:workspaceSlug/ai/...` URLs so every link they build
 * keeps working.
 *
 * They read the signed-in user from the shared auth store, the workspace from
 * the URL slug, and live run updates from the realtime bus; this shell supplies
 * all three from the Studio session.
 */
export const STUDIO_CORE_PATH = '/w/:workspaceSlug/ai';

/** `/w/<active workspace>/ai/<segments>` — for nav links into the plan-first pages. */
export function studioCorePath(slug: string, ...segments: string[]): string {
  const rest = segments.filter(Boolean).join('/');
  return `/w/${slug}/ai${rest ? `/${rest}` : ''}`;
}

function StudioCoreFrame({ children }: { children: ReactNode }) {
  const { user, activeWorkspace } = useStudioSession();

  // The workspace hooks gate on the shared auth store; Studio keeps its own
  // session, so mirror the user into it.
  useEffect(() => {
    if (useAuthStore.getState().user?.id !== user.id)
      useAuthStore.getState().setUser(user);
  }, [user]);

  return (
    <RealtimeProvider userId={user.id} workspaceId={activeWorkspace.id}>
      {children}
    </RealtimeProvider>
  );
}

/** Keeps the URL's workspace and the Studio's active workspace the same. */
function StudioCoreRoute() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { activeWorkspace, workspaces, setActiveWorkspace } =
    useStudioSession();
  const match = workspaces.find((w) => w.slug === workspaceSlug);

  useEffect(() => {
    if (match && match.id !== activeWorkspace.id) setActiveWorkspace(match);
  }, [match, activeWorkspace.id, setActiveWorkspace]);

  if (!match)
    return <Navigate to={studioCorePath(activeWorkspace.slug)} replace />;
  if (match.id !== activeWorkspace.id) return <LoadingState fullPage />;
  return (
    <StudioCoreFrame>
      <Outlet />
    </StudioCoreFrame>
  );
}

/** Old un-prefixed URLs (`/agents/x`, `/connectors`…) → their one canonical `/w/:slug/ai/...` spelling. */
function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const { activeWorkspace } = useStudioSession();
  const first = pathname.split('/')[1] ?? '';
  const target = LEGACY_SEGMENTS.has(first)
    ? scopeStudioPath(activeWorkspace.slug, `${pathname}${search}${hash}`)
    : studioCorePath(activeWorkspace.slug);
  return <Navigate to={target} replace />;
}

function AgentRedirect() {
  const { agentId } = useParams<{ agentId: string }>();
  return <Navigate to={`/agents/${agentId}`} replace />;
}

/**
 * The shared list sections ship unpadded and untitled (their host layout pads
 * and titles them), so give them the same frame and header as every other
 * Studio page.
 */
function SectionFrame({
  children,
  ...header
}: { children: ReactNode } & Pick<
  ComponentProps<typeof StudioPage>,
  'title' | 'description' | 'icon'
>) {
  return <StudioPage {...header}>{children}</StudioPage>;
}

/** Canvas for an automation workflow, opened from a plan-first agent's "Open the canvas". */
function CanvasRoute() {
  return <WorkflowCanvasView />;
}

/**
 * Routes to nest inside the shell's `<Routes>` (full path, so keep them top-level).
 * `children` are the Studio's own pages, mounted under the same `/w/:slug/ai` root.
 */
export function studioCoreRoutes(children?: ReactNode) {
  return (
    <>
      <Route path={STUDIO_CORE_PATH} element={<StudioCoreRoute />}>
        <Route index element={<StudioHomePage />} />
        <Route
          path="agents"
          element={
            // Same bar + tab row as its section siblings (my-agents, coworkers, workflows).
            <div className="min-h-0 flex flex-1 flex-col">
              <AgentLibrary
                plannedOnly
                header={(actions) => (
                  <SectionHeader section="agents" actions={actions} />
                )}
              />
            </div>
          }
        />
        <Route
          path="runs"
          element={
            <SectionFrame
              title="Runs"
              description="Every agent, coworker and workflow run, live — with its steps, cost and outcome."
              icon={<Activity />}
            >
              <AIRunsSection />
            </SectionFrame>
          }
        />
        <Route
          path="approvals"
          element={
            <SectionFrame
              title="Human Approvals"
              description="Actions your agents are holding until someone approves or rejects them."
              icon={<ShieldAlert />}
            >
              <AIApprovalsSection />
            </SectionFrame>
          }
        />
        <Route path="studio/new" element={<AgentCreatePage />} />
        <Route path="studio/:workflowId" element={<AgentDetailPage />} />
        <Route path="workflows/:workflowId" element={<CanvasRoute />} />
        {/* Links from the main app (`/w/:slug/ai/...`) that land on a Studio page of its own. */}
        <Route path="prompts" element={<Navigate to="/templates" replace />} />
        <Route path="agents/new" element={<Navigate to="/create" replace />} />
        <Route path="agents/:agentId" element={<AgentRedirect />} />
        {children}
        <Route path="*" element={<Navigate to=".." replace />} />
      </Route>
      <Route path="*" element={<LegacyRedirect />} />
    </>
  );
}

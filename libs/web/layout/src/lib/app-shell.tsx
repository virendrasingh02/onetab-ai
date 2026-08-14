import { useCurrentUser } from '@org/auth';
import {
  Button,
  CommandPalette,
  EmptyState,
  ErrorBoundary,
  LoadingState,
  Sheet,
  SheetContent,
  SheetTitle,
  TooltipProvider,
  useCommandPalette,
} from '@org/ui';
import { cn } from '@org/utils';
import { useChannels } from '@org/web-channels';
import { useDesktopCommand } from '@org/web-desktop';
import {
  NotificationCenter,
  NotificationEnableBar,
  useNotificationFeed,
  useNotificationUnread,
} from '@org/notifications';
import { WorkspaceSearchPanel } from '@org/web-search';
import { useCurrentWorkspace, useWorkspaces } from '@org/web-workspace';
import { Building2 } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from './app-header.js';
import { AssistantPanel } from './assistant-panel.js';
import { ChannelNav } from './channel-nav.js';
import { ResizeHandle } from './resize-handle.js';
import { useResizableLayout } from './use-resizable-layout.js';
import { WorkspaceMenu } from './workspace-switcher.js';

export function AppShell() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const palette = useCommandPalette();

  const {
    leftWidth,
    rightWidth,
    sidebarOpen,
    rightPanelOpen,
    isResizing,
    isMobile,
    bounds,
    setSidebarOpen,
    setRightPanelOpen,
    startLeftResize,
    startRightResize,
    resetLeftWidth,
    resetRightWidth,
    stepLeftWidth,
    stepRightWidth,
  } = useResizableLayout();

  const workspacesQuery = useWorkspaces();
  const { slug, workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const channelsQuery = useChannels(workspaceId);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  /*
   * The feed is fetched here as well as inside the centre so the bell can show
   * a count before the sheet has ever been opened. Both calls share one query
   * key, so this is a cache read rather than a second request.
   */
  const notificationFeed = useNotificationFeed(workspaceId);
  const unread = useNotificationUnread(workspaceId, notificationFeed.data);

  /*
   * Navigating dismisses the mobile drawers — on a phone they cover the page
   * you just asked for. On desktop they are real columns, so leave them alone.
   */
  useEffect(() => {
    if (!isMobile) return;
    setSidebarOpen(false);
    setRightPanelOpen(false);
  }, [location.pathname, isMobile, setSidebarOpen, setRightPanelOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const toggleSidebar = useCallback(
    () => setSidebarOpen((open) => !open),
    [setSidebarOpen],
  );
  const closeAssistant = useCallback(
    () => setRightPanelOpen(false),
    [setRightPanelOpen],
  );
  const toggleAssistant = useCallback(
    () => setRightPanelOpen((open) => !open),
    [setRightPanelOpen],
  );

  /*
   * The native menu bar, the tray menu and the global shortcut all reach the UI
   * through these. Registered before the early returns below so the hook order
   * stays stable, and no-ops in the browser where nothing ever fires them.
   */
  useDesktopCommand('open-search', () => palette.setOpen(true));
  useDesktopCommand('open-shortcuts', () => palette.setOpen(true));
  useDesktopCommand('open-ai-assistant', () => setRightPanelOpen(true));
  useDesktopCommand('toggle-sidebar', toggleSidebar);
  useDesktopCommand('new-channel', () => {
    if (slug) navigate(`/w/${slug}/channels/new`);
  });
  useDesktopCommand('open-settings', () => {
    if (slug) navigate(`/w/${slug}/settings`);
  });

  if (!user) return <LoadingState fullPage />;

  // Signed in but with no workspace yet — send them to onboarding.
  if (workspacesQuery.isSuccess && workspacesQuery.data.length === 0) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <EmptyState
          size="lg"
          icon={<Building2 />}
          title="Create your first workspace"
          description="Workspaces hold your channels, members and files. You can create more later."
          action={
            <Button onClick={() => navigate('/workspaces/new')}>
              Create a workspace
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || workspacesQuery.isLoading) {
    return <LoadingState fullPage label="Loading your workspace…" />;
  }

  if (!workspace || !slug || !workspaceId) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <EmptyState
          icon={<Building2 />}
          title="Workspace not found"
          description="It may have been deleted, or you may no longer be a member."
          action={
            <Button asChild variant="outline">
              <Link to="/">Go to your workspaces</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const workspaces = workspacesQuery.data ?? [];

  const channelNav = (
    <ChannelNav
      workspaceId={workspaceId}
      workspaceSlug={slug}
      channels={channelsQuery.data}
      isLoading={channelsQuery.isLoading}
      onCreateChannel={() => navigate(`/w/${slug}/channels/new`)}
      onBrowseChannels={() => navigate(`/w/${slug}/channels`)}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col gap-1.5 overflow-hidden bg-background p-1.5 font-sans text-foreground">
        <div
          className={cn(
            'relative flex min-h-0 flex-1 gap-1.5 overflow-hidden',
            isResizing && 'cursor-col-resize select-none',
          )}
        >
          {/*
            Column 1 / Box 1: navigation rail.
            Both rails sit one step *below* the editor panel — `surface-muted`
            against the panel's `card` — which is the only tonal difference in
            the shell. Everything else is carried by the 1px border and the 6px
            gutter, so the three panes read as one flat surface set rather than
            three floating cards.
          */}
          {sidebarOpen && !isMobile ? (
            <>
              <aside
                className="flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-muted text-sidebar-foreground"
                style={{ width: `${leftWidth}px` }}
                aria-label="Sidebar navigation"
              >
                <div className="flex h-12 shrink-0 items-center border-b border-border px-2">
                  <WorkspaceMenu
                    workspaces={workspaces}
                    current={workspace}
                    onToggleSidebar={closeSidebar}
                    onOpenSearch={() => palette.setOpen(true)}
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-col">{channelNav}</div>
              </aside>

              <ResizeHandle
                side="left"
                isResizing={isResizing === 'left'}
                currentWidth={leftWidth}
                minWidth={bounds.leftMin}
                maxWidth={bounds.leftMax}
                onPointerDown={startLeftResize}
                onDoubleClick={resetLeftWidth}
                onStepWidth={stepLeftWidth}
                onResetWidth={resetLeftWidth}
              />
            </>
          ) : null}

          {/* Column 2 / Box 2: the editor panel — the one lifted surface. */}
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
            <AppHeader
              user={user}
              workspaceSlug={slug}
              title={workspace.name}
              subtitle={`${workspace.memberCount} members · ${workspace.channelCount} channels`}
              onOpenSearch={() => palette.setOpen(true)}
              onToggleRightPanel={toggleAssistant}
              rightPanelOpen={rightPanelOpen}
              onToggleSidebar={toggleSidebar}
              sidebarOpen={sidebarOpen}
              onOpenNotifications={() => setNotificationsOpen(true)}
              unreadNotifications={unread.count}
            />

            <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
              <ErrorBoundary resetKeys={[location.pathname]}>
                <Suspense fallback={<LoadingState fullPage />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>

          {/* Column 3 / Box 3: AI Assistant Panel Box */}
          {rightPanelOpen && !isMobile ? (
            <>
              <ResizeHandle
                side="right"
                isResizing={isResizing === 'right'}
                currentWidth={rightWidth}
                minWidth={bounds.rightMin}
                maxWidth={bounds.rightMax}
                onPointerDown={startRightResize}
                onDoubleClick={resetRightWidth}
                onStepWidth={stepRightWidth}
                onResetWidth={resetRightWidth}
              />

              <aside
                className="flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-muted text-foreground"
                style={{ width: `${rightWidth}px` }}
                aria-label="AI assistant"
              >
                <AssistantPanel onClose={closeAssistant} />
              </aside>
            </>
          ) : null}
        </div>

        {/* Notification Enable Bar at the bottom outside of all boxes */}
        <NotificationEnableBar workspaceId={workspaceId} />

        {/*
          Below `md` both panels become Radix sheets instead of hand-rolled
          `fixed` divs with a manual backdrop. That is what gives them focus
          trapping, Escape-to-close, body scroll locking, focus restoration to
          the trigger and an enter/exit transition — the previous markup had
          none of those, and its `transition-all` never even ran because the
          closed state was `display: none`.
        */}
        <Sheet open={isMobile && sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            hideCloseButton
            className="w-75 max-w-[85vw] gap-0 bg-surface-muted p-0"
          >
            <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
            <div className="flex h-12 shrink-0 items-center border-b border-border px-2">
              <WorkspaceMenu
                workspaces={workspaces}
                current={workspace}
                onToggleSidebar={closeSidebar}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{channelNav}</div>
          </SheetContent>
        </Sheet>

        <Sheet open={isMobile && rightPanelOpen} onOpenChange={setRightPanelOpen}>
          <SheetContent
            side="right"
            hideCloseButton
            className="w-85 max-w-[90vw] gap-0 bg-surface-muted p-0"
          >
            <SheetTitle className="sr-only">AI assistant</SheetTitle>
            <AssistantPanel onClose={closeAssistant} />
          </SheetContent>
        </Sheet>

        <NotificationCenter
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
          workspaceId={workspaceId}
          workspaceSlug={slug}
        />

        <CommandPalette
          open={palette.open}
          onOpenChange={palette.setOpen}
          placeholder="Search channels, people, docs…"
          renderResults={(query) => (
            <WorkspaceSearchPanel
              workspaceId={workspaceId}
              workspaceSlug={slug}
              query={query}
              onNavigate={() => palette.setOpen(false)}
            />
          )}
        />
      </div>
    </TooltipProvider>
  );
}

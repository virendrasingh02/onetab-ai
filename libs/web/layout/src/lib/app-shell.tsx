import { userApi } from '@org/api-client';
import { useAccountStore, useAuthStore, useCurrentUser } from '@org/auth';
import {
  Button,
  CommandPalette,
  EmptyState,
  ErrorBoundary,
  FocusModeWidget,
  HuddleDock,
  LoadingState,
  Sheet,
  SheetContent,
  SheetTitle,
  StatusModal,
  TeamWorldClockModal,
  TooltipProvider,
  useCommandPalette,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { CreateChannelDialog, useChannels } from '@org/web-channels';
import { useDesktopCommand } from '@org/web-desktop';
import { useMembers } from '@org/web-members';
import {
  NotificationEnableBar,
  useChannelActivity,
  useNotificationFeed,
  useNotificationUnread,
  useWorkspaceActivity,
} from '@org/notifications';
import { WorkspaceSearchPanel } from '@org/web-search';
import { InviteMembersDialog } from '@org/web-invitations';
import {
  useCurrentWorkspace,
  useWorkspaces,
  useWorkspaceStore,
  type WorkspaceState,
} from '@org/web-workspace';
import { Building2 } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AddAccountDialog } from './add-account-dialog.js';
import { AppHeader } from './app-header.js';
import { ChannelNav } from './channel-nav.js';
import { ManageAccountsDialog } from './manage-accounts-dialog.js';
import { useSidebarSync } from './navigation/use-sidebar-sync.js';
import { useSidebarStore } from './navigation/sidebar-store.js';
import { ResizeHandle } from './resize-handle.js';
import { RightPanel } from './right-panel.js';
import { useResizableLayout } from './use-resizable-layout.js';
import { WorkspaceMenu } from './workspace-switcher.js';

export function AppShell() {
  const user = useCurrentUser();
  const setUser = useAuthStore((s) => s.setUser);

  // Hydrate the sidebar-customization store from the server and push local
  // changes back — so a reordered sidebar survives logout and moves between
  // devices rather than living only in this browser's localStorage.
  useSidebarSync(!!user);
  const navigate = useNavigate();
  const location = useLocation();
  const palette = useCommandPalette();
  const isSidebarCollapsed = useSidebarStore((s) => s.sidebarCollapsed);
  /* Creating a channel is a dialog, so the sidebar's "+" no longer navigates
     away from whatever the user was reading. */
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const {
    leftWidth,
    rightWidth,
    sidebarOpen,
    isResizing,
    isMobile,
    bounds,
    setSidebarOpen,
    startLeftResize,
    startRightResize,
    resetLeftWidth,
    resetRightWidth,
    stepLeftWidth,
    stepRightWidth,
  } = useResizableLayout();

  /* The rail's open state is shared app-wide — see `right-panel-store`. */
  const rightPanelOpen = useRightPanelStore((s) => s.open);
  const setRightPanelOpen = useRightPanelStore((s) => s.setOpen);
  /* Not `setOpen(false)`: a hosted panel's owner has to hear about the close. */
  const dismissRightPanel = useRightPanelStore((s) => s.dismiss);
  const resetRightPanel = useRightPanelStore((s) => s.reset);

  const isManageAccountsOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.isManageAccountsOpen,
  );
  const setManageAccountsOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setManageAccountsOpen,
  );
  const isAddAccountOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.isAddAccountOpen,
  );
  const setAddAccountOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setAddAccountOpen,
  );
  const isInviteMembersOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.isInviteMembersOpen,
  );
  const setInviteMembersOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setInviteMembersOpen,
  );
  const inviteTargetWorkspace = useWorkspaceStore(
    (s: WorkspaceState) => s.inviteTargetWorkspace,
  );

  const workspacesQuery = useWorkspaces();
  const { slug, workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const channelsQuery = useChannels(workspaceId);
  const membersQuery = useMembers(workspaceId);

  /*
   * The feed is fetched here as well as on the Inbox page so the bell and the
   * Inbox row can carry a count from anywhere in the app. Both calls share one
   * query key, so this is a cache read rather than a second request.
   */
  const notificationFeed = useNotificationFeed(workspaceId);
  const unread = useNotificationUnread(workspaceId, notificationFeed.data);
  const channelActivity = useChannelActivity(
    workspaceId,
    notificationFeed.data,
  );

  /*
   * Every workspace's feed, not just this one's — the switcher has to say
   * whether anything is waiting in the workspaces the user is *not* looking at,
   * which is the only place that answer can come from.
   */
  const workspaceIds = useMemo(
    () => (workspacesQuery.data ?? []).map((entry) => entry.id),
    [workspacesQuery.data],
  );
  const workspaceActivity = useWorkspaceActivity(workspaceIds);

  /*
   * Keep the active account's cached workspace list current, so the switcher
   * can group *every* linked account's workspaces by email — a background
   * account's list can only be read with its own token, which is not the one
   * on the wire. `setAccountWorkspaces` no-ops when nothing changed.
   */
  const setAccountWorkspaces = useAccountStore((s) => s.setAccountWorkspaces);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  useEffect(() => {
    if (!activeAccountId || !workspacesQuery.data) return;
    setAccountWorkspaces(
      activeAccountId,
      workspacesQuery.data.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        email: w.email ?? null,
        icon: w.icon ?? null,
        iconColor: w.iconColor ?? null,
        avatarUrl: w.avatarUrl ?? null,
        memberCount: w.memberCount,
      })),
    );
  }, [activeAccountId, workspacesQuery.data, setAccountWorkspaces]);

  /*
   * Navigating dismisses the mobile drawers — on a phone they cover the page
   * you just asked for. On desktop they are real columns, so leave them alone.
   */
  useEffect(() => {
    if (!isMobile) return;
    setSidebarOpen(false);
    setRightPanelOpen(false);
  }, [location.pathname, isMobile, setSidebarOpen, setRightPanelOpen]);

  /*
   * A workspace switch starts the right rail over. Its open/closed state and
   * which panel it shows are global (see `right-panel-store`), so without this
   * an "Ask AI" rail — or an open profile — opened in one workspace stays put,
   * now pointed at a different workspace, after switching. Ref-guarded so it
   * fires only on a real change of workspace, never on the first resolve, a
   * reload, or leaving/returning to the same workspace.
   */
  const lastWorkspaceIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!workspaceId) return;
    if (
      lastWorkspaceIdRef.current &&
      lastWorkspaceIdRef.current !== workspaceId
    ) {
      resetRightPanel();
    }
    lastWorkspaceIdRef.current = workspaceId;
  }, [workspaceId, resetRightPanel]);

  const closeSidebar = useCallback(
    () => setSidebarOpen(false),
    [setSidebarOpen],
  );
  const toggleSidebar = useCallback(
    () => setSidebarOpen((open) => !open),
    [setSidebarOpen],
  );
  const closeAssistant = useCallback(
    () => dismissRightPanel(),
    [dismissRightPanel],
  );
  /*
   * The native menu bar, the tray menu and the global shortcut all reach the UI
   * through these. Registered before the early returns below so the hook order
   * stays stable, and no-ops in the browser where nothing ever fires them.
   */
  useDesktopCommand('open-search', () => palette.setOpen(true));
  useDesktopCommand('open-shortcuts', () => palette.setOpen(true));
  useDesktopCommand('open-ai-assistant', () =>
    useRightPanelStore.getState().setView('assistant'),
  );
  useDesktopCommand('toggle-sidebar', toggleSidebar);
  useDesktopCommand('new-channel', () => setCreateChannelOpen(true));
  useDesktopCommand('open-invite', () => setInviteMembersOpen(true));
  useDesktopCommand('open-settings', () => {
    if (slug) navigate(`/w/${slug}/settings`);
  });

  /*
   * One loader for the whole boot path. The user, the workspace list and the
   * current workspace all land at different moments, and gating them
   * separately flashed a second spinner between them — so they share a single
   * screen with a single label until the shell has everything it needs.
   */
  /*
   * Only block on a genuine cold start — nothing to show yet. Once we have a
   * workspace and its list, a later background refetch (`isLoading` never goes
   * true for those since they keep their data, but `enabled` gaps or a cache
   * eviction can) must not swap the whole shell for the loader: that unmounts
   * the sidebar, header and every panel and reads as the app reloading on
   * every navigation.
   */
  const bootingWorkspace =
    (isLoading && !workspace) ||
    (workspacesQuery.isLoading && !workspacesQuery.data);
  if (!user || bootingWorkspace) {
    return <LoadingState fullPage label="Loading your workspace…" />;
  }

  // Signed in but with no workspace yet — send them to onboarding.
  if (workspacesQuery.isSuccess && workspacesQuery.data.length === 0) {
    return (
      <div className="p-6 grid min-h-full place-items-center">
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

  if (!workspace || !slug || !workspaceId) {
    return (
      <div className="p-6 grid min-h-full place-items-center">
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

  const effectiveLeftWidth = isSidebarCollapsed ? 64 : leftWidth;

  const channelNav = (
    <ChannelNav
      workspaceId={workspaceId}
      workspaceSlug={slug}
      channels={channelsQuery.data}
      isLoading={channelsQuery.isLoading}
      inboxUnread={unread.count}
      channelActivity={channelActivity}
      onCreateChannel={() => setCreateChannelOpen(true)}
      onBrowseChannels={() => navigate(`/w/${slug}/channels`)}
      isCollapsed={isSidebarCollapsed && !isMobile}
    />
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background bg-app-gradient font-sans text-foreground">
        {/* Top Header Bar spanning full width */}
        <AppHeader
          user={user}
          workspaceSlug={slug}
          workspaceId={workspaceId}
          title={workspace.name}
          subtitle={`${workspace.memberCount} members · ${workspace.channelCount} channels`}
          workspaces={workspaces}
          currentWorkspace={workspace}
          onOpenSearch={() => palette.setOpen(true)}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
          unreadNotifications={unread.count}
          workspaceActivity={workspaceActivity}
        />

        <div
          className={cn(
            'min-h-0 gap-1.5 p-1.5 pt-0 relative flex flex-1 overflow-hidden',
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
                className="group/sidebar flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-muted text-sidebar-foreground transition-[width] duration-150"
                style={{ width: `${effectiveLeftWidth}px` }}
                aria-label="Sidebar navigation"
              >
                <div className="min-h-0 flex flex-1 flex-col">{channelNav}</div>
              </aside>

              {!isSidebarCollapsed && (
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
              )}
            </>
          ) : null}

          {/* Column 2 / Box 2: the editor panel — the one lifted surface. */}
          <div className="min-w-0 bg-card shadow-2xs flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-border text-card-foreground">
            {/*
              The page scroller. `min-h-full` on the content keeps the column
              full-height for pages that fill it (chat) without capping the ones
              that outgrow it, so those pages size themselves with `flex-1
              min-h-0` rather than `h-full` — a percentage height has nothing
              definite to resolve against inside a scrolled content box.
            */}
            <main className="min-w-0 flex flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex min-h-full flex-1 flex-col overflow-y-auto">
                <ErrorBoundary resetKeys={[location.pathname]}>
                  <Suspense fallback={<LoadingState fullPage />}>
                    <Outlet />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </main>
          </div>

          {/* Column 3 / Box 3: the switchable side rail — assistant, a
              person, the page's details, or an open Kanban card. */}
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
                aria-label="Side panel"
              >
                <RightPanel
                  currentUser={user}
                  workspaceSlug={slug}
                  onClose={closeAssistant}
                />
              </aside>
            </>
          ) : null}
        </div>

        {/* A running huddle opens full-width here, below all three boxes —
            the conversation portals its bar into this row. Empty otherwise. */}
        <HuddleDock />

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
            className="w-75 gap-0 p-0 max-w-[85vw] bg-surface-muted"
          >
            <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
            <div className="h-12 px-2 flex shrink-0 items-center border-b border-border">
              <WorkspaceMenu
                workspaces={workspaces}
                current={workspace}
                userEmail={user.email}
                onToggleSidebar={closeSidebar}
              />
            </div>
            <div className="min-h-0 flex flex-1 flex-col">{channelNav}</div>
          </SheetContent>
        </Sheet>

        <Sheet
          open={isMobile && rightPanelOpen}
          onOpenChange={setRightPanelOpen}
        >
          <SheetContent
            side="right"
            hideCloseButton
            className="w-85 gap-0 p-0 max-w-[90vw] bg-surface-muted"
          >
            <SheetTitle className="sr-only">Side panel</SheetTitle>
            <RightPanel
              currentUser={user}
              workspaceSlug={slug}
              onClose={closeAssistant}
            />
          </SheetContent>
        </Sheet>

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

        <CreateChannelDialog
          open={createChannelOpen}
          onOpenChange={setCreateChannelOpen}
        />

        <ManageAccountsDialog
          open={isManageAccountsOpen}
          onOpenChange={setManageAccountsOpen}
          workspaces={workspaces}
          currentWorkspace={workspace}
          userEmail={user.email}
          onAddAccount={() => setAddAccountOpen(true)}
        />

        <AddAccountDialog
          open={isAddAccountOpen}
          onOpenChange={setAddAccountOpen}
        />

        <InviteMembersDialog
          open={isInviteMembersOpen}
          onOpenChange={setInviteMembersOpen}
          workspaceId={inviteTargetWorkspace?.id || workspaceId}
          workspaceName={inviteTargetWorkspace?.name || workspace.name}
          workspaceSlug={inviteTargetWorkspace?.slug || slug}
        />

        {/*
          `@org/ui` is presentational and cannot call the API itself, so the
          shell supplies the two status operations both surfaces share.
        */}
        <FocusModeWidget
          currentUser={user}
          onUserUpdated={setUser}
          onSaveStatus={userApi.updateStatus}
          onClearStatus={userApi.clearStatus}
        />
        <StatusModal
          currentUser={user}
          onUserUpdated={setUser}
          onSaveStatus={userApi.updateStatus}
          onClearStatus={userApi.clearStatus}
        />
        <TeamWorldClockModal
          currentUser={user}
          members={membersQuery.data ?? []}
        />
      </div>
    </TooltipProvider>
  );
}

import { useCurrentUser } from '@org/auth';
import { layout } from '@org/design-system';
import {
  Button,
  CommandPalette,
  EmptyState,
  ErrorBoundary,
  LoadingState,
  TooltipProvider,
  useCommandPalette,
} from '@org/ui';
import { cn } from '@org/utils';
import { useChannels } from '@org/web-channels';
import { useCurrentWorkspace, useWorkspaces } from '@org/web-workspace';
import { Building2, MessageSquarePlus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from './app-header.js';
import { ChannelNav } from './channel-nav.js';
import { WorkspaceMenu, WorkspaceSwitcher } from './workspace-switcher.js';

/**
 * Desktop-first three-column shell: workspace rail, channel sidebar, content.
 *
 * The right panel is reserved for future context (channel details, threads);
 * it renders behind a toggle so the layout is already in place.
 */
export function AppShell() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const palette = useCommandPalette();
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const workspacesQuery = useWorkspaces();
  const { slug, workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const channelsQuery = useChannels(workspaceId);

  if (!user) return <LoadingState fullPage />;

  // Signed in but with no workspace yet — send them to onboarding.
  if (workspacesQuery.isSuccess && workspacesQuery.data.length === 0) {
    return (
      <div className="p-6 grid min-h-dvh place-items-center">
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
      <div className="p-6 grid min-h-dvh place-items-center">
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh overflow-hidden">
        <WorkspaceSwitcher
          workspaces={workspacesQuery.data ?? []}
          current={workspace}
        />

        <aside
          className="flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
          style={{ width: layout.sidebarWidth }}
          aria-label="Channels"
        >
          <div className="group px-2 py-2.5 border-b border-sidebar-border">
            <WorkspaceMenu
              workspaces={workspacesQuery.data ?? []}
              current={workspace}
            />
          </div>

          <ChannelNav
            workspaceId={workspaceId}
            workspaceSlug={slug}
            channels={channelsQuery.data}
            isLoading={channelsQuery.isLoading}
            onCreateChannel={() => navigate(`/w/${slug}/channels/new`)}
            onBrowseChannels={() => navigate(`/w/${slug}/channels`)}
          />
        </aside>

        <div className="min-w-0 flex flex-1 flex-col">
          <AppHeader
            user={user}
            workspaceSlug={slug}
            title={workspace.name}
            subtitle={`${workspace.memberCount} members · ${workspace.channelCount} channels`}
            onOpenSearch={() => palette.setOpen(true)}
            onToggleRightPanel={() => setRightPanelOpen((value) => !value)}
            rightPanelOpen={rightPanelOpen}
          />

          <div className="min-h-0 flex flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto">
              {/*
                Keyed on pathname so a render error on one route does not leave
                the boundary stuck when the user navigates elsewhere.
              */}
              <ErrorBoundary resetKeys={[location.pathname]}>
                <Suspense fallback={<LoadingState fullPage />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </main>

            <aside
              className={cn(
                'shrink-0 overflow-y-auto border-l bg-background transition-all duration-200',
                rightPanelOpen ? 'w-80' : 'w-0 overflow-hidden border-l-0',
              )}
              aria-label="Details"
              aria-hidden={!rightPanelOpen}
            >
              {rightPanelOpen ? (
                <div className="p-4">
                  <EmptyState
                    size="sm"
                    icon={<MessageSquarePlus />}
                    title="Nothing selected"
                    description="Channel details, threads and activity will appear here."
                  />
                </div>
              ) : null}
            </aside>
          </div>
        </div>

        <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      </div>
    </TooltipProvider>
  );
}

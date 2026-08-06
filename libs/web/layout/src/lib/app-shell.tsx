import { useCurrentUser } from '@org/auth';
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
import { Building2, MessageSquarePlus, Sparkles } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AISidebar } from '@org/web-ai';
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
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

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
      <div className="flex h-dvh overflow-hidden bg-[#09090B] text-[#FAFAFA]">
        <WorkspaceSwitcher
          workspaces={workspacesQuery.data ?? []}
          current={workspace}
        />

        <aside
          className="flex shrink-0 flex-col border-r border-[#27272A] bg-[#09090B] w-[240px]"
          aria-label="Channels"
        >
          <div className="group px-2 py-2 border-b border-[#27272A]">
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

        <div className="min-w-0 flex flex-1 flex-col bg-[#09090B]">
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
            <main className="min-w-0 flex-1 overflow-y-auto bg-[#09090B] p-4 lg:p-6">
              <div className="max-w-[1600px] w-full mr-auto">
                <ErrorBoundary resetKeys={[location.pathname]}>
                  <Suspense fallback={<LoadingState fullPage />}>
                    <Outlet />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </main>

            <aside
              className={cn(
                'shrink-0 overflow-y-auto border-l border-[#27272A] bg-[#111113] transition-all duration-[180ms] ease-out',
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

        <Button
          onClick={() => setAiSidebarOpen(true)}
          size="sm"
          className="right-6 bottom-6 px-3.5 h-[34px] fixed z-(--z-rail) rounded-[8px] bg-[#6E56CF] text-[#FAFAFA] hover:bg-[#7C6AF5] shadow-[0_4px_18px_rgba(0,0,0,0.18)]"
          leadingIcon={<Sparkles className="size-4" />}
          aria-haspopup="dialog"
          aria-expanded={aiSidebarOpen}
        >
          Linear AI
        </Button>

        <AISidebar
          isOpen={aiSidebarOpen}
          onClose={() => setAiSidebarOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}

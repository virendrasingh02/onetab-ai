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
import {
  ArrowUp,
  Building2,
  ChevronDown,
  Clock,
  History,
  Info,
  Mic,
  MoreVertical,
  Sparkles,
  X,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AISidebar } from '@org/web-ai';
import { AppHeader } from './app-header.js';
import { ChannelNav } from './channel-nav.js';
import { WorkspaceMenu } from './workspace-switcher.js';

export function AppShell() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const palette = useCommandPalette();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');

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

  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans">
        {/* Column 1: Left Navigation Sidebar */}
        <aside
          className={cn(
            'flex shrink-0 flex-col border-r border-zinc-200/80 dark:border-zinc-800 bg-[#F9FAFB] dark:bg-[#09090B] transition-all duration-200 ease-in-out',
            sidebarOpen ? 'w-[250px]' : 'w-0 border-r-0 overflow-hidden',
          )}
          aria-label="Sidebar navigation"
        >
          <div className="px-2 py-2 border-b border-zinc-200/80 dark:border-zinc-800">
            <WorkspaceMenu
              workspaces={workspacesQuery.data ?? []}
              current={workspace}
              onToggleSidebar={() => setSidebarOpen(false)}
            />
          </div>

          <div className="min-h-0 flex-1 flex flex-col">
            <ChannelNav
              workspaceId={workspaceId}
              workspaceSlug={slug}
              channels={channelsQuery.data}
              isLoading={channelsQuery.isLoading}
              onCreateChannel={() => navigate(`/w/${slug}/channels/new`)}
              onBrowseChannels={() => navigate(`/w/${slug}/channels`)}
              onOpenSearch={() => palette.setOpen(true)}
            />
          </div>
        </aside>

        {/* Column 2: Center Main Content Area */}
        <div className="min-w-0 flex flex-1 flex-col bg-white dark:bg-[#09090B]">
          <AppHeader
            user={user}
            workspaceSlug={slug}
            title={workspace.name}
            subtitle={`${workspace.memberCount} members · ${workspace.channelCount} channels`}
            onOpenSearch={() => palette.setOpen(true)}
            onToggleRightPanel={() => setRightPanelOpen((value) => !value)}
            rightPanelOpen={rightPanelOpen}
            onToggleSidebar={() => setSidebarOpen((val) => !val)}
            sidebarOpen={sidebarOpen}
          />

          <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-[#09090B] p-4 lg:p-6">
            <div className="max-w-[1600px] w-full mr-auto">
              <ErrorBoundary resetKeys={[location.pathname]}>
                <Suspense fallback={<LoadingState fullPage />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {/* Column 3: Right AI Assistant & Chat Panel (Full Screen Height) */}
        <aside
          className={cn(
            'shrink-0 flex flex-col h-full border-l border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#09090B] transition-all duration-200 ease-in-out',
            rightPanelOpen ? 'w-80 lg:w-[350px]' : 'w-0 overflow-hidden border-l-0',
          )}
          aria-label="AI Chat Panel"
          aria-hidden={!rightPanelOpen}
        >
          {rightPanelOpen ? (
            <div className="flex flex-col h-full justify-between">
              {/* Right Panel Header Aligned Top */}
              <div className="h-[48px] px-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Untitled chat
                </span>
                <div className="flex items-center gap-1 text-zinc-400">
                  <button className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md transition-colors">
                    <History className="size-4" />
                  </button>
                  <button className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md transition-colors">
                    <MoreVertical className="size-4" />
                  </button>
                  <button
                    onClick={() => setRightPanelOpen(false)}
                    className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Chat Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Clock className="size-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">Recent chat - Adjust workspace research step parameters</span>
                </div>
              </div>

              {/* Right Panel Bottom Chat Input */}
              <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800 shrink-0">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-xs space-y-2">
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Ask anything..."
                    rows={2}
                    className="w-full text-xs bg-transparent border-none outline-none resize-none placeholder-zinc-400 text-zinc-800 dark:text-zinc-200"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <button className="px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center gap-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                      <span>Auto</span>
                      <ChevronDown className="size-3 text-zinc-400" />
                    </button>

                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <button className="p-1 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <Info className="size-3.5" />
                      </button>
                      <button className="p-1 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <Mic className="size-3.5" />
                      </button>
                      <button className="size-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-2xs">
                        <ArrowUp className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />

        <Button
          onClick={() => setAiSidebarOpen(true)}
          size="sm"
          className="right-6 bottom-6 px-3.5 h-[34px] fixed z-(--z-rail) rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-transform hover:scale-105"
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



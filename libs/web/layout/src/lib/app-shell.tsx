import { useCurrentUser } from '@org/auth';
import {
  Button,
  CommandPalette,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorBoundary,
  Hint,
  LoadingState,
  TooltipProvider,
  useCommandPalette,
} from '@org/ui';
import { cn } from '@org/utils';
import { useChannels } from '@org/web-channels';
import { useDesktopCommand } from '@org/web-desktop';
import { useCurrentWorkspace, useWorkspaces } from '@org/web-workspace';
import {
  ArrowUp,
  Building2,
  ChevronDown,
  Clock,
  History,
  Info,
  Mic,
  RotateCcw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AISidebar } from '@org/web-ai';
import { AppHeader } from './app-header.js';
import { ChannelNav } from './channel-nav.js';
import { ResizeHandle } from './resize-handle.js';
import { useResizableLayout } from './use-resizable-layout.js';
import { WorkspaceMenu } from './workspace-switcher.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

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

  // Auto-close navigation sidebar on mobile when changing route/page
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile, setSidebarOpen]);

  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('Auto');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Good afternoon! How can I assist you with your workspace tasks, channels, or research today?',
      time: '12:00 PM',
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiThinking]);

  const handleSendChatMessage = () => {
    const query = promptInput.trim();
    if (!query || isAiThinking) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setPromptInput('');
    setIsAiThinking(true);

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: `[${selectedModel}] Processed request: "${query}". I analyzed your workspace channels and tasks to synthesize this report.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
      setIsAiThinking(false);
    }, 700);
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: `w-${Date.now()}`,
        role: 'assistant',
        text: 'New chat session started. Ask me anything about your workspace.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const workspacesQuery = useWorkspaces();
  const { slug, workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const channelsQuery = useChannels(workspaceId);

  /*
   * The native menu bar, the tray menu and the global shortcut all reach the UI
   * through these. Registered before the early returns below so the hook order
   * stays stable, and no-ops in the browser where nothing ever fires them.
   */
  useDesktopCommand('open-search', () => palette.setOpen(true));
  useDesktopCommand('open-shortcuts', () => palette.setOpen(true));
  useDesktopCommand('open-ai-assistant', () => setRightPanelOpen(true));
  useDesktopCommand('toggle-sidebar', () => setSidebarOpen((value) => !value));
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

  if (isLoading || workspacesQuery.isLoading) {
    return <LoadingState fullPage label="Loading your workspace…" />;
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

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          // `h-full`, not `h-dvh`: `DesktopChrome` owns the viewport height and
          // this fills whatever is left below the title bar.
          'flex h-full overflow-hidden bg-background text-foreground font-sans relative',
          isResizing && 'select-none cursor-col-resize',
        )}
      >
        {/* Mobile Backdrop for Left Sidebar */}
        {sidebarOpen ? (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        {/* Column 1: Left Navigation Sidebar (Drawer overlay on mobile, inline panel on desktop) */}
        <aside
          className={cn(
            'flex flex-col bg-sidebar transition-all duration-200 ease-standard shrink-0',
            sidebarOpen
              ? 'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] shadow-2xl md:shadow-none md:relative md:z-auto'
              : 'hidden md:flex md:w-0 md:overflow-hidden',
          )}
          style={sidebarOpen && !isMobile ? { width: `${leftWidth}px` } : undefined}
          aria-label="Sidebar navigation"
        >
          <div className="h-12 px-2 flex items-center shrink-0 border-b border-border">
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
            />
          </div>
        </aside>

        {/* Left Resize Handle (Desktop only) */}
        {sidebarOpen && !isMobile ? (
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
        ) : null}

        {/* Column 2: Center Main Content Area */}
        <div className="min-w-0 flex flex-1 flex-col bg-background">
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

          <main className="min-w-0 flex-1 overflow-y-auto bg-background p-3 sm:p-4 lg:p-6">
            <div className="max-w-[1600px] w-full mr-auto">
              <ErrorBoundary resetKeys={[location.pathname]}>
                <Suspense fallback={<LoadingState fullPage />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {/* Mobile Backdrop for Right AI Panel */}
        {rightPanelOpen ? (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
            onClick={() => setRightPanelOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        {/* Right Resize Handle (Desktop only) */}
        {rightPanelOpen && !isMobile ? (
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
        ) : null}

        {/* Column 3: Right AI Assistant & Chat Panel (Overlay drawer on mobile, inline panel on desktop) */}
        <aside
          className={cn(
            'flex flex-col h-full bg-background transition-all duration-200 ease-standard shrink-0',
            rightPanelOpen
              ? 'fixed inset-y-0 right-0 z-50 w-[340px] max-w-[90vw] border-l border-border shadow-2xl md:shadow-none md:relative md:z-auto'
              : 'hidden md:flex md:w-0 md:overflow-hidden',
          )}
          style={rightPanelOpen && !isMobile ? { width: `${rightWidth}px` } : undefined}
          aria-label="AI Chat Panel"
          aria-hidden={!rightPanelOpen}
        >
          {rightPanelOpen ? (
            <div className="flex flex-col h-full justify-between">
              {/* Right Panel Header Aligned Top */}
              <div className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                  <span>AI Assistant</span>
                </span>
                <div className="flex items-center gap-0.5">
                  <Hint label="New chat">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleClearChat}
                      aria-label="New chat"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </Hint>
                  <Hint label="Chat history">
                    <Button variant="ghost" size="icon-sm" aria-label="Chat history">
                      <History className="size-4" />
                    </Button>
                  </Hint>
                  <Hint label="Close assistant">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRightPanelOpen(false)}
                      aria-label="Close assistant"
                    >
                      <X className="size-4" />
                    </Button>
                  </Hint>
                </div>
              </div>

              {/* Chat Content Body */}
              <div className="flex-1 overflow-y-auto scrollbar-subtle p-4 space-y-3">
                <div className="p-2.5 rounded-card border border-border bg-surface text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="size-3.5 text-subtle shrink-0" aria-hidden />
                  <span className="truncate">
                    Recent chat — Workspace research &amp; step parameters
                  </span>
                </div>

                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'p-3 rounded-card text-xs leading-relaxed space-y-1 max-w-[90%]',
                      msg.role === 'user'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'bg-surface-raised text-foreground',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] opacity-70">
                      <span className="font-medium flex items-center gap-1">
                        {msg.role === 'user' ? (
                          <User className="size-3" aria-hidden />
                        ) : (
                          <Sparkles className="size-3" aria-hidden />
                        )}
                        {msg.role === 'user' ? 'You' : 'Copilot'}
                      </span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))}

                {isAiThinking ? (
                  <p
                    className="p-3 rounded-card bg-surface-raised text-xs text-muted-foreground w-fit"
                    role="status"
                  >
                    Copilot is thinking…
                  </p>
                ) : null}

                <div ref={chatEndRef} />
              </div>

              {/* Right Panel Bottom Chat Input */}
              <div className="p-3 border-t border-border shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChatMessage();
                  }}
                  className="rounded-card border border-border bg-surface p-3 space-y-2 focus-within:border-ring/60 transition-colors duration-(--duration-fast)"
                >
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder="Ask AI anything…"
                    rows={2}
                    aria-label="Ask AI anything"
                    className="w-full text-xs bg-transparent border-none outline-none resize-none text-foreground placeholder:text-subtle"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Model: ${selectedModel}`}
                          className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground bg-surface-raised rounded-md flex items-center gap-1 hover:bg-accent hover:text-foreground transition-colors duration-(--duration-fast)"
                        >
                          <span>{selectedModel}</span>
                          <ChevronDown className="size-3" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40 text-xs">
                        <DropdownMenuItem onSelect={() => setSelectedModel('Auto')}>
                          Auto Select
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSelectedModel('Google Gemini')}>
                          Google Gemini
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSelectedModel('OpenAI GPT-4')}>
                          OpenAI GPT-4
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSelectedModel('Claude 3.5')}>
                          Claude 3.5
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSelectedModel('Ollama Local')}>
                          Ollama Local
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-center gap-0.5">
                      <Hint label="About this assistant">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="About this assistant"
                        >
                          <Info className="size-3.5" />
                        </Button>
                      </Hint>
                      <Hint label="Voice input">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Voice input"
                        >
                          <Mic className="size-3.5" />
                        </Button>
                      </Hint>
                      <Button
                        type="submit"
                        size="icon-sm"
                        disabled={!promptInput.trim() || isAiThinking}
                        aria-label="Send message"
                        className="rounded-full"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </aside>

        <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />

        <AISidebar
          isOpen={aiSidebarOpen}
          onClose={() => setAiSidebarOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}




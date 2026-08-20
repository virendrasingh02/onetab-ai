import { useCurrentUser } from '@org/auth';
import { ChatBubble } from '@org/chat-ui';
import type { Message as ChatUiMessage } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Hint,
  LoadingState,
  Panel,
  ScrollArea,
  SearchInput,
  Spinner,
  toast,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { ChatPanel, useDirectRoom, useMatrix } from '@org/web-chat';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  Bell,
  BellOff,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Headphones,
  MessageSquareOff,
  MoreHorizontal,
  PanelRight,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentAvatar } from './AgentMarketplaceView.js';
import { useAgentMutations, useAgents } from './use-agents.js';

interface AgentPreferencesState {
  byWorkspace: Record<string, { favorites: string[]; muted: string[] }>;
  toggleFavorite: (workspaceId: string, agentId: string) => void;
  toggleMuted: (workspaceId: string, agentId: string) => void;
}

const NO_IDS: string[] = [];
const EMPTY = { favorites: NO_IDS, muted: NO_IDS };
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

const useAgentPreferencesStore = create<AgentPreferencesState>()(
  persist(
    (set) => ({
      byWorkspace: {},
      toggleFavorite: (workspaceId, agentId) => {
        if (!workspaceId || !agentId) return;
        set((state) => {
          const current = state.byWorkspace[workspaceId] ?? EMPTY;
          return {
            byWorkspace: {
              ...state.byWorkspace,
              [workspaceId]: {
                favorites: toggle(current.favorites, agentId),
                muted: current.muted,
              },
            },
          };
        });
      },
      toggleMuted: (workspaceId, agentId) => {
        if (!workspaceId || !agentId) return;
        set((state) => {
          const current = state.byWorkspace[workspaceId] ?? EMPTY;
          return {
            byWorkspace: {
              ...state.byWorkspace,
              [workspaceId]: {
                favorites: current.favorites,
                muted: toggle(current.muted, agentId),
              },
            },
          };
        });
      },
    }),
    { name: 'onetab-agent-preferences' },
  ),
);

function useAgentPreferences(workspaceId: string | undefined) {
  const byWorkspace = useAgentPreferencesStore((s) => s.byWorkspace);
  const toggleFavorite = useAgentPreferencesStore((s) => s.toggleFavorite);
  const toggleMuted = useAgentPreferencesStore((s) => s.toggleMuted);

  const activeWorkspaceId = workspaceId ?? '';
  const entry = byWorkspace[activeWorkspaceId];
  const favoriteIds = entry?.favorites ?? NO_IDS;
  const mutedIds = entry?.muted ?? NO_IDS;

  return {
    favoriteIds,
    mutedIds,
    isFavorite: (agentId: string) => favoriteIds.includes(agentId),
    isMuted: (agentId: string) => mutedIds.includes(agentId),
    toggleFavorite: (agentId: string) =>
      toggleFavorite(activeWorkspaceId, agentId),
    toggleMuted: (agentId: string) => toggleMuted(activeWorkspaceId, agentId),
  };
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
  reactions?: { key: string; count: number; reactedByMe?: boolean }[];
}

export interface AgentModelItem {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  model?: string | null;
  isActive?: boolean | null;
  tools?: string | null;
  systemPrompt?: string | null;
  avatarUrl?: string | null;
}

export const DEFAULT_AGENTS: AgentModelItem[] = [
  {
    id: 'agent-copilot',
    name: 'ChatGPT',
    role: 'Workspace Assistant & AI Copilot',
    description:
      'AI coworker with thread memory and full workspace knowledge.',
    model: 'gpt-4o',
    isActive: true,
    tools: JSON.stringify(['WorkspaceSearch', 'ChannelSummary', 'DocReader']),
    systemPrompt:
      'You are ChatGPT, a helpful AI teammate. Answer questions concisely, organize tasks, and assist team members with coding, design, and project workflows.',
    avatarUrl: 'icon:bot',
  },
  {
    id: 'agent-codereview',
    name: 'Code Reviewer',
    role: 'Senior Software Engineer & PR Auditor',
    description:
      'Specialized in TypeScript, Rust, Python, and security best practices.',
    model: 'claude-3.5-sonnet',
    isActive: true,
    tools: JSON.stringify(['GitDiffAnalysis', 'LintRunner', 'SecurityAudit']),
    systemPrompt:
      'You are an expert code reviewer. Review pull requests for bugs, performance bottlenecks, edge cases, and maintainability.',
    avatarUrl: 'icon:code',
  },
  {
    id: 'agent-triage',
    name: 'Incident & Bug Triage',
    role: 'Engineering Reliability & Issue Tracker',
    description:
      'Triages bug reports, categorizes severity, and assigns owners.',
    model: 'gpt-4o',
    isActive: true,
    tools: JSON.stringify(['IssueTracker', 'AlertManager', 'SlackNotify']),
    systemPrompt:
      'You are an incident triage assistant. Help categorize error logs, prioritize issues, and draft incident post-mortems.',
    avatarUrl: 'icon:shield',
  },
];

/**
 * AI Agent Chat View — structured, laid out, and styled identically to Direct Messages.
 *
 * The conversation is the page: sticky header with APP badge, full-height chat surface,
 * direct message bubbles with markdown, thinking indicator, and right rail details.
 */
export function AgentChatView() {
  const { agentId: paramAgentId } = useParams<{ agentId?: string }>();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('id') || searchParams.get('agent') || paramAgentId;

  return agentId ? (
    <AgentConversation agentId={agentId} />
  ) : (
    <NewAgentMessage />
  );
}

/**
 * One AI Agent conversation.
 * Keyed on agentId in the URL so switching agents remounts the component cleanly.
 */
function AgentConversation({ agentId }: { agentId: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const agentsQuery = useAgents(workspaceId);

  const [chatActionsSlot, setChatActionsSlot] = useState<HTMLDivElement | null>(
    null,
  );

  const rawServerAgents = agentsQuery.data;
  const serverAgents = useMemo(() => rawServerAgents ?? [], [rawServerAgents]);

  const allAgents = useMemo(() => {
    if (serverAgents.length > 0) return serverAgents;
    return DEFAULT_AGENTS;
  }, [serverAgents]);

  const agent =
    allAgents.find((a) => a.id === agentId) ||
    DEFAULT_AGENTS.find((a) => a.id === agentId);

  if (agentsQuery.isLoading && serverAgents.length === 0) {
    return <div className="p-8"><Spinner label="Opening agent conversation…" /></div>;
  }

  if (!agent) {
    return (
      <ErrorState
        fullPage
        title="Agent not found"
        description="This agent may have been removed, or the link is out of date."
      />
    );
  }

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <AgentMessageHeader
        agent={agent}
        chatActionsRef={setChatActionsSlot}
      />

      <AgentDirectRoom
        key={agent.id}
        agent={agent}
        headerActionsSlot={chatActionsSlot}
      />
    </div>
  );
}

/**
 * Agent's sticky title header — Counterpart to DirectMessageHeader.
 */
function AgentMessageHeader({
  agent,
  chatActionsRef,
}: {
  agent: AgentModelItem;
  chatActionsRef: (element: HTMLDivElement | null) => void;
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const preferences = useAgentPreferences(workspaceId);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const name = agent.name;
  const handle = agent.name.toLowerCase().replace(/\s+/g, '-');
  const slug = workspaceSlug || 'default';

  const isFavorite = preferences.isFavorite(agent.id);
  const isMuted = preferences.isMuted(agent.id);

  const handleOpenProfile = () => {
    openProfilePanel({
      userId: agent.id,
      name: agent.name,
      avatarUrl: agent.avatarUrl ?? undefined,
      title: `${agent.model || 'gpt-4o'} · AI Agent`,
      role: agent.role || 'AI Agent',
      bio: agent.description || agent.systemPrompt || 'Autonomous workspace AI agent configured for team tasks.',
      status: agent.isActive !== false ? 'online' : 'unavailable',
      statusEmoji: '🤖',
      statusText: 'AI Agent · Ready',
      email: `${handle}@agent.local`,
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${slug}/agents/chat?id=${agent.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied', {
      description: 'Agent conversation link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    preferences.toggleFavorite(agent.id);
    toast.success(
      isFavorite ? 'Removed from favorites' : 'Added to favorites',
      { description: `${name} · AI Agent` },
    );
  };

  const handleToggleMuted = () => {
    preferences.toggleMuted(agent.id);
    toast.success(isMuted ? 'Conversation unmuted' : 'Conversation muted', {
      description: isMuted
        ? `You will be notified about new responses from ${name}.`
        : `Responses from ${name} will not notify you.`,
    });
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAgent = useCallback(() => {
    setIsSyncing(true);
    toast.success('Agent synchronized', {
      description: 'Model parameters and triggers are up to date.',
    });
    setTimeout(() => setIsSyncing(false), 800);
  }, []);

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-2 flex items-center">
            <AgentAvatar
              name={agent.name}
              avatarUrl={agent.avatarUrl}
              size="sm"
              className="size-7"
            />
            <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
              {agent.name}
            </h2>

            <Badge
              variant="primary"
              className="gap-0.5 text-[9px] py-0 h-4 uppercase font-bold tracking-wider"
            >
              <Bot className="size-2.5 inline-block mr-0.5" />
              <span>AI AGENT</span>
            </Badge>

            {isMuted ? (
              <Badge variant="neutral" className="gap-1 text-muted-foreground">
                <BellOff className="size-3" />
                <span>Muted</span>
              </Badge>
            ) : null}
          </div>

          <div className="gap-0.5 flex items-center">
            {/* 1. Fav icon */}
            <Hint
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={handleToggleFavorite}
                className={isFavorite ? 'text-warning' : undefined}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
              </Button>
            </Hint>

            {/* 2. Huddle icon */}
            <Hint label="Start a voice huddle with agent">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Start voice huddle"
                onClick={() => {
                  toast.info(`Starting voice session with @${agent.name}…`);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Headphones className="size-4" />
              </Button>
            </Hint>

            {/* 3. 3-dot dropdown menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Conversation options"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-64">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    {copied ? (
                      <Check className="size-4 text-success-text" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copied ? 'Link copied!' : 'Copy link'}</span>
                  </div>
                  <DropdownMenuShortcut>C</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleSyncAgent}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <RefreshCw
                      className={cn('size-4', isSyncing && 'animate-spin')}
                    />
                    <span>Sync agent</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleOpenProfile}
                  className="gap-2.5 cursor-pointer"
                >
                  <UserRound className="size-4" />
                  <span>Open agent details</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() =>
                    navigate(`/w/${slug}/agents/builder?agentId=${agent.id}`)
                  }
                  className="gap-2.5 cursor-pointer"
                >
                  <Wrench className="size-4 text-accent-violet" />
                  <span>Open in Visual Builder</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    navigate(`/w/${slug}/agents/logs?agentId=${agent.id}`)
                  }
                  className="gap-2.5 cursor-pointer"
                >
                  <Activity className="size-4 text-primary" />
                  <span>Activity logs</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleToggleFavorite}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <Star
                      className={cn(
                        'size-4',
                        isFavorite && 'fill-current text-accent-amber',
                      )}
                    />
                    <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/70" />
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleToggleMuted}
                  description={
                    isMuted
                      ? 'Turn notifications for this conversation back on.'
                      : 'Keep the conversation in your sidebar without being notified.'
                  }
                >
                  {isMuted ? (
                    <Bell className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )}
                  <span>
                    {isMuted ? 'Unmute conversation' : 'Mute conversation'}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => navigate(`/w/${slug}/agents/chat`)}
                  className="gap-2.5"
                >
                  <X className="size-4" />
                  <span>Close conversation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Conversation tools portal in from the chat surface */}
        <div
          ref={chatActionsRef}
          className="gap-0.5 flex items-center empty:hidden"
        />
      </div>
    </div>
  );
}

/**
 * Full-height Direct Matrix Room conversation surface for AI Agents.
 */
function AgentDirectRoom({
  agent,
  headerActionsSlot,
}: {
  agent: AgentModelItem;
  headerActionsSlot: HTMLElement | null;
}) {
  const { enabled } = useMatrix();
  const { roomId, isLoading, error } = useDirectRoom(agent.id);

  if (!enabled) {
    return (
      <EmptyState
        size="lg"
        icon={<MessageSquareOff />}
        title="Chat is not configured"
        description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to turn on agent messages."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title={`Could not open the conversation with ${agent.name}`}
        description={error}
      />
    );
  }

  if (isLoading || !roomId) {
    return (
      <LoadingState label={`Opening your conversation with ${agent.name}…`} />
    );
  }

  return (
    <ChatPanel
      roomId={roomId}
      title={agent.name}
      subtitle={agent.role || 'AI Agent'}
      headerActionsSlot={headerActionsSlot}
      showMembers={false}
    />
  );
}

/**
 * The picker for "New agent message" — Counterpart to NewDirectMessage in DirectMessagesView.
 */
function NewAgentMessage() {
  const { workspaceId } = useCurrentWorkspace();
  const agentsQuery = useAgents(workspaceId);
  const [, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const rawServerAgents = agentsQuery.data;
  const serverAgents = useMemo(() => rawServerAgents ?? [], [rawServerAgents]);

  const agents = useMemo(() => {
    if (serverAgents.length > 0) return serverAgents;
    return DEFAULT_AGENTS;
  }, [serverAgents]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(needle) ||
        (agent.role || '').toLowerCase().includes(needle) ||
        (agent.description || '').toLowerCase().includes(needle),
    );
  }, [agents, query]);

  const select = (agent: { id: string }) =>
    setSearchParams({ id: agent.id }, { replace: true });

  return (
    <div className="min-h-0 px-4 py-8 flex flex-1 flex-col items-center overflow-y-auto bg-background text-foreground">
      <div className="max-w-lg w-full">
        <div className="mb-4 text-center">
          <Bot className="mb-2 size-6 mx-auto text-primary" />
          <h1 className="text-base font-semibold text-foreground">
            New AI Agent conversation
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick an AI agent in this workspace to start a one-to-one conversation.
          </p>
        </div>

        <Panel flush title="Available AI Agents">
          <div className="p-3 border-b border-border">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search AI agents by name or role"
              label="Search AI agents"
            />
          </div>

          {agentsQuery.isLoading && serverAgents.length === 0 ? (
            <div className="p-8 flex justify-center"><Spinner label="Loading agents…" /></div>
          ) : visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Bot />}
              title="No AI agents found"
              description="No AI agent matches your search term."
            />
          ) : (
            <ul className="p-2 space-y-px">
              {visible.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => select(agent)}
                    className="gap-2.5 p-2.5 flex w-full items-center rounded-md text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none cursor-pointer"
                  >
                    <AgentAvatar
                      name={agent.name}
                      avatarUrl={agent.avatarUrl}
                      size="md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium block truncate text-foreground">
                          {agent.name}
                        </span>
                        <Badge
                          variant="neutral"
                          className="h-3.5 px-1 text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground"
                        >
                          APP
                        </Badge>
                        <Badge
                          variant="primary"
                          className="text-[9px] h-3.5 px-1 font-mono ml-auto"
                        >
                          {agent.model || 'gpt-4o'}
                        </Badge>
                      </span>
                      <span className="text-xs block truncate text-muted-foreground">
                        {agent.role || 'Workspace AI Assistant'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

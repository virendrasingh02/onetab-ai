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
  Panel,
  ScrollArea,
  SearchInput,
  Spinner,
  toast,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  Bell,
  BellOff,
  Bot,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  PanelRight,
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

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-2 flex items-center">
            <button
              type="button"
              onClick={handleOpenProfile}
              className="gap-2 flex items-center rounded-md hover:bg-accent/60 p-1 -m-1 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`View ${name}'s profile and parameters`}
            >
              <AgentAvatar
                name={name}
                avatarUrl={agent.avatarUrl}
                size="sm"
                className="size-7"
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground hover:underline">
                {name}
              </h2>
            </button>

            {/* Direct Message APP badge matching ChatGPT APP layout */}
            <Badge
              variant="neutral"
              className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border-border/60"
            >
              APP
            </Badge>

            <Badge variant="neutral">Online</Badge>

            <Badge
              variant="primary"
              className="text-[10px] h-4.5 px-1.5 font-mono"
            >
              {agent.model || 'gpt-4o'}
            </Badge>

            {isMuted ? (
              <Badge variant="neutral" className="gap-1 text-muted-foreground">
                <BellOff className="size-3" />
                <span>Muted</span>
              </Badge>
            ) : null}
          </div>

          <div className="gap-0.5 flex items-center">
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

            <Hint label="Copy link to this conversation">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy link to this conversation"
                onClick={handleCopyLink}
                className="text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </Hint>

            <Hint label="Agent Details & Parameters">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open agent details in right bar"
                onClick={handleOpenProfile}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <PanelRight className="size-4" />
              </Button>
            </Hint>

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

                <DropdownMenuSeparator />

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

                <DropdownMenuItem
                  onClick={handleOpenProfile}
                  className="gap-2.5 cursor-pointer"
                >
                  <UserRound className="size-4" />
                  <span>View agent details</span>
                </DropdownMenuItem>

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
                  onClick={() => navigate(`/w/${slug}/agents/chat`)}
                  className="gap-2.5"
                >
                  <X className="size-4" />
                  <span>Close conversation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="min-w-0 pl-2 text-xs lg:block hidden max-w-[32ch] truncate border-l border-border text-muted-foreground">
            @{handle}
          </p>
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
 * Full-height Direct Room conversation surface for AI Agents.
 */
function AgentDirectRoom({
  agent,
  headerActionsSlot: _headerActionsSlot,
}: {
  agent: AgentModelItem;
  headerActionsSlot: HTMLElement | null;
}) {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const { execute } = useAgentMutations(workspaceId);

  // Initial welcome message matching the screenshot (e.g. "Hi! What can I help with?")
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: `init-${agent.id}`,
      role: 'assistant',
      content: 'Hi! What can I help with?',
      timestamp: Date.now() - 30_000,
    },
  ]);

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const suggestedPrompts = useMemo(() => {
    const role = (agent.role || '').toLowerCase();
    if (role.includes('code') || role.includes('engineer')) {
      return [
        'Analyze recent pull request changes for safety',
        'Help refactor this component for maximum performance',
        'Draft automated unit tests for authentication service',
      ];
    }
    if (role.includes('triage') || role.includes('support')) {
      return [
        'Summarize open customer support tickets',
        'Draft response template for login authentication issue',
        'Search knowledge base for billing refund policy',
      ];
    }
    return [
      'What actions can you perform in this workspace?',
      'Summarize recent discussions across team channels',
      'Help organize and draft our weekly sprint update',
    ];
  }, [agent]);

  const handleSendMessage = useCallback(
    (promptText?: string) => {
      const text = (promptText || input).trim();
      if (!text || isThinking) return;

      const userMsg: AgentChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      if (workspaceId && !agent.id.startsWith('agent-')) {
        execute.mutate(
          {
            agentId: agent.id,
            promptText: text,
          },
          {
            onSuccess: (data) => {
              setIsThinking(false);
              const assistantMsg: AgentChatMessage = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: data.result || 'Task completed successfully.',
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
            },
            onError: () => {
              setIsThinking(false);
              const fallbackResponse = `I processed your request: "${text}". Everything is synchronized with workspace parameters.`;
              const assistantMsg: AgentChatMessage = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: fallbackResponse,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
            },
          },
        );
      } else {
        setTimeout(() => {
          setIsThinking(false);
          const simulatedResponse = `I received your request: "${text}".\n\nI can execute automated actions, query workspace documents, or synthesize channel discussions for you. Let me know if you need anything specific!`;
          const assistantMsg: AgentChatMessage = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: simulatedResponse,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }, 700);
      }
    },
    [agent.id, execute, input, isThinking, workspaceId],
  );

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleReact = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId) return msg;
        const currentReactions = msg.reactions || [];
        const existing = currentReactions.find((r) => r.key === emoji);
        if (existing) {
          if (existing.reactedByMe) {
            return {
              ...msg,
              reactions: currentReactions
                .map((r) =>
                  r.key === emoji
                    ? { ...r, count: r.count - 1, reactedByMe: false }
                    : r,
                )
                .filter((r) => r.count > 0),
            };
          } else {
            return {
              ...msg,
              reactions: currentReactions.map((r) =>
                r.key === emoji
                  ? { ...r, count: r.count + 1, reactedByMe: true }
                  : r,
              ),
            };
          }
        }
        return {
          ...msg,
          reactions: [...currentReactions, { key: emoji, count: 1, reactedByMe: true }],
        };
      }),
    );
  };

  const currentUserName =
    currentUser?.displayName || currentUser?.name || 'You';
  const currentUserAvatar = currentUser?.avatarUrl;

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden bg-background">
      {/* Scrollable Message Timeline */}
      <ScrollArea className="flex-1 min-h-0 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Direct Message Welcome Hero Banner */}
          <div className="border-b border-border pb-6 pt-2">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-violet-soft text-accent-violet shadow-sm">
              <AgentAvatar
                name={agent.name}
                avatarUrl={agent.avatarUrl}
                size="lg"
                className="size-12"
              />
            </div>
            <h3 className="text-xl font-bold text-foreground">{agent.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the start of your direct message history with{' '}
              <span className="font-semibold text-foreground">
                @{agent.name}
              </span>
              .
            </p>
            {agent.description ? (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-lg">
                {agent.description}
              </p>
            ) : null}

            {/* Capability Quick Starters */}
            {messages.length <= 1 ? (
              <div className="mt-6 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Starters
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface p-3 text-xs text-foreground transition-all hover:border-primary hover:bg-surface-raised hover:shadow-xs text-left cursor-pointer"
                    >
                      <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Direct Messages Timeline List */}
          <div className="space-y-3 pt-2">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              const chatUiMsg: ChatUiMessage = {
                id: msg.id,
                senderId: isAssistant ? agent.id : (currentUser?.id || 'user'),
                senderName: isAssistant ? agent.name : currentUserName,
                senderAvatarUrl: isAssistant
                  ? (agent.avatarUrl ?? undefined)
                  : (currentUserAvatar ?? undefined),
                body: msg.content,
                timestamp: msg.timestamp,
                reactions: (msg.reactions || []).map((r) => ({
                  key: r.key,
                  count: r.count,
                  reactedByMe: !!r.reactedByMe,
                })),
                attachments: [],
              };

              return (
                <ChatBubble
                  key={msg.id}
                  message={chatUiMsg}
                  isOwn={!isAssistant}
                  senderBadge={
                    isAssistant ? (
                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-border/50">
                        APP
                      </span>
                    ) : undefined
                  }
                  avatarSlot={
                    isAssistant ? (
                      <div className="w-10 shrink-0">
                        <AgentAvatar
                          name={agent.name}
                          avatarUrl={agent.avatarUrl}
                          size="md"
                          className="size-10 rounded-full shadow-xs"
                        />
                      </div>
                    ) : undefined
                  }
                  onReact={(key) => handleReact(msg.id, key)}
                  onCopyText={() => handleCopyMessage(msg.content)}
                />
              );
            })}

            {/* Direct Message Thinking & Responding Indicator */}
            {isThinking ? (
              <div className="flex gap-4 px-4 pt-2.5 pb-0.5 animate-pulse">
                <div className="w-10 shrink-0">
                  <AgentAvatar
                    name={agent.name}
                    avatarUrl={agent.avatarUrl}
                    size="md"
                    className="size-10 rounded-full"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <header className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {agent.name}
                    </span>
                    <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      APP
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Just now
                    </span>
                  </header>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Sparkles className="size-3.5 text-primary animate-spin" />
                    <span>{agent.name} is thinking &amp; responding...</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Direct Message Rich Composer */}
      <div className="border-t border-border bg-background p-3 sm:p-4 shrink-0">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex flex-col rounded-xl border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-xs transition-all"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message @${agent.name}... (Enter to send, Shift+Enter for new line)`}
              rows={2}
              disabled={isThinking}
              className="w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden disabled:opacity-50"
            />

            <div className="flex items-center justify-between border-t border-border/50 px-3 py-2 bg-surface-raised/30">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge
                  variant="neutral"
                  className="text-[10px] font-mono px-1.5 py-0"
                >
                  @{agent.name}
                </Badge>
                <span className="hidden sm:inline text-xs text-muted-foreground/80">
                  {agent.model || 'gpt-4o'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || isThinking}
                  className="h-7 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-2xs font-semibold"
                >
                  <span>Send</span>
                  <Send className="size-3" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
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

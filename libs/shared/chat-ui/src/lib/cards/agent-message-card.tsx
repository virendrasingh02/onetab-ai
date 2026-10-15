import { generatedFileToMediaItem, useMediaPreview } from '@org/media-preview';
import type {
  AIAgentMessageContent,
  Message,
  RoomMember,
  StructuredMessageAction,
} from '@org/types';
import {
  Badge,
  Button,
  CodeBlock,
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { EntityKindBadge } from '../entity-kind-badge.js';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  HelpCircle,
  ImageIcon,
  Link2,
  Loader2,
  MoreHorizontal,
  Pause,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  SmilePlus,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { UserProfileCard } from '../user-profile-card.js';
import { MarkdownMessage } from '../markdown-message.js';
import { ThreadRepliesButton, ReactionPicker } from '../chat-bubble.js';
import { ReactionBar, reactionAddButtonClass } from '../reaction-bar.js';
import { executeStructuredAction } from './action-handler.js';
import { useAgentAvatar } from './agent-avatar-context.js';
import { useAICardPreferencesStore } from './card-preferences-store.js';
import { CardSettingsDialog } from './card-settings-dialog.js';

export interface AgentMessageCardProps {
  message: Message;
  event: AIAgentMessageContent;
  isOwn?: boolean;
  isHighlighted?: boolean;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
  onRetry?: () => void;
  onOpenThread?: () => void;
  onToggleSave?: () => void;
  isSaved?: boolean;
  /** Same reaction + thread affordances a normal message row has. */
  onReact?: (key: string) => void;
  threadReplyCount?: number;
  threadHasUnread?: boolean;
  threadParticipants?: RoomMember[];
  lastReplyAt?: number;
}

export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null) return '';
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = (durationMs / 1000).toFixed(1);
  return `${seconds}s`;
}

export function AgentMessageCard({
  message,
  event,
  isOwn: _isOwn = false,
  isHighlighted = false,
  onAction,
  onRetry,
  onOpenThread,
  onToggleSave,
  isSaved = false,
  onReact,
  threadReplyCount,
  threadHasUnread,
  threadParticipants,
  lastReplyAt,
}: AgentMessageCardProps) {
  const prefs = useAICardPreferencesStore();
  const { openPreview } = useMediaPreview();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  // Progressive disclosure section states
  const [toolsExpanded, setToolsExpanded] = useState(!prefs.collapseToolCalls);
  const [sourcesExpanded, setSourcesExpanded] = useState(!prefs.collapseSources);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());

  const liveAvatarUrl = useAgentAvatar(event.agentId);
  const avatarSrc =
    liveAvatarUrl || event.agentAvatarUrl || message.senderAvatarUrl;
  const density = prefs.density;
  const isRunning = event.status === 'running' || event.status === 'starting';
  const isPending = isRunning || event.status === 'queued';
  // The bot posts "AI Agent Response" as a body placeholder before any text exists.
  const hasContent = Boolean(event.responseText || event.summary);
  const isFailed = event.status === 'failed';
  const isWaitingApproval = event.status === 'waiting_for_approval';

  const statusConfig = useMemo(() => {
    switch (event.status) {
      case 'queued':
        return {
          label: 'Queued',
          variant: 'neutral' as const,
          icon: <Clock className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
      case 'starting':
        return {
          label: 'Starting',
          variant: 'primary' as const,
          icon: <Loader2 className="size-3 animate-spin text-primary" />,
          color: 'text-primary',
          border: 'border-primary/40',
        };
      case 'running':
        return {
          label: 'Running',
          variant: 'primary' as const,
          icon: <Loader2 className="size-3 animate-spin text-primary" />,
          color: 'text-primary',
          border: 'border-primary shadow-sm shadow-primary/10',
        };
      case 'waiting':
        return {
          label: 'Waiting',
          variant: 'warning' as const,
          icon: <Pause className="size-3 text-warning-text" />,
          color: 'text-warning-text',
          border: 'border-warning/50',
        };
      case 'waiting_for_approval':
        return {
          label: 'Approval Required',
          variant: 'warning' as const,
          icon: <ShieldAlert className="size-3 text-warning-text animate-bounce" />,
          color: 'text-warning-text',
          border: 'border-warning/60 shadow-sm shadow-warning/10',
        };
      case 'completed':
        return {
          label: 'Completed',
          variant: 'success' as const,
          icon: <CheckCircle2 className="size-3 text-success" />,
          color: 'text-success-text',
          border: 'border-border',
        };
      case 'failed':
        return {
          label: 'Failed',
          variant: 'destructive' as const,
          icon: <AlertTriangle className="size-3 text-destructive" />,
          color: 'text-destructive',
          border: 'border-destructive/60 bg-destructive/5',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          variant: 'neutral' as const,
          icon: <XCircle className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
      case 'paused':
        return {
          label: 'Paused',
          variant: 'neutral' as const,
          icon: <Pause className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
      default:
        return {
          label: 'Unknown',
          variant: 'neutral' as const,
          icon: <HelpCircle className="size-3 text-muted-foreground" />,
          color: 'text-muted-foreground',
          border: 'border-border',
        };
    }
  }, [event.status]);

  const toggleToolDetails = (toolKey: string) => {
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolKey)) next.delete(toolKey);
      else next.add(toolKey);
      return next;
    });
  };

  const handleActionClick = async (action: StructuredMessageAction) => {
    if (onAction) {
      await onAction(action);
      return;
    }
    await executeStructuredAction(action, {
      roomId: message.roomId,
      messageId: message.id,
      agentId: event.agentId,
    });
  };

  const handleCopyText = () => {
    const textToCopy = event.responseText || event.summary || message.body;
    navigator.clipboard?.writeText(textToCopy);
    toast.success('Agent response copied to clipboard');
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(
      `${window.location.origin}${window.location.pathname}#${message.id}`,
    );
    toast.success('Link copied to clipboard');
  };

  // Clicking the agent's avatar or name opens the same right-rail profile a
  // person gets, routed to the agent profile via `entityKind`.
  const agentName = event.agentName || message.senderName;
  const profileCard = (children: ReactNode) => (
    <UserProfileCard
      userId={`agent-${event.agentId}`}
      entityKind="agent"
      entityId={event.agentId}
      name={agentName}
      avatarUrl={avatarSrc}
      title={event.model ? `${event.model} · AI Agent` : 'AI Agent'}
      role={event.agentRole || 'AI Agent'}
      bio={event.agentDescription || 'AI agent on Onetab AI.'}
    >
      {children}
    </UserProfileCard>
  );

  // Compact Mode Rendering
  if (density === 'compact') {
    return (
      <article
        data-message-id={message.id}
        className={cn(
          'group/card relative my-1.5 rounded-xl border border-border/80 bg-surface p-3 transition-colors hover:border-border',
          isHighlighted && 'ring-2 ring-primary/60',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar
              name={event.agentName || message.senderName}
              seed={event.agentAvatarSeed || event.agentId}
              src={avatarSrc}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-foreground truncate">
                  {event.agentName || message.senderName}
                </span>
                <span className="text-2xs text-muted-foreground font-mono">
                  {event.model}
                </span>
                <Badge
                  variant={statusConfig.variant}
                  className="text-2xs py-0 h-4 gap-1"
                >
                  {statusConfig.icon}
                  <span>{statusConfig.label}</span>
                </Badge>
              </div>
              <p className="text-xs text-foreground/90 truncate mt-0.5 max-w-md">
                {event.summary || event.responseText || message.body}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {event.durationMs !== undefined && (
              <span className="text-2xs font-mono text-muted-foreground">
                {formatDuration(event.durationMs)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => prefs.setDensity('comfortable')}
              className="h-6 text-2xs px-2"
            >
              Open
            </Button>
          </div>
        </div>
      </article>
    );
  }

  // Captured once as a local so the non-optional type survives into the
  // `onClick` closures below — `event.files` itself loses that narrowing
  // across a nested function boundary.
  const files = event.files ?? [];

  // Standard (Comfortable) & Expanded Card Rendering
  return (
    <article
      data-message-id={message.id}
      className={cn(
        // Same row rhythm as a normal message (ChatBubble comfy density).
        'group/card relative -mx-4 flex gap-4 px-4 pt-2.5 pb-1 transition-colors hover:bg-foreground/[0.035]',
        isHighlighted && 'border-l-2 border-l-primary bg-primary/5',
        isFailed && 'bg-destructive/5',
      )}
    >
      <div className="relative w-10 shrink-0">
        {profileCard(
          avatarSrc ? (
            <UserAvatar
              name={event.agentName || message.senderName}
              seed={event.agentAvatarSeed || event.agentId}
              src={avatarSrc}
              size="md"
              indicator={false}
              className="size-10 rounded-full shadow-xs"
            />
          ) : (
            // No uploaded photo: the same Bot tile the sidebar shows for agents.
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-xs"
            >
              <Bot className="size-5" />
            </span>
          ),
        )}
      </div>

      <div className="min-w-0 flex-1">
      {/* 1. AGENT HEADER — same shape as a normal message header */}
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              {profileCard(
                <span className="text-message font-bold text-foreground hover:underline">
                  {event.agentName || message.senderName}
                </span>,
              )}

              <EntityKindBadge kind="agent" />

              <time
                dateTime={new Date(message.timestamp).toISOString()}
                className="font-medium text-xs text-muted-foreground"
              >
                {new Date(message.timestamp).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </time>
            </div>

          </div>
        </div>

        {/* Top-Right Card Actions */}
        <div className="flex items-center gap-1 self-start opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
          {prefs.showSaveAction && onToggleSave && (
            <Hint label={isSaved ? 'Remove from saved' : 'Save for later'}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onToggleSave}
                aria-label="Save card"
                className={cn(
                  'size-7 text-muted-foreground hover:text-foreground',
                  isSaved && 'text-primary',
                )}
              >
                <Bookmark className={cn('size-3.5', isSaved && 'fill-current')} />
              </Button>
            </Hint>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="More agent options"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              collisionPadding={8}
              className="w-52 text-xs border-border bg-popover text-popover-foreground z-50 shadow-overlay"
            >
              <DropdownMenuItem onClick={handleCopyText} className="gap-2">
                <Copy className="size-3.5" />
                <span>Copy Response</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
                <Link2 className="size-3.5" />
                <span>Copy Message Link</span>
              </DropdownMenuItem>

              {onOpenThread && (
                <DropdownMenuItem onClick={onOpenThread} className="gap-2">
                  <ArrowRight className="size-3.5" />
                  <span>Reply in Thread</span>
                </DropdownMenuItem>
              )}

              {onRetry && (
                <DropdownMenuItem onClick={onRetry} className="gap-2">
                  <RefreshCw className="size-3.5" />
                  <span>Run Again</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setSettingsOpen(true)}
                className="gap-2"
              >
                <Settings className="size-3.5" />
                <span>Display Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setDebugModalOpen(true)}
                className="gap-2 font-mono text-xs"
              >
                <Terminal className="size-3.5 text-primary" />
                <span>View Event Debug JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 2. LIVE / STREAMING EXECUTION PROGRESS */}
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 text-xs animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        >
          <style>{`
            @keyframes agent-status-shimmer {
              from { background-position: 200% 0; }
              to { background-position: -200% 0; }
            }
            .agent-status-text {
              background-image: linear-gradient(90deg, currentColor 35%, var(--color-primary, #16a34a) 50%, currentColor 65%);
              background-size: 200% 100%;
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              animation: agent-status-shimmer 2.2s linear infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .agent-status-text { animation: none; -webkit-text-fill-color: currentColor; }
            }
          `}</style>
          <span className="agent-status-text font-medium text-muted-foreground">
            {event.status === 'queued' ? 'Waiting in queue' : 'Thinking'}
            {event.tools?.some((t) => t.status === 'running') ? ' · using tools' : ''}…
          </span>

          {/* Step Progression checklist */}
          <div className="mt-2.5 space-y-1.5 font-mono text-xs empty:hidden">
            {event.tools && event.tools.length > 0 &&
              event.tools.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {t.status === 'success' ? (
                    <Check className="size-3 text-success" />
                  ) : t.status === 'running' ? (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  ) : t.status === 'failed' ? (
                    <XCircle className="size-3 text-destructive" />
                  ) : (
                    <span className="size-3 rounded-full border border-border text-center text-2xs leading-none">
                      ○
                    </span>
                  )}
                  <span className={cn(t.status === 'running' && 'font-bold text-primary')}>
                    {t.name}
                  </span>
                  {t.durationMs !== undefined && (
                    <span className="text-2xs text-muted-foreground ml-auto">
                      {formatDuration(t.durationMs)}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 3. APPROVAL REQUIRED STATE BANNER */}
      {isWaitingApproval && (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs text-foreground">
          <div className="flex items-center gap-2 font-bold text-warning-text">
            <ShieldAlert className="size-4" />
            <span>Approval Required for Execution</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            This agent requires authorization before executing side-effecting operations.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="warning"
              onClick={() =>
                handleActionClick({
                  id: 'approve',
                  label: 'Approve & Continue',
                  variant: 'primary',
                })
              }
              className="h-7 text-xs"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleActionClick({
                  id: 'reject',
                  label: 'Reject Action',
                  variant: 'destructive',
                })
              }
              className="h-7 text-xs border-warning/30 text-warning-text"
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* 4. FAILED STATE BANNER */}
      {isFailed && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="size-4" />
              <span>{event.errorMessage || 'Execution encountered an unrecoverable error.'}</span>
            </span>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-6 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 5. SUMMARY (If distinct from main response) */}
      {event.summary && event.responseText && (
        <div className="mt-3 rounded-xl bg-surface-raised/80 p-3 border border-border/50 text-xs leading-relaxed">
          <span className="font-bold text-foreground block mb-1">Summary</span>
          <p className="text-muted-foreground">{event.summary}</p>
        </div>
      )}

      {/* 6. REASONING / THINKING PROCESS (Collapsible) */}
      {event.reasoning && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setReasoningExpanded((prev) => !prev)}
            className="w-full px-3 py-2 flex items-center justify-between text-left transition-colors hover:bg-primary/10 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Cpu className="size-3.5 animate-pulse" />
              <span>
                Reasoning &amp; Chain-of-Thought{' '}
                {event.reasoning.durationMs && `(${formatDuration(event.reasoning.durationMs)})`}
              </span>
              {event.reasoning.summary && (
                <span className="text-xs font-normal text-muted-foreground truncate max-w-xs">
                  — {event.reasoning.summary}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                'size-3.5 text-primary transition-transform duration-200',
                reasoningExpanded && 'rotate-180',
              )}
            />
          </button>
          {reasoningExpanded && event.reasoning.details && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground border-t border-primary/15 bg-background/50 leading-relaxed font-mono whitespace-pre-wrap">
              {event.reasoning.details}
            </div>
          )}
        </div>
      )}

      {/* 7. MAIN AGENT RESPONSE BODY */}
      {(hasContent || (!isPending && message.body)) && (
        <div className="text-message text-foreground animate-in fade-in-0 duration-300">
          <MarkdownMessage
            text={event.responseText || event.summary || message.body}
            className="text-message"
          />
        </div>
      )}

      {/* 8. KEY FINDINGS / ACTIONS TAKEN (Bullet cards) */}
      {event.keyFindings && event.keyFindings.length > 0 && (
        <div className="mt-3.5 space-y-1.5">
          <span className="text-xs font-bold text-foreground block uppercase tracking-wider">
            Key Findings
          </span>
          <div className="grid sm:grid-cols-2 gap-2">
            {event.keyFindings.map((finding, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-border/80 bg-surface-raised text-xs text-foreground flex items-start gap-2"
              >
                <Check className="size-3.5 text-success shrink-0 mt-0.5" />
                <span>{finding}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. TOOL EXECUTIONS ACCORDION */}
      {prefs.showTools && event.tools && event.tools.length > 0 && (
        <div className="mt-3.5 rounded-xl border border-border/80 bg-surface-raised overflow-hidden">
          <button
            type="button"
            onClick={() => setToolsExpanded((prev) => !prev)}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors hover:bg-accent cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Terminal className="size-3.5 text-primary" />
              <span>Tool Executions ({event.tools.length})</span>
            </div>
            <ChevronDown
              className={cn(
                'size-3.5 text-muted-foreground transition-transform duration-200',
                toolsExpanded && 'rotate-180',
              )}
            />
          </button>

          {toolsExpanded && (
            <div className="p-3 border-t border-border space-y-2">
              {event.tools.map((tool, idx) => {
                const toolKey = tool.id || `tool-${idx}`;
                const isDetailOpen = expandedToolIds.has(toolKey);

                return (
                  <div
                    key={toolKey}
                    className="rounded-lg border border-border bg-surface p-2.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {tool.status === 'success' ? (
                          <Check className="size-3 text-success shrink-0" />
                        ) : tool.status === 'running' ? (
                          <Loader2 className="size-3 animate-spin text-primary shrink-0" />
                        ) : (
                          <XCircle className="size-3 text-destructive shrink-0" />
                        )}
                        <span className="font-semibold text-foreground truncate">
                          {tool.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {tool.durationMs !== undefined && (
                          <span className="text-2xs text-muted-foreground">
                            {formatDuration(tool.durationMs)}
                          </span>
                        )}
                        {(tool.input || tool.output || tool.error) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleToolDetails(toolKey)}
                            className="h-5 px-1.5 text-2xs text-muted-foreground hover:text-foreground"
                          >
                            {isDetailOpen ? 'Hide' : 'Inspect'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isDetailOpen && (
                      <div className="mt-2 pt-2 border-t border-border/60 space-y-2 text-xs">
                        {Boolean(tool.input) && (
                          <div>
                            <span className="text-2xs font-bold text-muted-foreground uppercase block mb-1">
                              Input
                            </span>
                            <CodeBlock
                              variant="compact"
                              language="json"
                              code={
                                typeof tool.input === 'string'
                                  ? tool.input
                                  : JSON.stringify(tool.input, null, 2)
                              }
                            />
                          </div>
                        )}

                        {Boolean(tool.output) && (
                          <div>
                            <span className="text-2xs font-bold text-muted-foreground uppercase block mb-1">
                              Output
                            </span>
                            <CodeBlock
                              variant="compact"
                              language="json"
                              code={
                                typeof tool.output === 'string'
                                  ? tool.output
                                  : JSON.stringify(tool.output, null, 2)
                              }
                            />
                          </div>
                        )}

                        {tool.error && (
                          <div className="text-destructive font-sans">
                            <span className="text-2xs font-bold uppercase block">
                              Error
                            </span>
                            <p className="mt-0.5">{tool.error}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 10. SOURCES SECTION ("N Sources ▾") */}
      {prefs.showSources && event.sources && event.sources.length > 0 && (
        <div className="mt-3.5">
          <button
            type="button"
            onClick={() => setSourcesExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Search className="size-3.5 text-primary" />
            <span>{event.sources.length} Sources &amp; Citations</span>
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200',
                sourcesExpanded && 'rotate-180',
              )}
            />
          </button>

          {sourcesExpanded && (
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {event.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-border bg-surface-raised hover:bg-accent/40 transition-colors flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-foreground hover:underline truncate block"
                    >
                      {src.title}
                    </a>
                    <span className="text-2xs text-muted-foreground block truncate mt-0.5">
                      {src.domain || src.url}
                    </span>
                    {src.description && (
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1">
                        {src.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Hint label="Open source link">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Hint>
                    <Hint label="Copy link">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(src.url);
                          toast.success('Source link copied');
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </Hint>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 11. GENERATED FILES & CODE OUTPUT */}
      {files.length > 0 && (
        <div className="mt-3.5 space-y-2">
          <span className="text-xs font-bold text-foreground block uppercase tracking-wider">
            Generated Outputs &amp; Files
          </span>
          <div className="grid sm:grid-cols-2 gap-2">
            {files.map((file, idx) => {
              const isImage = file.mimeType.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-border bg-surface-raised flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {isImage ? (
                        <ImageIcon className="size-4" />
                      ) : file.codeSnippet ? (
                        <FileCode className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground truncate block">
                        {file.name}
                      </span>
                      <span className="text-2xs text-muted-foreground block">
                        {file.mimeType} {file.size ? `· ${(file.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        openPreview(files.map(generatedFileToMediaItem), idx)
                      }
                      className="h-7 text-xs px-2"
                    >
                      Preview
                    </Button>
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                    >
                      <Download className="size-3" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 12. DYNAMIC SUGGESTED ACTIONS BAR */}
      {event.suggestedActions && event.suggestedActions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            ⚡ Suggested Follow-up Actions
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {event.suggestedActions.map((act) => {
              const btnVariant =
                act.variant === 'default' ? 'primary' : act.variant || 'outline';
              return (
                <Button
                  key={act.id}
                  size="sm"
                  variant={btnVariant}
                  onClick={() => handleActionClick(act)}
                  className="h-7 text-xs gap-1.5 shadow-2xs"
                >
                  <span>{act.label}</span>
                  <ArrowUpRight className="size-3 opacity-70" />
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* 13. TECHNICAL METADATA (Debug Drawer) */}
      {prefs.showTechnicalMetadata && (
        <div className="mt-3.5 rounded-xl border border-border/80 bg-surface-inset p-3 text-xs font-mono text-muted-foreground">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-foreground">Technical Audit Metadata</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDebugModalOpen(true)}
              className="h-5 px-1 text-2xs"
            >
              Full JSON
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>Agent ID: {event.agentId}</div>
            <div>Execution ID: {event.executionId || 'N/A'}</div>
            <div>Message Event ID: {message.id}</div>
            <div>Latency: {formatDuration(event.durationMs)}</div>
          </div>
        </div>
      )}

      {/* Raw Event Debug Modal */}
      {debugModalOpen && (
        <Dialog open={debugModalOpen} onOpenChange={setDebugModalOpen}>
          <DialogContent className="max-w-2xl bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono flex items-center gap-2">
                <Terminal className="size-4 text-primary" />
                <span>Raw Event Payload: {message.id}</span>
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="max-h-[60vh] overflow-y-auto">
                <CodeBlock
                  language="json"
                  filename={`event-${message.id}.json`}
                  code={JSON.stringify(event, null, 2)}
                />
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {/* Reactions + thread summary — identical to a normal message row */}
      {message.reactions.length > 0 ? (
        <div className="mt-1">
          <ReactionBar
            reactions={message.reactions}
            onToggle={onReact ? (key) => onReact(key) : undefined}
            addButton={
              onReact ? (
                <ReactionPicker onSelect={onReact}>
                  <button
                    type="button"
                    aria-label="Add a reaction"
                    className={reactionAddButtonClass}
                  >
                    <SmilePlus className="size-4" aria-hidden="true" />
                  </button>
                </ReactionPicker>
              ) : null
            }
          />
        </div>
      ) : null}
      {threadReplyCount && threadReplyCount > 0 ? (
        <div className="mt-1 w-fit">
          <ThreadRepliesButton
            count={threadReplyCount}
            hasUnread={threadHasUnread}
            participants={threadParticipants}
            lastReplyAt={lastReplyAt}
            onOpen={onOpenThread}
          />
        </div>
      ) : null}

      {/* Card Settings Dialog */}
      <CardSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </article>
  );
}

import { generatedFileToMediaItem, useMediaPreview } from '@org/media-preview';
import {
  getAppLogoUrl,
  splitAppConnectionName,
  type AIAgentMessageContent,
  type Message,
  type RoomMember,
  type StructuredMessageAction,
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
  EntityContextMenu,
  type EntityAction,
  Hint,
  toast,
  AiEntityAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { EntityKindBadge } from '../entity-kind-badge.js';
import { AppLogoAvatar } from '../app-logo-avatar.js';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  CornerDownRight,
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
  Forward,
  Pause,
  Pin,
  PinOff,
  Quote,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  SmilePlus,
  SquareDot,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UserProfileCard } from '../user-profile-card.js';
import { MarkdownMessage } from '../markdown-message.js';
import { MessageActionToolbar, ThreadRepliesButton, ReactionPicker } from '../chat-bubble.js';
import { ReactionBar, reactionAddButtonClass } from '../reaction-bar.js';
import { SavedForLaterLabel } from '../saved-for-later-label.js';
import { executeStructuredAction } from './action-handler.js';
import { useAiEntity, useAppEntity } from './agent-avatar-context.js';
import { useAICardPreferencesStore } from './card-preferences-store.js';
import { CardSettingsDialog } from './card-settings-dialog.js';

export interface AgentMessageCardProps {
  message: Message;
  event: AIAgentMessageContent;
  isOwn?: boolean;
  isHighlighted?: boolean;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
  onRetry?: () => void;
  onFollowUp?: (text: string) => void;
  showFollowUps?: boolean;
  onOpenThread?: () => void;
  onToggleSave?: () => void;
  isSaved?: boolean;
  /** Same optional handlers a normal message row takes — each action shows
   *  only when its handler is wired, exactly like `ChatBubble`. */
  onReply?: () => void;
  onForward?: () => void;
  onCopyLink?: () => void;
  onCopyText?: () => void;
  onQuote?: () => void;
  onMarkUnread?: () => void;
  onRemind?: (remindAt: Date) => void;
  onTogglePin?: () => void;
  isPinned?: boolean;
  onDelete?: () => void;
  canModerateMessages?: boolean;
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

/** Turns a raw provider error into something a non-engineer can act on. */
export function describeAgentError(raw?: string): { title: string; hint: string } {
  const msg = (raw ?? '').toLowerCase();
  if (/unavailable|http 40[4]|http 410|not found|end of life|overloaded|http 503/.test(msg)) {
    return {
      title: "This agent's AI model isn't available right now",
      hint: 'The model may be temporarily down or retired. Try again in a moment — if it keeps failing, ask a workspace admin to switch the agent to another model.',
    };
  }
  if (/rate limit|http 429|too many/.test(msg)) {
    return {
      title: 'The agent is getting too many requests',
      hint: 'Wait a few seconds and try again.',
    };
  }
  if (/credential|unauthorized|auth|api key|http 40[13]/.test(msg)) {
    return {
      title: "The agent can't sign in to its AI provider",
      hint: 'The provider key looks missing or invalid. A workspace admin needs to check the AI provider settings.',
    };
  }
  if (/timed out|timeout/.test(msg)) {
    return {
      title: 'The agent took too long to respond',
      hint: 'Try again, or ask for something smaller.',
    };
  }
  return {
    title: "The agent couldn't finish this request",
    hint: 'Something went wrong while it was working. Try again.',
  };
}

export function AgentMessageCard({
  message,
  event,
  isOwn: _isOwn = false,
  isHighlighted = false,
  onAction,
  onRetry,
  onFollowUp,
  showFollowUps = true,
  onOpenThread,
  onToggleSave,
  isSaved = false,
  onReply,
  onForward,
  onCopyLink,
  onCopyText,
  onQuote,
  onMarkUnread,
  onRemind,
  onTogglePin,
  isPinned = false,
  onDelete,
  canModerateMessages = false,
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
  const [followUpSent, setFollowUpSent] = useState(false);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());

  // Connected apps (Asana, GitHub…) answer through this same card. Replies
  // posted before `agentKind` existed are recognised by their `App` role, and
  // their "Asana · balram" connection name is split back to the app's name.
  const isApp = event.agentKind === 'app' || event.agentRole === 'App';
  const rawAgentName = event.agentName || message.senderName;
  const appIdentity = isApp ? splitAppConnectionName(rawAgentName) : null;
  // An app's current name/logo come from the API, so a rename reaches every
  // reply — old ones included; the posted snapshot is only the fallback.
  const liveApp = useAppEntity(isApp ? event.agentId : undefined);
  const appAccountLabel = isApp
    ? liveApp
      ? liveApp.accountLabel
      : event.appAccountLabel ?? appIdentity?.accountLabel
    : undefined;
  const liveEntity = useAiEntity(
    isApp ? undefined : event.agentId,
    isApp ? undefined : rawAgentName,
  );
  // The live name wins for agents/coworkers too, so a rename (in Studio or
  // the app) reaches every reply, not just ones posted afterwards.
  const agentName = isApp
    ? liveApp?.name || appIdentity?.appName || rawAgentName
    : liveEntity?.name || rawAgentName;
  const avatarSrc = isApp
    ? liveApp?.logoUrl ||
      event.agentAvatarUrl ||
      getAppLogoUrl(liveApp?.provider ?? event.appProvider, agentName)
    : liveEntity?.avatarUrl || event.agentAvatarUrl || message.senderAvatarUrl;
  const entityKind = liveEntity?.kind ?? 'agent';
  const badgeKind = isApp ? 'app' : 'agent';
  const density = prefs.density;
  const isRunning = event.status === 'running' || event.status === 'starting';
  const isPending = isRunning || event.status === 'queued';
  // The bot posts "AI Agent Response" as a body placeholder before any text exists.
  const hasContent = Boolean(event.responseText || event.summary);
  const isFailed = event.status === 'failed';
  const isWaitingApproval = event.status === 'waiting_for_approval';
  const followUps = (event.suggestedActions ?? []).filter((a) => a.actionType === 'follow_up');
  const otherActions = (event.suggestedActions ?? []).filter((a) => a.actionType !== 'follow_up');
  const friendlyError = describeAgentError(event.errorMessage);

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
  // person gets, routed to the agent (or app) profile via `entityKind`.
  const profileCard = (children: ReactNode) => (
    <UserProfileCard
      userId={`${badgeKind}-${event.agentId}`}
      entityKind={badgeKind}
      entityId={event.agentId}
      name={agentName}
      avatarUrl={avatarSrc}
      title={
        isApp
          ? appAccountLabel
            ? `App · ${appAccountLabel}`
            : 'App'
          : event.model
            ? `${event.model} · AI Agent`
            : 'AI Agent'
      }
      role={isApp ? 'App' : event.agentRole || 'AI Agent'}
      bio={event.agentDescription || (isApp ? `${agentName} app connected to Onetab AI.` : 'AI agent on Onetab AI.')}
    >
      {children}
    </UserProfileCard>
  );

  // Same open/pinned bookkeeping as ChatBubble so the shared toolbar behaves
  // identically (touch long-press pins it open, picker keeps it up).
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const [actionsPinned, setActionsPinned] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!actionsPinned) return;
    const dismiss = (e: Event) => {
      if (isMenuOpen || isReactionOpen) return;
      if (e.type === 'pointerdown' && articleRef.current?.contains(e.target as Node)) return;
      setActionsPinned(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [actionsPinned, isMenuOpen, isReactionOpen]);

  const responseText = event.responseText || event.summary || message.body;
  // Generic message actions + the ones that only make sense for an agent run
  // (run again, event JSON, card display). The toolbar owns the quick ones, so
  // the "⋯" menu skips those; the right-click menu / touch sheet show all.
  const buildActions = (surface: 'menu' | 'dropdown' = 'menu'): EntityAction[] => {
    const onToolbar = surface === 'dropdown';
    return [
      {
        id: 'reply-thread',
        group: 'reply',
        label: 'Reply in thread',
        icon: ArrowRight,
        hidden: onToolbar || !onOpenThread,
        run: onOpenThread,
      },
      {
        id: 'quote',
        group: 'reply',
        label: 'Quote response',
        icon: Quote,
        hidden: !onQuote || !responseText,
        run: onQuote,
      },
      {
        id: 'save',
        group: 'reply',
        label: isSaved ? 'Remove from saved' : 'Save for later',
        icon: Bookmark,
        hidden: onToolbar || !onToggleSave,
        run: onToggleSave,
      },
      {
        id: 'run-again',
        group: 'agent',
        label: isFailed ? 'Try again' : 'Run again',
        icon: RefreshCw,
        hidden: !onRetry || isPending,
        run: onRetry,
      },
      {
        id: 'mark-unread',
        group: 'state',
        label: 'Mark unread',
        icon: SquareDot,
        hidden: !onMarkUnread,
        run: onMarkUnread,
      },
      {
        id: 'remind',
        group: 'state',
        label: 'Remind me about this',
        icon: Clock,
        hidden: !onRemind,
        children: onRemind
          ? [
              { id: 'remind-1h', label: 'In 1 hour', hours: 1 },
              { id: 'remind-3h', label: 'In 3 hours', hours: 3 },
              { id: 'remind-24h', label: 'Tomorrow', hours: 24 },
            ].map(
              (preset): EntityAction => ({
                id: preset.id,
                label: preset.label,
                run: () => onRemind(new Date(Date.now() + preset.hours * 3_600_000)),
              }),
            )
          : [],
      },
      {
        id: 'copy-link',
        group: 'share',
        label: 'Copy link',
        icon: Link2,
        run: onCopyLink ?? handleCopyLink,
      },
      {
        id: 'copy-text',
        group: 'share',
        label: 'Copy response',
        icon: Copy,
        hidden: !responseText,
        run: onCopyText ?? handleCopyText,
      },
      {
        id: 'forward',
        group: 'share',
        label: 'Forward message',
        icon: Forward,
        hidden: onToolbar || !onForward,
        run: onForward,
      },
      {
        id: 'pin',
        group: 'more',
        label: isPinned ? 'Unpin from channel' : 'Pin to channel',
        icon: isPinned ? PinOff : Pin,
        hidden: !onTogglePin,
        run: onTogglePin,
      },
      {
        id: 'display-settings',
        group: 'agent',
        label: 'Card display settings',
        icon: Settings,
        run: () => setSettingsOpen(true),
      },
      {
        id: 'debug-json',
        group: 'agent',
        label: 'View event JSON',
        icon: Terminal,
        run: () => setDebugModalOpen(true),
      },
      {
        id: 'delete',
        group: 'danger',
        label: 'Delete message…',
        icon: Trash2,
        destructive: true,
        hidden: !onDelete || !canModerateMessages,
        run: onDelete,
      },
    ];
  };

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
            {isApp ? (
              <AppLogoAvatar logoUrl={avatarSrc} size="sm" />
            ) : (
              <AiEntityAvatar
                name={agentName}
                kind={entityKind}
                avatarUrl={avatarSrc}
                size="sm"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-foreground truncate">
                  {agentName}
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
    <EntityContextMenu
      actions={() => buildActions('menu')}
      entityType="message"
      entity={message}
      scope={`message:${message.id}`}
      label={`Message from ${agentName}`}
    >
    <article
      data-message-id={message.id}
      ref={articleRef}
      className={cn(
        // Same row rhythm as a normal message (ChatBubble comfy density);
        // wraps only to put the "Saved for later" row above the avatar.
        'group/message relative -mx-4 flex flex-wrap gap-x-4 px-4 pt-2.5 pb-1 transition-colors hover:bg-foreground/[0.035]',
        actionsPinned && 'bg-foreground/[0.035]',
        isSaved && 'bg-primary/[0.05] hover:bg-primary/[0.08]',
        isPinned && 'bg-warning/[0.05] hover:bg-warning/[0.08]',
        isHighlighted && 'border-l-2 border-l-primary bg-primary/5',
      )}
    >
      {isSaved ? <SavedForLaterLabel /> : null}

      <div className="relative w-10 shrink-0">
        {profileCard(
          isApp ? (
            <AppLogoAvatar logoUrl={avatarSrc} size="md" />
          ) : (
            <AiEntityAvatar
              name={agentName}
              kind={entityKind}
              avatarUrl={avatarSrc}
              size="md"
            />
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
                  {agentName}
                </span>,
              )}

              <EntityKindBadge kind={badgeKind} />
              {appAccountLabel ? (
                <span className="text-xs text-muted-foreground">{appAccountLabel}</span>
              ) : null}

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
        <div
          role="alert"
          className="mt-2 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-text">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{friendlyError.title}</p>
            <p className="mt-0.5 text-muted-foreground">{friendlyError.hint}</p>
            {event.errorMessage && (
              <details className="mt-1.5 text-muted-foreground">
                <summary className="w-fit cursor-pointer select-none text-2xs font-medium hover:text-foreground">
                  Technical details
                </summary>
                <p className="mt-1 break-words font-mono text-2xs">{event.errorMessage}</p>
              </details>
            )}
          </div>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="h-7 shrink-0 gap-1.5 text-xs"
            >
              <RefreshCw className="size-3" />
              Try again
            </Button>
          )}
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
      {(hasContent || (!isPending && !isFailed && message.body)) && (
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

      {/* 12. FOLLOW-UP QUESTIONS — generated from this answer; one click sends */}
      {followUps.length > 0 && showFollowUps && !followUpSent && onFollowUp && (
        <nav
          aria-label="Suggested follow-up questions"
          className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in-0 duration-300"
        >
          {followUps.map((act) => {
            const prompt = String(act.payload?.['prompt'] ?? act.label);
            return (
              <button
                key={act.id}
                type="button"
                title={prompt}
                onClick={() => {
                  setFollowUpSent(true);
                  onFollowUp(prompt);
                }}
                className="group/fu inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-text shadow-2xs transition-all hover:-translate-y-px hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:translate-y-0"
              >
                <CornerDownRight
                  className="size-3 shrink-0 opacity-70 group-hover/fu:opacity-100"
                  aria-hidden
                />
                <span className="truncate">{act.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Other suggested actions (non follow-up): buttons */}
      {otherActions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            Suggested actions
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {otherActions.map((act) => {
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

      <MessageActionToolbar
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        isReactionOpen={isReactionOpen}
        onReactionOpenChange={setIsReactionOpen}
        actionsPinned={actionsPinned}
        onPinnedChange={setActionsPinned}
        onReact={onReact}
        onOpenThread={onOpenThread}
        onReply={onReply}
        onForward={onForward}
        onCopyLink={onCopyLink}
        onToggleSave={onToggleSave}
        isSaved={isSaved}
        buildActions={() => buildActions('dropdown')}
        entity={message}
      />
    </article>
    </EntityContextMenu>
  );
}

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
import { MessageTime } from '../message-time.js';
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
  Reply,
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
import {
  MessageActionToolbar,
  ThreadRepliesButton,
  ReactionPicker,
} from '../chat-bubble.js';
import { ReactionBar, reactionAddButtonClass } from '../reaction-bar.js';
import { SavedForLaterLabel } from '../saved-for-later-label.js';
import { executeStructuredAction } from './action-handler.js';
import { useAiEntity, useAppEntity } from './agent-avatar-context.js';
import { ConnectAppsBlock } from './connect-apps-block.js';
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
export function describeAgentError(raw?: string): {
  title: string;
  hint: string;
} {
  const msg = (raw ?? '').toLowerCase();
  if (
    /unavailable|http 40[4]|http 410|not found|end of life|overloaded|http 503/.test(
      msg,
    )
  ) {
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
  const [sourcesExpanded, setSourcesExpanded] = useState(
    !prefs.collapseSources,
  );
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(
    new Set(),
  );

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
      : (event.appAccountLabel ?? appIdentity?.accountLabel)
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
  const followUps = (event.suggestedActions ?? []).filter(
    (a) => a.actionType === 'follow_up',
  );
  const otherActions = (event.suggestedActions ?? []).filter(
    (a) => a.actionType !== 'follow_up',
  );
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
          icon: (
            <ShieldAlert className="size-3 animate-bounce text-warning-text" />
          ),
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
      bio={
        event.agentDescription ||
        (isApp
          ? `${agentName} app connected to Onetab AI.`
          : 'AI agent on Onetab AI.')
      }
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
      if (
        e.type === 'pointerdown' &&
        articleRef.current?.contains(e.target as Node)
      )
        return;
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
  const buildActions = (
    surface: 'menu' | 'dropdown' = 'menu',
  ): EntityAction[] => {
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
        id: 'reply',
        group: 'reply',
        label: 'Reply',
        icon: Reply,
        hidden: !onReply,
        run: onReply,
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
            ].map((preset): EntityAction => ({
              id: preset.id,
              label: preset.label,
              run: () =>
                onRemind(new Date(Date.now() + preset.hours * 3_600_000)),
            }))
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
          'group/card my-1.5 p-3 relative rounded-xl border border-border/80 bg-surface transition-colors hover:border-border',
          isHighlighted && 'ring-2 ring-primary/60',
        )}
      >
        <div className="gap-3 flex items-center justify-between">
          <div className="gap-2 min-w-0 flex items-center">
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
              <div className="gap-1.5 flex flex-wrap items-center">
                <span className="text-xs font-bold truncate text-foreground">
                  {agentName}
                </span>
                <span className="font-mono text-2xs text-muted-foreground">
                  {event.model}
                </span>
                <Badge
                  variant={statusConfig.variant}
                  className="py-0 h-4 gap-1 text-2xs"
                >
                  {statusConfig.icon}
                  <span>{statusConfig.label}</span>
                </Badge>
              </div>
              <p className="text-xs mt-0.5 max-w-md truncate text-foreground/90">
                {event.summary || event.responseText || message.body}
              </p>
            </div>
          </div>

          <div className="gap-1 flex shrink-0 items-center">
            {event.durationMs !== undefined && (
              <span className="font-mono text-2xs text-muted-foreground">
                {formatDuration(event.durationMs)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => prefs.setDensity('comfortable')}
              className="h-6 px-2 text-2xs"
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
          'group/message -mx-4 gap-x-4 px-4 pt-2.5 pb-1 relative flex flex-wrap transition-colors hover:bg-foreground/[0.035]',
          actionsPinned && 'bg-foreground/[0.035]',
          isSaved && 'bg-primary/[0.05] hover:bg-primary/[0.08]',
          isPinned && 'bg-warning/[0.05] hover:bg-warning/[0.08]',
          isHighlighted && 'border-l-2 border-l-primary bg-primary/5',
        )}
      >
        {isSaved ? <SavedForLaterLabel /> : null}

        <div className="w-10 relative shrink-0">
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
          <header className="gap-3 flex items-baseline justify-between">
            <div className="gap-3 min-w-0 flex items-baseline">
              <div className="min-w-0">
                <div className="gap-2 flex flex-wrap items-baseline">
                  {profileCard(
                    <span className="font-bold text-message text-foreground hover:underline">
                      {agentName}
                    </span>,
                  )}

                  {/* The connected account is detail, not identity: it lives in
                  the badge's tooltip and the profile card, not on every reply. */}
                  <span
                    title={
                      appAccountLabel
                        ? `Connected as ${appAccountLabel}`
                        : undefined
                    }
                  >
                    <EntityKindBadge kind={badgeKind} />
                  </span>

                  <MessageTime
                    timestamp={message.timestamp}
                    className="font-medium text-xs cursor-pointer text-muted-foreground hover:underline"
                  />
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
                {event.tools?.some((t) => t.status === 'running')
                  ? ' · using tools'
                  : ''}
                …
              </span>

              {/* Step Progression checklist */}
              <div className="mt-2.5 space-y-1.5 text-xs font-mono empty:hidden">
                {event.tools &&
                  event.tools.length > 0 &&
                  event.tools.map((t, idx) => (
                    <div key={idx} className="gap-2 flex items-center">
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
                      <span
                        className={cn(
                          t.status === 'running' && 'font-bold text-primary',
                        )}
                      >
                        {t.name}
                      </span>
                      {t.durationMs !== undefined && (
                        <span className="ml-auto text-2xs text-muted-foreground">
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
            <div className="mt-3 p-3.5 text-xs rounded-xl border border-warning/40 bg-warning/10 text-foreground">
              <div className="gap-2 font-bold flex items-center text-warning-text">
                <ShieldAlert className="size-4" />
                <span>Approval Required for Execution</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                This agent requires authorization before executing
                side-effecting operations.
              </p>
              <div className="mt-3 gap-2 flex items-center">
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
              className="mt-2 gap-3 p-3 text-xs flex items-start rounded-xl border border-warning/40 bg-warning/10"
            >
              <span className="mt-0.5 size-7 flex shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-text">
                <AlertTriangle className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {friendlyError.title}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {friendlyError.hint}
                </p>
                {event.errorMessage && (
                  <details className="mt-1.5 text-muted-foreground">
                    <summary className="font-medium w-fit cursor-pointer text-2xs select-none hover:text-foreground">
                      Technical details
                    </summary>
                    <p className="mt-1 font-mono text-2xs break-words">
                      {event.errorMessage}
                    </p>
                  </details>
                )}
              </div>
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="h-7 gap-1.5 text-xs shrink-0"
                >
                  <RefreshCw className="size-3" />
                  Try again
                </Button>
              )}
            </div>
          )}

          {/* 5. SUMMARY (If distinct from main response) */}
          {event.summary && event.responseText && (
            <div className="mt-3 p-3 text-xs leading-relaxed rounded-xl border border-border/50 bg-surface-raised/80">
              <span className="font-bold mb-1 block text-foreground">
                Summary
              </span>
              <p className="text-muted-foreground">{event.summary}</p>
            </div>
          )}

          {/* 6. REASONING / THINKING PROCESS (Collapsible) */}
          {event.reasoning && (
            <div className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
              <button
                type="button"
                onClick={() => setReasoningExpanded((prev) => !prev)}
                className="px-3 py-2 flex w-full cursor-pointer items-center justify-between text-left transition-colors hover:bg-primary/10"
              >
                <div className="gap-2 text-xs font-semibold flex items-center text-primary">
                  <Cpu className="size-3.5 animate-pulse" />
                  <span>
                    Reasoning &amp; Chain-of-Thought{' '}
                    {event.reasoning.durationMs &&
                      `(${formatDuration(event.reasoning.durationMs)})`}
                  </span>
                  {event.reasoning.summary && (
                    <span className="text-xs font-normal max-w-xs truncate text-muted-foreground">
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
                <div className="px-3 py-2.5 text-xs leading-relaxed border-t border-primary/15 bg-background/50 font-mono whitespace-pre-wrap text-muted-foreground">
                  {event.reasoning.details}
                </div>
              )}
            </div>
          )}

          {/* 7. MAIN AGENT RESPONSE BODY */}
          {(hasContent || (!isPending && !isFailed && message.body)) && (
            <div className="animate-in fade-in-0 text-message text-foreground duration-300">
              <MarkdownMessage
                text={event.responseText || event.summary || message.body}
                className="text-message"
              />
            </div>
          )}

          {/* 7b. APPS TO CONNECT — the agent can't act in these for this person yet */}
          {!isPending &&
            event.connectionsNeeded &&
            event.connectionsNeeded.length > 0 && (
              <ConnectAppsBlock
                needs={event.connectionsNeeded}
                agentName={agentName}
                onAskAgain={onRetry}
              />
            )}

          {/* 8. KEY FINDINGS / ACTIONS TAKEN (Bullet cards) */}
          {event.keyFindings && event.keyFindings.length > 0 && (
            <div className="mt-3.5 space-y-1.5">
              <span className="text-xs font-bold tracking-wider block text-foreground uppercase">
                Key Findings
              </span>
              <div className="sm:grid-cols-2 gap-2 grid">
                {event.keyFindings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 text-xs gap-2 flex items-start rounded-lg border border-border/80 bg-surface-raised text-foreground"
                  >
                    <Check className="size-3.5 mt-0.5 shrink-0 text-success" />
                    <span>{finding}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. TOOL EXECUTIONS ACCORDION */}
          {prefs.showTools && event.tools && event.tools.length > 0 && (
            <div className="mt-2">
              {/* A quiet line under the answer, not a full-width bar that outweighs it. */}
              <button
                type="button"
                aria-expanded={toolsExpanded}
                onClick={() => setToolsExpanded((prev) => !prev)}
                className="gap-1.5 px-1.5 py-0.5 -ml-1.5 text-xs inline-flex max-w-full cursor-pointer items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Terminal className="size-3 shrink-0" />
                <span className="truncate">
                  Used {event.tools.length}{' '}
                  {event.tools.length === 1 ? 'tool' : 'tools'}
                  {' · '}
                  {event.tools.map((tool) => tool.name).join(', ')}
                </span>
                <ChevronDown
                  className={cn(
                    'size-3 shrink-0 transition-transform duration-200',
                    toolsExpanded && 'rotate-180',
                  )}
                />
              </button>

              {toolsExpanded && (
                <div className="mt-1.5 p-3 space-y-2 rounded-xl border border-border/80 bg-surface-raised">
                  {event.tools.map((tool, idx) => {
                    const toolKey = tool.id || `tool-${idx}`;
                    const isDetailOpen = expandedToolIds.has(toolKey);

                    return (
                      <div
                        key={toolKey}
                        className="p-2.5 text-xs rounded-lg border border-border bg-surface font-mono"
                      >
                        <div className="gap-2 flex items-center justify-between">
                          <div className="gap-2 min-w-0 flex items-center">
                            {tool.status === 'success' ? (
                              <Check className="size-3 shrink-0 text-success" />
                            ) : tool.status === 'running' ? (
                              <Loader2 className="size-3 animate-spin shrink-0 text-primary" />
                            ) : (
                              <XCircle className="size-3 shrink-0 text-destructive" />
                            )}
                            <span className="font-semibold truncate text-foreground">
                              {tool.name}
                            </span>
                          </div>

                          <div className="gap-2 flex shrink-0 items-center">
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
                          <div className="mt-2 pt-2 space-y-2 text-xs border-t border-border/60">
                            {Boolean(tool.input) && (
                              <div>
                                <span className="font-bold mb-1 block text-2xs text-muted-foreground uppercase">
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
                                <span className="font-bold mb-1 block text-2xs text-muted-foreground uppercase">
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
                              <div className="font-sans text-destructive">
                                <span className="font-bold block text-2xs uppercase">
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
                className="gap-1.5 text-xs font-semibold flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
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
                <div className="mt-2 sm:grid-cols-2 gap-2 grid">
                  {event.sources.map((src, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 gap-2 text-xs flex items-start justify-between rounded-xl border border-border bg-surface-raised transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold block truncate text-foreground hover:underline"
                        >
                          {src.title}
                        </a>
                        <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
                          {src.domain || src.url}
                        </span>
                        {src.description && (
                          <p className="text-xs mt-1 line-clamp-2 text-muted-foreground/80">
                            {src.description}
                          </p>
                        )}
                      </div>

                      <div className="gap-1 flex shrink-0 items-center">
                        <Hint label="Open source link">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
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
                            className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
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
              <span className="text-xs font-bold tracking-wider block text-foreground uppercase">
                Generated Outputs &amp; Files
              </span>
              <div className="sm:grid-cols-2 gap-2 grid">
                {files.map((file, idx) => {
                  const isImage = file.mimeType.startsWith('image/');
                  return (
                    <div
                      key={idx}
                      className="p-3 gap-3 text-xs flex items-center justify-between rounded-xl border border-border bg-surface-raised"
                    >
                      <div className="gap-2.5 min-w-0 flex items-center">
                        <div className="size-8 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {isImage ? (
                            <ImageIcon className="size-4" />
                          ) : file.codeSnippet ? (
                            <FileCode className="size-4" />
                          ) : (
                            <FileText className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block truncate text-foreground">
                            {file.name}
                          </span>
                          <span className="block text-2xs text-muted-foreground">
                            {file.mimeType}{' '}
                            {file.size
                              ? `· ${(file.size / 1024).toFixed(1)} KB`
                              : ''}
                          </span>
                        </div>
                      </div>

                      <div className="gap-1.5 flex shrink-0 items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            openPreview(
                              files.map(generatedFileToMediaItem),
                              idx,
                            )
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
                          className="gap-1 px-2.5 py-1 text-xs font-semibold inline-flex items-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-accent"
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
          {followUps.length > 0 &&
            showFollowUps &&
            !followUpSent &&
            onFollowUp && (
              <nav
                aria-label="Suggested follow-up questions"
                className="mt-2 gap-1.5 animate-in fade-in-0 flex flex-wrap duration-300"
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
                      className="group/fu gap-1.5 px-3 py-1 text-xs font-medium shadow-2xs active:translate-y-0 inline-flex max-w-full items-center rounded-full border border-primary/30 bg-primary/10 text-primary-text transition-all hover:-translate-y-px hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
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
              <span className="font-bold tracking-wider mb-2 block text-2xs text-muted-foreground uppercase">
                Suggested actions
              </span>
              <div className="gap-2 flex flex-wrap items-center">
                {otherActions.map((act) => {
                  const btnVariant =
                    act.variant === 'default'
                      ? 'primary'
                      : act.variant || 'outline';
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
            <div className="mt-3.5 p-3 text-xs rounded-xl border border-border/80 bg-surface-inset font-mono text-muted-foreground">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-bold text-foreground">
                  Technical Audit Metadata
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDebugModalOpen(true)}
                  className="h-5 px-1 text-2xs"
                >
                  Full JSON
                </Button>
              </div>
              <div className="gap-x-4 gap-y-1 grid grid-cols-2">
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
              <DialogContent className="max-w-2xl border-border bg-surface">
                <DialogHeader>
                  <DialogTitle className="text-sm gap-2 flex items-center font-mono">
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
          <CardSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
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

import type { Message, RoomKind, RoomMember, WorkspacePolicy } from '@org/types';
import { SeenBy } from './seen-by.js';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  EmojiPicker,
  Hint,
  Popover,
  PopoverContent,
  PopoverTrigger,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Blocks,
  Bookmark,
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  FolderKanban,
  Forward,
  Link2,
  Link2Off,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
  SquareDot,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useLongPress } from '@org/hooks';
import { detectLinks, normalizeUrl } from './link-detector.js';
import { LinkPreviewCard } from './link-preview-card.js';
import { LinkPreviewSkeleton } from './link-preview-skeleton.js';
import { useMediaPreview } from '@org/media-preview';
import { MarkdownMessage } from './markdown-message.js';
import { reminderPresets } from './reminder-presets.js';
import { resolvePreviewVisibility, useLinkPreviewStore } from './use-link-preview.js';
import { UserProfileCard } from './user-profile-card.js';

export interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped?: boolean;
  senderBadge?: ReactNode;
  avatarSlot?: ReactNode;
  onReact?: (key: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Holds `WorkspacePermission.MODERATE_MESSAGES` — may delete this message even when it is not theirs. */
  canModerateMessages?: boolean;
  /** `WorkspacePolicy.messageEditWindowMinutes` — null/unset means unlimited (default). Only ever narrows when the message is own; never grants edit on someone else's. */
  editWindowMinutes?: number | null;
  onOpenThread?: () => void;
  threadReplyCount?: number;
  /** True when the thread has replies the reader has not caught up to. */
  threadHasUnread?: boolean;
  attachmentSlot?: ReactNode;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onCopyLink?: () => void;
  onCopyText?: () => void;
  onForward?: () => void;
  onAssignToMe?: () => void;
  onCreateTask?: () => void;
  onCreateDoc?: () => void;
  onAskAI?: () => void;
  onViewContext?: () => void;
  threadParticipants?: RoomMember[];
  lastReplyAt?: number;
  isHighlighted?: boolean;
  density?: 'comfy' | 'compact';
  /**
   * Display names that render as mention chips. Without them only single-word
   * `@handles` are recognised, which cuts a name like "Ana Ruiz" in half.
   */
  mentionNames?: string[];
  entityKind?: 'app' | 'doc' | 'task' | 'kanban' | 'agent' | 'thread';
  onRetry?: () => void;
  linkPreviewsEnabled?: boolean;
  workspacePolicy?: WorkspacePolicy;
  roomKind?: RoomKind;
  /** "Mark unread" from this message. Hidden when absent. */
  onMarkUnread?: () => void;
  /** "Remind me about this" — called with the chosen time. Hidden when absent. */
  onRemind?: (remindAt: Date) => void;
  /** Turns reply notifications for this message's thread off / on. */
  onToggleReplyNotifications?: () => void;
  /** Reply notifications for this message's thread are currently off. */
  replyNotificationsMuted?: boolean;
}

export function formatShortTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * The label a day divider carries — "Today", "Yesterday", or a full weekday
 * date. Shared by the inline `DateSeparator` and the floating day chip that
 * `MessageList` sticks to the top of the timeline, so the two never disagree.
 */
export function formatDaySeparatorLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatFullTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function GifMessage({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { openPreview } = useMediaPreview();

  const handleExpand = () => {
    openPreview([
      {
        id: url,
        url,
        name: title || 'GIF',
        mimeType: 'image/gif',
        category: 'image',
      },
    ]);
  };

  if (error) {
    return (
      <div className="mt-1.5 flex max-w-sm items-center gap-2 rounded-xl border border-border bg-surface-inset p-3 text-xs text-muted-foreground">
        <AlertTriangle className="size-4 text-destructive shrink-0" />
        <span className="truncate">Failed to load GIF ({title || 'media'})</span>
        <button
          type="button"
          onClick={() => setError(false)}
          className="ml-auto shrink-0 font-semibold underline hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleExpand}
      className="group/gif relative mt-1.5 max-w-sm cursor-pointer overflow-hidden rounded-xl border border-border bg-surface-inset shadow-md transition-transform hover:scale-[1.01]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleExpand();
        }
      }}
      aria-label={`GIF: ${title || 'animated image'}. Click to expand.`}
    >
      {!loaded && (
        <div className="h-48 w-72 max-w-full animate-pulse bg-muted/60" />
      )}
      <img
        src={url}
        alt={title || 'GIF'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'max-h-72 w-full object-cover transition-opacity duration-200',
          !loaded ? 'hidden' : 'block',
        )}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover/gif:opacity-100">
        <span className="truncate text-xs font-medium text-white">{title || 'GIF'}</span>
        <span className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">Click to expand</span>
      </div>
    </div>
  );
}

function StickerMessage({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="mt-1.5 flex max-w-xs items-center gap-2 rounded-lg border border-border/60 bg-surface/50 p-2 text-xs text-muted-foreground">
        <AlertTriangle className="size-3.5 text-warning-text shrink-0" />
        <span className="truncate">Failed to load sticker</span>
        <button
          type="button"
          onClick={() => setError(false)}
          className="ml-auto shrink-0 font-semibold underline hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="group/sticker relative mt-1 inline-block select-none"
      title={alt}
      aria-label={`Sticker: ${alt}`}
    >
      {!loaded && (
        <div className="size-32 rounded-xl animate-pulse bg-muted/40" />
      )}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'max-h-40 max-w-40 object-contain drop-shadow-sm transition-transform hover:scale-105',
          !loaded ? 'hidden' : 'block',
        )}
      />
    </div>
  );
}

export function ChatBubble({
  message,
  isOwn,
  isGrouped = false,
  senderBadge,
  avatarSlot,
  onReact,
  onReply,
  onEdit,
  onDelete,
  canModerateMessages = false,
  editWindowMinutes = null,
  onOpenThread,
  threadReplyCount,
  threadHasUnread = false,
  attachmentSlot,
  isPinned = false,
  onTogglePin,
  isSaved = false,
  onToggleSave,
  onCopyLink,
  onCopyText,
  onForward,
  onAssignToMe,
  onCreateTask,
  onCreateDoc,
  onAskAI,
  onViewContext,
  threadParticipants,
  lastReplyAt,
  isHighlighted = false,
  density = 'comfy',
  mentionNames,
  entityKind,
  onRetry,
  linkPreviewsEnabled = true,
  workspacePolicy,
  roomKind,
  onMarkUnread,
  onRemind,
  onToggleReplyNotifications,
  replyNotificationsMuted = false,
}: ChatBubbleProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionOpen, setIsReactionOpen] = useState(false);

  const messageOverrides = useLinkPreviewStore((s) => s.messageOverrides);
  const toggleMessageOverride = useLinkPreviewStore((s) => s.toggleMessageOverride);
  const fetchMessageVisibility = useLinkPreviewStore((s) => s.fetchMessageVisibility);
  const previewsMap = useLinkPreviewStore((s) => s.previews);
  const loadingUrls = useLinkPreviewStore((s) => s.loadingUrls);
  const fetchPreview = useLinkPreviewStore((s) => s.fetchPreview);

  const detectedLinks = useMemo(() => {
    if (message.isRedacted || !message.body) return [];
    return detectLinks(message.body);
  }, [message.body, message.isRedacted]);

  const hasLinkPreviews = Boolean(
    (message.linkPreviews && message.linkPreviews.length > 0) ||
      detectedLinks.length > 0,
  );

  useEffect(() => {
    if (!messageOverrides[message.id] && hasLinkPreviews) {
      void fetchMessageVisibility(message.id);
    }
  }, [message.id, hasLinkPreviews, messageOverrides, fetchMessageVisibility]);

  const isPreviewsVisible = resolvePreviewVisibility({
    messageId: message.id,
    messagePreviews: message.linkPreviews,
    messageOverrides,
    userChatPreferences:
      linkPreviewsEnabled !== undefined
        ? { linkPreviewsEnabled }
        : undefined,
    workspacePolicy,
  });

  useEffect(() => {
    if (!isPreviewsVisible) return;
    if (message.linkPreviews && message.linkPreviews.length > 0) return;
    for (const link of detectedLinks) {
      const norm = link.normalizedUrl || normalizeUrl(link.url);
      if (!previewsMap[norm] && !loadingUrls[norm]) {
        void fetchPreview(link.url);
      }
    }
  }, [isPreviewsVisible, message.linkPreviews, detectedLinks, previewsMap, loadingUrls, fetchPreview]);

  const previewsToRender = useMemo(() => {
    if (message.linkPreviews && message.linkPreviews.length > 0) {
      return message.linkPreviews;
    }
    return detectedLinks.map((link) => {
      const norm = link.normalizedUrl || normalizeUrl(link.url);
      return previewsMap[norm] ?? null;
    });
  }, [message.linkPreviews, detectedLinks, previewsMap]);
  /*
   * Touch has no hover, so the floating action toolbar is opened by a
   * long-press on the message instead. It stays up until a tap or scroll
   * outside the message, or until a menu it launched closes.
   */
  const [actionsPinned, setActionsPinned] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const longPress = useLongPress(() => setActionsPinned(true), {
    disabled: message.isRedacted,
  });

  useEffect(() => {
    if (!actionsPinned) return;
    const dismiss = (event: Event) => {
      if (isMenuOpen || isReactionOpen) return;
      if (
        event.type === 'pointerdown' &&
        articleRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setActionsPinned(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [actionsPinned, isMenuOpen, isReactionOpen]);

  if (message.isRedacted) {
    return (
      <div
        className={cn(
          'py-1 text-xs text-muted-foreground italic',
          density === 'compact' ? 'px-3 pl-11' : 'px-4 pl-14',
        )}
      >
        <p>This message was deleted.</p>
      </div>
    );
  }

  const isCompact = density === 'compact';

  const mediaMatch = message.body
    ? /^!\[(.*?)\]\((https?:\/\/.*?)\)$/.exec(message.body.trim())
    : null;
  const isSticker = mediaMatch
    ? mediaMatch[1].startsWith('sticker:') ||
      mediaMatch[2].includes('twemoji') ||
      mediaMatch[1].toLowerCase().includes('sticker')
    : false;
  const stickerAlt = isSticker && mediaMatch
    ? mediaMatch[1].replace(/^sticker:/i, '').trim()
    : '';
  const isMentioned = message.body
    ? /@(here|channel|everyone|\w+)/.test(message.body)
    : false;

  const isAgent =
    entityKind === 'agent' ||
    message.senderId.startsWith('agent-') ||
    message.senderId.includes('copilot') ||
    message.senderId.includes('codereview') ||
    message.senderId.includes('triage') ||
    message.senderId.includes('standup') ||
    message.senderId.includes('docs') ||
    message.senderId.includes('data') ||
    /\b(copilot|assistant|reviewer|standup|triage|bot|agent)\b/i.test(
      message.senderName,
    );

  const isDoc =
    entityKind === 'doc' ||
    message.senderId.includes('doc') ||
    /\b(docs|document|notion|wiki|specification|spec)\b/i.test(
      message.senderName,
    );

  const isTask =
    entityKind === 'task' ||
    message.senderId.includes('task') ||
    /\b(task|todo|issue|backlog)\b/i.test(message.senderName);

  const isKanban =
    entityKind === 'kanban' ||
    message.senderId.includes('card') ||
    message.senderId.includes('board') ||
    /\b(kanban|board|sprint|epic)\b/i.test(message.senderName);

  const isApp =
    !isAgent &&
    !isDoc &&
    !isTask &&
    !isKanban &&
    (entityKind === 'app' ||
      message.senderId.startsWith('app-') ||
      /\b(github|linear|sentry|jira|figma|gdrive|webhook|app)\b/i.test(
        message.senderName,
      ));

  const effectiveBadge =
    senderBadge ||
    (isAgent ? (
      <Badge
        variant="primary"
        className="py-0 h-4 font-bold tracking-wider gap-0.5 text-[9px] uppercase"
      >
        <Bot className="size-2.5 mr-0.5 inline-block" />
        <span>AI AGENT</span>
      </Badge>
    ) : isDoc ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider gap-0.5 border-info/30 bg-info/15 text-[9px] text-info-text uppercase"
      >
        <FileText className="size-2.5 mr-0.5 inline-block" />
        <span>DOC</span>
      </Badge>
    ) : isTask ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider gap-0.5 border-success/30 bg-success/15 text-[9px] text-success uppercase"
      >
        <CheckSquare className="size-2.5 mr-0.5 inline-block" />
        <span>TASK</span>
      </Badge>
    ) : isKanban ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider gap-0.5 border-warning/30 bg-warning/15 text-[9px] text-warning-text uppercase"
      >
        <FolderKanban className="size-2.5 mr-0.5 inline-block" />
        <span>KANBAN</span>
      </Badge>
    ) : isApp ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider gap-0.5 border-accent-violet/20 bg-accent-violet-soft text-[9px] text-accent-violet uppercase"
      >
        <Blocks className="size-2.5 mr-0.5 inline-block" />
        <span>APP</span>
      </Badge>
    ) : null);

  const canEdit =
    isOwn &&
    Boolean(onEdit) &&
    (editWindowMinutes == null ||
      Date.now() - message.timestamp < editWindowMinutes * 60_000);

  const canDelete = Boolean(onDelete) && (isOwn || canModerateMessages);
  const hasOrganizeItems = Boolean(onTogglePin || onAssignToMe || onViewContext);
  const hasAppItems = Boolean(onCreateTask || onCreateDoc || onAskAI);

  /** Closes the menu, then runs the action — every menu entry goes through this. */
  const runAction = (action: (() => void) | undefined) => {
    setIsMenuOpen(false);
    action?.();
  };

  /*
   * The letters shown beside menu items are real: with the menu open, E edits,
   * U marks unread, L copies the link and Delete deletes. Handled before Radix's
   * type-ahead (preventDefault stops it), so "e" never just moves the focus.
   */
  const handleMenuShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    const action =
      key === 'e' && canEdit
        ? onEdit
        : key === 'u'
          ? onMarkUnread
          : key === 'l'
            ? onCopyLink
            : (event.key === 'Delete' || event.key === 'Backspace') && canDelete
              ? onDelete
              : undefined;
    if (!action) return;
    event.preventDefault();
    runAction(action);
  };

  // Resolved when the menu opens, so "in 1 hour" is an hour from the click.
  const presets = isMenuOpen && onRemind ? reminderPresets() : [];
  const hasStateItems = Boolean(onMarkUnread || onRemind || onToggleReplyNotifications);
  const hasCopyItems = Boolean(onCopyLink || onCopyText || hasLinkPreviews);

  return (
    <article
      data-message-id={message.id}
      aria-label={`Message from ${message.senderName}, ${formatFullTimestamp(message.timestamp)}`}
      ref={articleRef}
      {...longPress}
      className={cn(
        'group/message relative flex transition-colors hover:bg-accent',
        actionsPinned && 'bg-accent',
        isCompact
          ? cn(
              'chat-density-compact gap-2.5 px-3',
              isGrouped ? 'py-0' : 'pt-1 pb-0.5',
            )
          : cn(
              'chat-density-comfy gap-4 px-4',
              isGrouped ? 'py-0.5' : 'pt-2.5 pb-0.5',
            ),
        isPinned && 'border-l-2 border-l-warning',
        (isHighlighted || isMentioned) && 'border-l-2 border-l-primary',
        message.sendState === 'sending' && 'opacity-70',
        message.sendState === 'failed' && 'bg-destructive/5',
      )}
    >
      {/* Avatar / Left Column with Profile Popover & Modal */}
      <div className={cn(isCompact ? 'w-8' : 'w-10', 'shrink-0')}>
        {isGrouped ? (
          <Hint label={formatFullTimestamp(message.timestamp)}>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className={cn(
                'hidden cursor-pointer whitespace-nowrap text-muted-foreground tabular-nums group-hover/message:block hover:underline',
                isCompact ? 'mt-0.5 text-[9px]' : 'mt-1 text-[10px]',
              )}
            >
              {new Date(message.timestamp).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </time>
          </Hint>
        ) : avatarSlot ? (
          avatarSlot
        ) : (
          <UserProfileCard
            userId={message.senderId}
            name={message.senderName}
            avatarUrl={message.senderAvatarUrl}
          >
            <UserAvatar
              name={message.senderName}
              src={message.senderAvatarUrl}
              seed={message.senderId}
              size={isCompact ? 'sm' : 'md'}
              className={cn(
                isCompact ? 'size-8' : 'size-10',
                'cursor-pointer rounded-full shadow-xs transition-transform hover:scale-105 hover:opacity-90',
                isAgent && 'ring-2 ring-primary/40',
                isApp && 'ring-2 ring-accent-violet/40',
                isDoc && 'ring-2 ring-info-text/40',
                (isTask || isKanban) && 'ring-2 ring-success/40',
              )}
            />
          </UserProfileCard>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1">
        {isPinned && !isGrouped ? (
          <p className="mb-1 gap-1 font-semibold flex items-center text-[11px] text-warning-text">
            <Pin className="size-3" aria-hidden />
            Pinned to this channel
          </p>
        ) : null}

        {!isGrouped ? (
          <header className="gap-2 flex items-baseline">
            <UserProfileCard
              userId={message.senderId}
              name={message.senderName}
              avatarUrl={message.senderAvatarUrl}
            >
              <span className="text-sm font-bold tracking-wide cursor-pointer text-foreground hover:underline">
                {message.senderName}
              </span>
            </UserProfileCard>

            {effectiveBadge ? (
              <span className="inline-flex items-center">{effectiveBadge}</span>
            ) : null}

            <Hint label={formatFullTimestamp(message.timestamp)}>
              <time
                dateTime={new Date(message.timestamp).toISOString()}
                className="font-medium cursor-pointer text-[11px] text-muted-foreground hover:underline"
              >
                {Date.now() - message.timestamp < 60_000
                  ? 'Just now'
                  : formatShortTimestamp(message.timestamp)}
              </time>
            </Hint>

            {message.isEncrypted ? (
              <Hint label="End-to-end encrypted">
                <Lock className="size-3 text-muted-foreground" aria-hidden />
              </Hint>
            ) : null}
            {isSaved ? (
              <Hint label="Saved for later">
                <Bookmark
                  className="size-3 fill-current text-primary-text"
                  aria-label="Saved for later"
                />
              </Hint>
            ) : null}
          </header>
        ) : null}

        {message.decryptionError ? (
          <p className="gap-1.5 py-0.5 text-sm flex items-center text-warning-text italic">
            <AlertTriangle className="size-3.5 shrink-0 text-warning-text" />
            {message.decryptionError}
          </p>
        ) : (
          <>
            {mediaMatch ? (
              isSticker ? (
                <StickerMessage url={mediaMatch[2]} alt={stickerAlt || 'Sticker'} />
              ) : (
                <GifMessage url={mediaMatch[2]} title={mediaMatch[1] || 'GIF'} />
              )
            ) : message.body ? (
              <MarkdownMessage
                text={message.body}
                mentionNames={mentionNames}
              />
            ) : null}
            {message.isEdited ? (
              <span className="ml-1 text-[11px] text-muted-foreground select-none">
                (edited)
              </span>
            ) : null}
            {message.sendState === 'sending' ? (
              <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground select-none">
                <Clock className="size-3 animate-spin" />
                <span>sending…</span>
              </span>
            ) : message.sendState === 'failed' ? (
              <span className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5" />
                <span>Failed to send.</span>
                {onRetry ? (
                  <button
                    onClick={onRetry}
                    className="font-semibold underline hover:text-destructive/80 cursor-pointer"
                  >
                    Retry
                  </button>
                ) : null}
              </span>
            ) : null}

            {/* Link Previews */}
            {isPreviewsVisible && hasLinkPreviews ? (
              <div className="mt-2 space-y-2">
                {previewsToRender.map((preview, idx) => {
                  if (!preview) {
                    return <LinkPreviewSkeleton key={detectedLinks[idx]?.url || idx} />;
                  }
                  if (preview.status === 'error') return null;
                  return (
                    <LinkPreviewCard
                      key={preview.url || idx}
                      preview={preview}
                      onRemove={() => {
                        void toggleMessageOverride(message.id, true);
                      }}
                    />
                  );
                })}
              </div>
            ) : null}

            {attachmentSlot}
          </>
        )}

        {/* In-Chat Action Bar for App, Doc, Task, Kanban, AI Agent */}
        {isAgent || isApp || isDoc || isTask || isKanban ? (
          <div className="mt-2 gap-1.5 pt-0.5 flex flex-wrap items-center">
            {isTask || isKanban ? (
              <>
                {onAssignToMe ? (
                  <button
                    onClick={onAssignToMe}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <UserCheck className="size-3 text-primary" />
                    <span>Assign to me</span>
                  </button>
                ) : null}
                {onCreateTask ? (
                  <button
                    onClick={onCreateTask}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <CheckSquare className="size-3 text-success" />
                    <span>Manage Task</span>
                  </button>
                ) : null}
              </>
            ) : null}

            {isDoc ? (
              <>
                {onCreateDoc ? (
                  <button
                    onClick={onCreateDoc}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-info/30 bg-info/10 text-info-text transition-colors hover:bg-info/20"
                  >
                    <FileText className="size-3 text-info-text" />
                    <span>Open Document</span>
                  </button>
                ) : null}
              </>
            ) : null}

            {isAgent ? (
              <>
                {onAskAI ? (
                  <button
                    onClick={onAskAI}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-primary/30 bg-primary/10 text-primary-text transition-colors hover:bg-primary/20"
                  >
                    <Bot className="size-3 text-primary" />
                    <span>Ask AI</span>
                  </button>
                ) : null}
                {onCreateTask ? (
                  <button
                    onClick={onCreateTask}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <CheckSquare className="size-3 text-success" />
                    <span>Create Task</span>
                  </button>
                ) : null}
                {onCreateDoc ? (
                  <button
                    onClick={onCreateDoc}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <FileText className="size-3 text-info-text" />
                    <span>Create Doc</span>
                  </button>
                ) : null}
              </>
            ) : null}

            {isApp ? (
              <>
                {onOpenThread ? (
                  <button
                    onClick={onOpenThread}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-accent-violet/30 bg-accent-violet/10 text-accent-violet transition-colors hover:bg-accent-violet/20"
                  >
                    <Reply className="size-3 text-accent-violet" />
                    <span>Reply in Thread</span>
                  </button>
                ) : null}
                {onCreateTask ? (
                  <button
                    onClick={onCreateTask}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex cursor-pointer items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <CheckSquare className="size-3 text-success" />
                    <span>Create Task</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {/* Discord Reactions Row */}
        {message.reactions.length > 0 ? (
          <ul className="mt-1.5 gap-1 flex flex-wrap">
            {message.reactions.map((reaction) => (
              <li key={reaction.key}>
                <button
                  type="button"
                  onClick={() => onReact?.(reaction.key)}
                  aria-pressed={reaction.reactedByMe}
                  aria-label={`${reaction.count} reaction${reaction.count === 1 ? '' : 's'} with ${reaction.key}${reaction.reactedByMe ? ' (you reacted)' : ''}`}
                  className={cn(
                    'gap-1.5 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border transition-colors',
                    reaction.reactedByMe
                      ? 'border-primary bg-primary/15 text-foreground shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span aria-hidden="true">{reaction.key}</span>
                  <span className="tabular-nums">{reaction.count}</span>
                </button>
              </li>
            ))}

            {onReact ? (
              <li>
                <ReactionPicker onSelect={onReact}>
                  <button
                    type="button"
                    aria-label="Add a reaction"
                    className="px-1.5 py-0.5 flex items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Smile className="size-3.5" aria-hidden="true" />
                  </button>
                </ReactionPicker>
              </li>
            ) : null}
          </ul>
        ) : null}

        {/* Thread replies summary */}
        {threadReplyCount && threadReplyCount > 0 ? (
          <button
            type="button"
            onClick={onOpenThread}
            className={cn(
              'mt-1.5 gap-2 px-2.5 py-1 text-xs font-semibold flex items-center rounded-md bg-surface text-info-text transition-colors hover:bg-accent hover:underline',
              threadHasUnread && 'ring-1 ring-info-text/30',
            )}
          >
            {threadHasUnread ? (
              <span
                className="size-1.5 shrink-0 rounded-full bg-info-text"
                aria-label="Unread replies"
              />
            ) : null}
            {threadParticipants && threadParticipants.length > 0 ? (
              <span className="-space-x-1.5 flex items-center">
                {threadParticipants.slice(0, 3).map((participant) => (
                  <UserAvatar
                    key={participant.userId}
                    name={participant.displayName}
                    src={participant.avatarUrl}
                    seed={participant.userId}
                    size="xs"
                    className="ring-2 ring-surface"
                  />
                ))}
              </span>
            ) : null}
            <span>
              {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
            </span>
            {lastReplyAt ? (
              <Hint label={formatFullTimestamp(lastReplyAt)}>
                <span className="text-[10px] text-muted-foreground">
                  Last reply {formatShortTimestamp(lastReplyAt)}
                </span>
              </Hint>
            ) : null}
          </button>
        ) : null}

        {/* Seen By / Read Receipts */}
        {!isAgent && message.readers && message.readers.length > 0 ? (
          <div className="mt-1 flex items-center">
            <SeenBy
              readers={message.readers}
              roomKind={roomKind}
              isOwn={isOwn}
            />
          </div>
        ) : null}

        {message.sendState === 'failed' ? (
          <Badge variant="destructive" className="mt-1">
            Failed to send
          </Badge>
        ) : null}
      </div>

      {/* Floating action toolbar — revealed on hover/focus (pointer), or
          long-press (touch, via `actionsPinned`). */}
      <div
        role="toolbar"
        aria-label="Message actions"
        className={cn(
          '-top-4.5 right-4 p-1 gap-1 absolute z-20 items-center rounded-xl border border-border/80 bg-surface-raised/95 backdrop-blur-sm shadow-md transition-all duration-200 ease-out hover:shadow-lg animate-in fade-in-0 zoom-in-95',
          isMenuOpen || isReactionOpen || actionsPinned
            ? 'flex'
            : 'hidden group-focus-within/message:flex group-hover/message:flex',
        )}
      >
        {onReact ? (
          <ReactionPicker
            onSelect={onReact}
            open={isReactionOpen}
            onOpenChange={(open) => {
              setIsReactionOpen(open);
              if (!open) setActionsPinned(false);
            }}
          >
            <button
              aria-label="Add a reaction"
              className="group/btn size-8 touch-target flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 ease-out hover:bg-accent hover:text-foreground hover:scale-105 active:scale-95"
            >
              <Smile className="size-4.5 transition-transform duration-200 ease-out group-hover/btn:scale-110 group-hover/btn:rotate-12" />
            </button>
          </ReactionPicker>
        ) : null}

        {onOpenThread ? (
          <Hint label="Reply in thread">
            <button
              aria-label="Reply in thread"
              onClick={() => {
                onOpenThread();
                setActionsPinned(false);
              }}
              className="group/btn size-8 touch-target flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 ease-out hover:bg-accent hover:text-foreground hover:scale-105 active:scale-95"
            >
              <MessageSquare className="size-4.5 transition-transform duration-200 ease-out group-hover/btn:scale-110 group-hover/btn:-rotate-6" />
            </button>
          </Hint>
        ) : null}

        {onReply || onOpenThread ? (
          <Hint label="Reply">
            <button
              aria-label="Reply"
              onClick={() => {
                (onReply ?? onOpenThread)?.();
                setActionsPinned(false);
              }}
              className="group/btn size-8 touch-target flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 ease-out hover:bg-accent hover:text-foreground hover:scale-105 active:scale-95"
            >
              <Reply className="size-4.5 transition-transform duration-200 ease-out group-hover/btn:scale-110 group-hover/btn:-translate-x-0.5" />
            </button>
          </Hint>
        ) : null}

        {onForward || onCopyLink ? (
          <Hint label="Forward message">
            <button
              aria-label="Forward message"
              onClick={() => {
                (onForward ?? onCopyLink)?.();
                setActionsPinned(false);
              }}
              className="group/btn size-8 touch-target flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 ease-out hover:bg-accent hover:text-foreground hover:scale-105 active:scale-95"
            >
              <Forward className="size-4.5 transition-transform duration-200 ease-out group-hover/btn:scale-110 group-hover/btn:translate-x-0.5" />
            </button>
          </Hint>
        ) : null}

        {onToggleSave ? (
          <Hint label={isSaved ? 'Remove from saved' : 'Save for later'}>
            <button
              aria-label={isSaved ? 'Remove from saved' : 'Save for later'}
              aria-pressed={isSaved}
              onClick={onToggleSave}
              className={cn(
                'group/btn size-8 touch-target flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 ease-out hover:bg-accent hover:text-foreground hover:scale-105 active:scale-95',
                isSaved && 'text-primary-text',
              )}
            >
              <Bookmark className={cn('size-4.5 transition-transform duration-200 ease-out group-hover/btn:scale-110', isSaved && 'fill-current')} />
            </button>
          </Hint>
        ) : null}

        <DropdownMenu
          open={isMenuOpen}
          onOpenChange={(open) => {
            setIsMenuOpen(open);
            if (!open) setActionsPinned(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More actions"
              className={cn(
                'group/btn size-8 touch-target flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 ease-out hover:bg-accent hover:text-foreground hover:scale-105 active:scale-95',
                isMenuOpen && 'bg-accent text-foreground',
              )}
            >
              <MoreHorizontal className="size-4.5 transition-transform duration-200 ease-out group-hover/btn:scale-110" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={4}
            collisionPadding={8}
            className="w-64"
            onKeyDown={handleMenuShortcut}
          >
            {canEdit ? (
              <DropdownMenuItem onSelect={() => runAction(onEdit)}>
                <Pencil />
                <span>Edit message</span>
                <DropdownMenuShortcut>E</DropdownMenuShortcut>
              </DropdownMenuItem>
            ) : null}

            {hasStateItems ? (
              <>
                {canEdit ? <DropdownMenuSeparator /> : null}
                {onToggleReplyNotifications ? (
                  <DropdownMenuItem onSelect={() => runAction(onToggleReplyNotifications)}>
                    {replyNotificationsMuted ? <Bell /> : <BellOff />}
                    <span>
                      {replyNotificationsMuted
                        ? 'Turn on notifications for replies'
                        : 'Turn off notifications for replies'}
                    </span>
                  </DropdownMenuItem>
                ) : null}
                {onMarkUnread ? (
                  <DropdownMenuItem onSelect={() => runAction(onMarkUnread)}>
                    <SquareDot />
                    <span>Mark unread</span>
                    <DropdownMenuShortcut>U</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ) : null}
                {onRemind ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Clock />
                      <span>Remind me about this</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {presets.map((preset) => (
                        <DropdownMenuItem
                          key={preset.id}
                          onSelect={() => runAction(() => onRemind(preset.at))}
                        >
                          <span>{preset.label}</span>
                          <span className="ml-auto pl-3 text-[11px] font-normal text-muted-foreground tabular-nums">
                            {preset.hint}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
              </>
            ) : null}

            {hasCopyItems ? (
              <>
                {canEdit || hasStateItems ? <DropdownMenuSeparator /> : null}
                {onCopyLink ? (
                  <DropdownMenuItem onSelect={() => runAction(onCopyLink)}>
                    <Link2 />
                    <span>Copy link</span>
                    <DropdownMenuShortcut>L</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ) : null}
                {onCopyText ? (
                  <DropdownMenuItem onSelect={() => runAction(onCopyText)}>
                    <Copy />
                    <span>Copy text</span>
                  </DropdownMenuItem>
                ) : null}
                {hasLinkPreviews ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      runAction(
                        () => void toggleMessageOverride(message.id, isPreviewsVisible),
                      )
                    }
                  >
                    {isPreviewsVisible ? <Link2Off /> : <Link2 />}
                    <span>{isPreviewsVisible ? 'Hide link preview' : 'Show link preview'}</span>
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}

            {hasOrganizeItems || hasAppItems ? <DropdownMenuSeparator /> : null}

            {hasOrganizeItems ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderKanban />
                  <span>Organize</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {onTogglePin ? (
                    <DropdownMenuItem onSelect={() => runAction(onTogglePin)}>
                      {isPinned ? <PinOff /> : <Pin />}
                      <span>{isPinned ? 'Unpin from channel' : 'Pin to channel'}</span>
                    </DropdownMenuItem>
                  ) : null}
                  {onAssignToMe ? (
                    <DropdownMenuItem onSelect={() => runAction(onAssignToMe)}>
                      <UserCheck />
                      <span>Assign to me</span>
                    </DropdownMenuItem>
                  ) : null}
                  {onViewContext ? (
                    <DropdownMenuItem onSelect={() => runAction(onViewContext)}>
                      <Link2 />
                      <span>View related context</span>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}

            {hasAppItems ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Blocks />
                  <span>Connect to apps</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {onCreateTask ? (
                    <DropdownMenuItem onSelect={() => runAction(onCreateTask)}>
                      <CheckSquare />
                      <span>Create task from message</span>
                    </DropdownMenuItem>
                  ) : null}
                  {onCreateDoc ? (
                    <DropdownMenuItem onSelect={() => runAction(onCreateDoc)}>
                      <FileText />
                      <span>Create document from message</span>
                    </DropdownMenuItem>
                  ) : null}
                  {onAskAI ? (
                    <DropdownMenuItem onSelect={() => runAction(onAskAI)}>
                      <Bot />
                      <span>Ask AI about message</span>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}

            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => runAction(onDelete)}>
                  <Trash2 />
                  <span>Delete message…</span>
                  {!isOwn ? (
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                      Moderator
                    </span>
                  ) : null}
                  <DropdownMenuShortcut className={!isOwn ? 'ml-0 pl-2' : undefined}>
                    Del
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export function ReactionPicker({
  onSelect,
  open,
  onOpenChange,
  children,
}: {
  onSelect: (key: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={4}
        collisionPadding={8}
        className="p-0 z-50 w-auto overflow-hidden border-border bg-popover text-popover-foreground shadow-overlay"
      >
        <div className="w-80 max-w-[calc(100vw-1rem)]">
          <EmojiPicker
            columns={8}
            showPreview={false}
            onEmojiSelect={(emoji) => {
              onSelect(emoji.emoji);
              onOpenChange?.(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface JumpToDatePickerProps {
  selectedDate?: Date;
  onSelectDate: (
    target:
      'today' | 'yesterday' | 'last_week' | 'last_month' | 'beginning' | string,
  ) => void;
  onClose?: () => void;
}

export function JumpToDatePicker({
  selectedDate = new Date(),
  onSelectDate,
  onClose,
}: JumpToDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const presets = [
    { label: 'Today', target: 'today', date: new Date() },
    { label: 'Yesterday', target: 'yesterday', date: subDays(new Date(), 1) },
    {
      label: 'Last 7 days',
      target: 'last_7_days',
      date: subDays(new Date(), 7),
    },
    {
      label: 'Last 30 days',
      target: 'last_30_days',
      date: subDays(new Date(), 30),
    },
    {
      label: 'Month to date',
      target: 'month_to_date',
      date: startOfMonth(new Date()),
    },
    {
      label: 'Last month',
      target: 'last_month',
      date: subMonths(startOfMonth(new Date()), 1),
    },
    {
      label: 'Year to date',
      target: 'year_to_date',
      date: startOfYear(new Date()),
    },
    {
      label: 'Last year',
      target: 'last_year',
      date: subYears(startOfYear(new Date()), 1),
    },
  ];

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border/80 bg-popover text-foreground shadow-overlay select-none">
      {/* Left Presets Column */}
      <div className="w-36 p-3 space-y-0.5 flex flex-col justify-center border-r border-border/60 bg-surface-inset/30">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              onSelectDate(preset.target);
              onClose?.();
            }}
            className="px-2.5 py-1.5 text-xs font-semibold w-full cursor-pointer rounded-lg text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Right Calendar Column */}
      <div className="p-4 w-[280px]">
        {/* Month & Year Navigation Header */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 cursor-pointer rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-bold text-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 cursor-pointer rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="mb-2 grid grid-cols-7 text-center">
          {weekDays.map((day) => (
            <span
              key={day}
              className="font-medium text-[11px] text-muted-foreground"
            >
              {day}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="gap-y-1 grid grid-cols-7 text-center">
          {days.map((day) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className="p-0.5 flex items-center justify-center"
              >
                <button
                  type="button"
                  onClick={() => {
                    const formatted = format(day, 'yyyy-MM-dd');
                    onSelectDate(formatted);
                    onClose?.();
                  }}
                  className={cn(
                    'size-7 text-xs font-medium flex cursor-pointer items-center justify-center rounded-lg transition-all',
                    !isCurrentMonth &&
                      'text-muted-foreground/30 hover:text-muted-foreground/60',
                    isCurrentMonth &&
                      !isSelected &&
                      'text-foreground hover:bg-accent',
                    isCurrentDay &&
                      !isSelected &&
                      'font-semibold text-primary ring-1 ring-primary/40',
                    isSelected &&
                      'font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary-hover',
                  )}
                >
                  {format(day, 'd')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface DateSeparatorProps {
  timestamp: number;
  onJumpToDate?: (
    target:
      'today' | 'yesterday' | 'last_week' | 'last_month' | 'beginning' | string,
  ) => void;
}

export function DateSeparator({ timestamp, onJumpToDate }: DateSeparatorProps) {
  const [open, setOpen] = useState(false);
  const date = new Date(timestamp);
  const label = formatDaySeparatorLabel(timestamp);

  return (
    <div className="top-0 my-2 gap-3 px-4 py-1 sticky z-10 flex items-center">
      <span className="h-px flex-1 bg-border" aria-hidden />

      {/* Date Dropdown Trigger Button with Dual Panel Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="gap-1.5 px-4 py-1.5 text-xs font-semibold flex cursor-pointer items-center rounded-full border border-border bg-surface text-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>{label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={6}
          className="p-0 w-auto border-0 bg-transparent shadow-none"
        >
          <JumpToDatePicker
            selectedDate={date}
            onSelectDate={(target) => {
              onJumpToDate?.(target);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

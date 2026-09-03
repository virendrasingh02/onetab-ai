import type { Message, RoomMember } from '@org/types';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Blocks,
  Bookmark,
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  FolderKanban,
  Forward,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
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
import { useState, type ReactNode } from 'react';
import { MarkdownMessage } from './markdown-message.js';
import { UserProfileCard } from './user-profile-card.js';

const QUICK_REACTIONS = ['👍', '❤️', '🔥'];

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
}

export function formatShortTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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
  threadParticipants,
  lastReplyAt,
  isHighlighted = false,
  density = 'comfy',
  mentionNames,
  entityKind,
}: ChatBubbleProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionOpen, setIsReactionOpen] = useState(false);

  if (message.isRedacted) {
    return (
      <div
        className={cn(
          'py-1 italic text-muted-foreground text-xs',
          density === 'compact' ? 'px-3 pl-11' : 'px-4 pl-14',
        )}
      >
        <p>This message was deleted.</p>
      </div>
    );
  }

  const isCompact = density === 'compact';

  const gifMatch = message.body
    ? /^!\[(.*?)\]\((https?:\/\/.*?)\)$/.exec(message.body.trim())
    : null;
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
        className="py-0 h-4 font-bold tracking-wider bg-info/15 text-info-text border-info/30 gap-0.5 text-[9px] uppercase"
      >
        <FileText className="size-2.5 mr-0.5 inline-block" />
        <span>DOC</span>
      </Badge>
    ) : isTask ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider bg-success/15 text-success border-success/30 gap-0.5 text-[9px] uppercase"
      >
        <CheckSquare className="size-2.5 mr-0.5 inline-block" />
        <span>TASK</span>
      </Badge>
    ) : isKanban ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider bg-warning/15 text-warning-text border-warning/30 gap-0.5 text-[9px] uppercase"
      >
        <FolderKanban className="size-2.5 mr-0.5 inline-block" />
        <span>KANBAN</span>
      </Badge>
    ) : isApp ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider bg-accent-violet-soft text-accent-violet border-accent-violet/20 gap-0.5 text-[9px] uppercase"
      >
        <Blocks className="size-2.5 mr-0.5 inline-block" />
        <span>APP</span>
      </Badge>
    ) : null);

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/message relative flex transition-colors hover:bg-accent',
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
      )}
    >
      {/* Avatar / Left Column with Profile Popover & Modal */}
      <div className={cn(isCompact ? 'w-8' : 'w-10', 'shrink-0')}>
        {isGrouped ? (
          <Hint label={formatFullTimestamp(message.timestamp)}>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className={cn(
                'hidden cursor-pointer text-muted-foreground tabular-nums group-hover/message:block hover:underline',
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
                isApp && 'ring-accent-violet/40 ring-2',
                isDoc && 'ring-info-text/40 ring-2',
                (isTask || isKanban) && 'ring-success/40 ring-2',
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
            {gifMatch ? (
              <div className="mt-1.5 max-w-sm overflow-hidden rounded-xl border border-border bg-surface-inset shadow-md">
                <img
                  src={gifMatch[2]}
                  alt={gifMatch[1] || 'GIF'}
                  className="max-h-72 w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : message.body ? (
              <MarkdownMessage
                text={message.body}
                mentionNames={mentionNames}
              />
            ) : null}
            {attachmentSlot}
          </>
        )}

        {/* In-Chat Action Bar for App, Doc, Task, Kanban, AI Agent */}
        {(isAgent || isApp || isDoc || isTask || isKanban) ? (
          <div className="mt-2 gap-1.5 flex flex-wrap items-center pt-0.5">
            {isTask || isKanban ? (
              <>
                {onAssignToMe ? (
                  <button
                    onClick={onAssignToMe}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                  >
                    <UserCheck className="size-3 text-primary" />
                    <span>Assign to me</span>
                  </button>
                ) : null}
                {onCreateTask ? (
                  <button
                    onClick={onCreateTask}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
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
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-info/30 bg-info/10 text-info-text hover:bg-info/20 transition-colors cursor-pointer"
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
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-primary/30 bg-primary/10 text-primary-text hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <Bot className="size-3 text-primary" />
                    <span>Ask AI</span>
                  </button>
                ) : null}
                {onCreateTask ? (
                  <button
                    onClick={onCreateTask}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                  >
                    <CheckSquare className="size-3 text-success" />
                    <span>Create Task</span>
                  </button>
                ) : null}
                {onCreateDoc ? (
                  <button
                    onClick={onCreateDoc}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
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
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-accent-violet/30 bg-accent-violet/10 text-accent-violet hover:bg-accent-violet/20 transition-colors cursor-pointer"
                  >
                    <Reply className="size-3 text-accent-violet" />
                    <span>Reply in Thread</span>
                  </button>
                ) : null}
                {onCreateTask ? (
                  <button
                    onClick={onCreateTask}
                    className="gap-1 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
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
                  onClick={() => onReact?.(reaction.key)}
                  aria-pressed={reaction.reactedByMe}
                  className={cn(
                    'gap-1.5 px-2 py-0.5 text-xs font-semibold flex items-center rounded-md border transition-colors',
                    reaction.reactedByMe
                      ? 'border-primary bg-primary/15 text-foreground shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span aria-hidden>{reaction.key}</span>
                  <span className="tabular-nums">{reaction.count}</span>
                </button>
              </li>
            ))}

            {onReact ? (
              <li>
                <ReactionPicker onSelect={onReact}>
                  <button
                    aria-label="Add a reaction"
                    className="px-1.5 py-0.5 flex items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Smile className="size-3.5" aria-hidden />
                  </button>
                </ReactionPicker>
              </li>
            ) : null}
          </ul>
        ) : null}

        {/* Thread replies summary */}
        {threadReplyCount && threadReplyCount > 0 ? (
          <button
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

        {message.sendState === 'failed' ? (
          <Badge variant="destructive" className="mt-1">
            Failed to send
          </Badge>
        ) : null}
      </div>

      {/* Floating Hover Toolbar */}
      <div
        className={cn(
          '-top-3.5 right-4 p-0.5 absolute z-20 items-center rounded-lg border border-border bg-surface-raised shadow-lg',
          isMenuOpen || isReactionOpen
            ? 'flex'
            : 'hidden group-focus-within/message:flex group-hover/message:flex',
        )}
      >
        {onReact
          ? QUICK_REACTIONS.map((emoji) => (
              <Hint key={emoji} label={`React with ${emoji}`}>
                <button
                  onClick={() => onReact(emoji)}
                  aria-label={`React with ${emoji}`}
                  className="size-7 text-sm flex items-center justify-center rounded-md transition-colors hover:bg-accent"
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              </Hint>
            ))
          : null}

        {onReact ? (
          <ReactionPicker
            onSelect={onReact}
            open={isReactionOpen}
            onOpenChange={setIsReactionOpen}
          >
            <button
              aria-label="Add a reaction"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Smile className="size-4" />
            </button>
          </ReactionPicker>
        ) : null}

        <Hint label="Reply in thread">
          <button
            aria-label="Reply in thread"
            onClick={onOpenThread ?? onReply}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Reply className="size-4" />
          </button>
        </Hint>

        {onToggleSave ? (
          <Hint label={isSaved ? 'Remove from saved' : 'Save for later'}>
            <button
              aria-label={isSaved ? 'Remove from saved' : 'Save for later'}
              aria-pressed={isSaved}
              onClick={onToggleSave}
              className={cn(
                'size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isSaved && 'text-primary-text',
              )}
            >
              <Bookmark className={cn('size-4', isSaved && 'fill-current')} />
            </button>
          </Hint>
        ) : null}

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More actions"
              className={cn(
                'size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isMenuOpen && 'bg-accent text-foreground',
              )}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={4}
            collisionPadding={8}
            className="w-56 border-border bg-popover text-popover-foreground z-50 shadow-overlay"
          >
            <DropdownMenuItem
              onSelect={() => {
                setIsMenuOpen(false);
                onOpenThread?.();
              }}
              className="hover:bg-accent"
            >
              <Reply className="mr-2 size-4" />
              Reply in thread
            </DropdownMenuItem>
            {onForward ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onForward();
                }}
                className="hover:bg-accent"
              >
                <Forward className="mr-2 size-4" />
                Forward message
              </DropdownMenuItem>
            ) : null}
            {onToggleSave ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onToggleSave();
                }}
                className="hover:bg-accent"
              >
                <Bookmark className="mr-2 size-4" />
                {isSaved ? 'Remove from saved' : 'Save for later'}
              </DropdownMenuItem>
            ) : null}
            {onTogglePin ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onTogglePin();
                }}
                className="cursor-pointer hover:bg-accent"
              >
                {isPinned ? (
                  <PinOff className="mr-2 size-4" />
                ) : (
                  <Pin className="mr-2 size-4" />
                )}
                {isPinned ? 'Unpin from channel' : 'Pin to channel'}
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator className="bg-border" />

            {onAssignToMe ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onAssignToMe();
                }}
                className="cursor-pointer hover:bg-accent"
              >
                <UserCheck className="mr-2 size-4 text-primary" />
                Assign to me
              </DropdownMenuItem>
            ) : null}

            {onCreateTask ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onCreateTask();
                }}
                className="cursor-pointer hover:bg-accent"
              >
                <CheckSquare className="mr-2 size-4 text-success" />
                Create task from message
              </DropdownMenuItem>
            ) : null}
            {onCreateDoc ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onCreateDoc();
                }}
                className="cursor-pointer hover:bg-accent"
              >
                <FileText className="mr-2 size-4 text-info-text" />
                Create document from message
              </DropdownMenuItem>
            ) : null}
            {onAskAI ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onAskAI();
                }}
                className="cursor-pointer hover:bg-accent"
              >
                <Bot className="mr-2 size-4 text-primary" />
                Ask AI about message
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator className="bg-border" />

            {onCopyText ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onCopyText();
                }}
                className="hover:bg-accent"
              >
                <Copy className="mr-2 size-4" />
                Copy text
              </DropdownMenuItem>
            ) : null}
            {onCopyLink ? (
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  onCopyLink();
                }}
                className="hover:bg-accent"
              >
                <Link2 className="mr-2 size-4" />
                Copy link to message
              </DropdownMenuItem>
            ) : null}

            {isOwn ? (
              <>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onSelect={() => {
                    setIsMenuOpen(false);
                    onEdit?.();
                  }}
                  className="hover:bg-accent"
                >
                  <Pencil className="mr-2 size-4" />
                  Edit message
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setIsMenuOpen(false);
                    onDelete?.();
                  }}
                  className="hover:bg-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete message
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
        className="border-border bg-popover text-popover-foreground z-50 w-auto overflow-hidden p-0 shadow-overlay"
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
      | 'today'
      | 'yesterday'
      | 'last_week'
      | 'last_month'
      | 'beginning'
      | string,
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
    { label: 'Last 7 days', target: 'last_7_days', date: subDays(new Date(), 7) },
    { label: 'Last 30 days', target: 'last_30_days', date: subDays(new Date(), 30) },
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
    <div className="flex bg-popover border border-border/80 text-foreground rounded-2xl shadow-overlay overflow-hidden select-none">
      {/* Left Presets Column */}
      <div className="w-36 p-3 space-y-0.5 border-r border-border/60 flex flex-col justify-center bg-surface-inset/30">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              onSelectDate(preset.target);
              onClose?.();
            }}
            className="w-full px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
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
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
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
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
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
                className="flex items-center justify-center p-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    const formatted = format(day, 'yyyy-MM-dd');
                    onSelectDate(formatted);
                    onClose?.();
                  }}
                  className={cn(
                    'size-7 text-xs flex items-center justify-center rounded-lg transition-all cursor-pointer font-medium',
                    !isCurrentMonth &&
                      'text-muted-foreground/30 hover:text-muted-foreground/60',
                    isCurrentMonth &&
                      !isSelected &&
                      'text-foreground hover:bg-accent',
                    isCurrentDay &&
                      !isSelected &&
                      'text-primary font-semibold ring-1 ring-primary/40',
                    isSelected &&
                      'bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary-hover',
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
      | 'today'
      | 'yesterday'
      | 'last_week'
      | 'last_month'
      | 'beginning'
      | string,
  ) => void;
}

export function DateSeparator({ timestamp, onJumpToDate }: DateSeparatorProps) {
  const [open, setOpen] = useState(false);
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);

  const label =
    date.toDateString() === today.toDateString()
      ? 'Today'
      : date.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : date.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

  return (
    <div className="top-0 my-2 gap-3 px-4 py-1 sticky z-10 flex items-center">
      <span className="h-px flex-1 bg-border" aria-hidden />

      {/* Date Dropdown Trigger Button with Dual Panel Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="gap-1.5 px-4 py-1.5 text-xs font-semibold flex items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer shadow-xs"
          >
            <span>{label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={6}
          className="p-0 border-0 bg-transparent shadow-none w-auto"
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

import type { Message, RoomMember } from '@org/types';
import {
  Badge,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronDown,
  Copy,
  FileText,
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
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { MarkdownMessage } from './markdown-message.js';
import { UserProfileCard } from './user-profile-card.js';

const QUICK_REACTIONS = ['👍', '❤️', '🔥'];

const PICKER_REACTIONS = [
  '👍',
  '👎',
  '❤️',
  '🎉',
  '😄',
  '😮',
  '😢',
  '🙏',
  '🔥',
  '👀',
  '✅',
  '🚀',
  '💯',
  '🤔',
  '👏',
  '🐛',
  '📌',
  '☕',
];

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
  attachmentSlot?: ReactNode;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onCopyLink?: () => void;
  onCopyText?: () => void;
  onForward?: () => void;
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
  attachmentSlot,
  isPinned = false,
  onTogglePin,
  isSaved = false,
  onToggleSave,
  onCopyLink,
  onCopyText,
  onForward,
  onCreateTask,
  onCreateDoc,
  onAskAI,
  threadParticipants,
  lastReplyAt,
  isHighlighted = false,
  density = 'comfy',
  mentionNames,
}: ChatBubbleProps) {
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

  const isApp =
    !isAgent &&
    (message.senderId.startsWith('app-') ||
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
    ) : isApp ? (
      <Badge
        variant="neutral"
        className="py-0 h-4 font-bold tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 gap-0.5 text-[9px] uppercase"
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
                isApp && 'ring-violet-500/40 ring-2',
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
                      ? /* `primary-foreground` is the deep green that rides the
                         solid mint fill; over a 15% tint it would vanish in
                         dark mode, so the tinted chip keeps body-text ink and
                         lets the border carry the "you reacted" signal. */
                        'border-primary bg-primary/15 text-foreground shadow-xs'
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
            className="mt-1.5 gap-2 px-2.5 py-1 text-xs font-semibold flex items-center rounded-md bg-surface text-info-text transition-colors hover:bg-accent hover:underline"
          >
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
          '-top-3.5 right-4 p-0.5 absolute z-20 hidden items-center rounded-lg border border-border bg-surface-raised shadow-lg',
          'group-focus-within/message:flex group-hover/message:flex',
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
          <ReactionPicker onSelect={onReact}>
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More actions"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 border-border bg-surface text-foreground"
          >
            <DropdownMenuItem
              onSelect={() => onOpenThread?.()}
              className="hover:bg-accent"
            >
              <Reply className="mr-2 size-4" />
              Reply in thread
            </DropdownMenuItem>
            {onForward ? (
              <DropdownMenuItem
                onSelect={() => onForward()}
                className="hover:bg-accent"
              >
                <Forward className="mr-2 size-4" />
                Forward message
              </DropdownMenuItem>
            ) : null}
            {onToggleSave ? (
              <DropdownMenuItem
                onSelect={() => onToggleSave()}
                className="hover:bg-accent"
              >
                <Bookmark className="mr-2 size-4" />
                {isSaved ? 'Remove from saved' : 'Save for later'}
              </DropdownMenuItem>
            ) : null}
            {onTogglePin ? (
              <DropdownMenuItem
                onSelect={() => onTogglePin()}
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

            {onCreateTask ? (
              <DropdownMenuItem
                onSelect={() => onCreateTask()}
                className="cursor-pointer hover:bg-accent"
              >
                <CheckSquare className="mr-2 size-4 text-emerald-500" />
                Create task from message
              </DropdownMenuItem>
            ) : null}
            {onCreateDoc ? (
              <DropdownMenuItem
                onSelect={() => onCreateDoc()}
                className="cursor-pointer hover:bg-accent"
              >
                <FileText className="mr-2 size-4 text-blue-500" />
                Create document from message
              </DropdownMenuItem>
            ) : null}
            {onAskAI ? (
              <DropdownMenuItem
                onSelect={() => onAskAI()}
                className="cursor-pointer hover:bg-accent"
              >
                <Bot className="mr-2 size-4 text-primary" />
                Ask AI about message
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator className="bg-border" />

            {onCopyText ? (
              <DropdownMenuItem
                onSelect={() => onCopyText()}
                className="hover:bg-accent"
              >
                <Copy className="mr-2 size-4" />
                Copy text
              </DropdownMenuItem>
            ) : null}
            {onCopyLink ? (
              <DropdownMenuItem
                onSelect={() => onCopyLink()}
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
                  onSelect={() => onEdit?.()}
                  className="hover:bg-accent"
                >
                  <Pencil className="mr-2 size-4" />
                  Edit message
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete?.()}
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
  children,
}: {
  onSelect: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="p-2 w-auto border-border bg-surface text-foreground"
      >
        <p className="mb-1 px-1 font-bold tracking-wider text-[10px] text-muted-foreground uppercase">
          React
        </p>
        <div className="gap-0.5 grid grid-cols-6">
          {PICKER_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              aria-label={`React with ${emoji}`}
              className="size-8 rounded text-lg flex items-center justify-center transition-transform hover:scale-125 hover:bg-accent"
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
  const [customDate, setCustomDate] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

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

      {/* Date Dropdown Trigger Button */}
      <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="gap-1.5 px-4 py-1.5 text-xs font-semibold flex items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>{label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-56 p-1.5 shadow-2xl border-border bg-surface-inset text-foreground"
        >
          <DropdownMenuLabel className="px-2 py-1 font-bold text-[11px] text-muted-foreground">
            Jump to...
          </DropdownMenuLabel>

          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('today')}
            className="px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-md hover:bg-accent"
          >
            Today
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('yesterday')}
            className="px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-md hover:bg-accent"
          >
            Yesterday
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('last_week')}
            className="px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-md hover:bg-accent"
          >
            Last week
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('last_month')}
            className="px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-md hover:bg-accent"
          >
            Last month
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('beginning')}
            className="px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-md hover:bg-accent"
          >
            The very beginning
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-border" />

          <div className="p-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="gap-2 px-2 py-1.5 text-xs font-medium flex w-full items-center rounded-md text-primary-text transition-colors hover:bg-primary/20"
                >
                  <CalendarIcon className="size-3.5" />
                  <span>Jump to a specific date</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                className="p-3 w-auto border-border bg-surface text-foreground"
              >
                <p className="mb-2 text-xs font-bold text-muted-foreground">
                  Select date
                </p>
                <DatePicker
                  value={customDate}
                  onChange={(d) => {
                    if (d) {
                      setCustomDate(d);
                      onJumpToDate?.(d);
                      setPickerOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

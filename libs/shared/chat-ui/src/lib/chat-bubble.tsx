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
  Bookmark,
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronDown,
  Copy,
  Forward,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
  Square,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { UserProfileCard } from './user-profile-card.js';

const QUICK_REACTIONS = ['👍', '❤️', '🔥'];

const PICKER_REACTIONS = [
  '👍', '👎', '❤️', '🎉', '😄', '😮',
  '😢', '🙏', '🔥', '👀', '✅', '🚀',
  '💯', '🤔', '👏', '🐛', '📌', '☕',
];

export interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped?: boolean;
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
  threadParticipants?: RoomMember[];
  lastReplyAt?: number;
  isHighlighted?: boolean;
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

function FormattedMessageBody({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1 text-sm leading-relaxed text-foreground break-words">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (/^\[([ xX])\]\s+(.*)/.test(trimmed)) {
          const m = /^\[([ xX])\]\s+(.*)/.exec(trimmed)!;
          const isChecked = m[1].toLowerCase() === 'x';
          return (
            <div key={lineIdx} className="flex items-center gap-2 text-xs py-0.5">
              {isChecked ? (
                <CheckSquare className="size-4 text-success-text shrink-0" />
              ) : (
                <Square className="size-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(isChecked && 'line-through text-muted-foreground')}>
                {m[2]}
              </span>
            </div>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={lineIdx}
              className="my-1 rounded-r border-l-4 border-primary bg-surface-inset/60 py-1 pl-3 text-xs italic text-foreground"
            >
              {trimmed.slice(2)}
            </blockquote>
          );
        }

        if (/^[-•]\s+(.*)/.test(trimmed)) {
          const content = trimmed.replace(/^[-•]\s+/, '');
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2 text-xs">
              <span className="text-primary-text">•</span>
              <span>{content}</span>
            </div>
          );
        }

        const parts = line.split(/(?=@\w+)|(?<=\b)/);

        return (
          <p key={lineIdx} className="whitespace-pre-wrap">
            {parts.map((part, partIdx) => {
              if (/^@(\w+)/.test(part)) {
                return (
                  <span
                    key={partIdx}
                    className="inline-flex items-center rounded border border-primary/40 bg-primary/20 px-1.5 py-0.5 font-semibold text-primary-text transition-colors hover:bg-primary/30 cursor-pointer"
                  >
                    {part}
                  </span>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function ChatBubble({
  message,
  isOwn,
  isGrouped = false,
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
  threadParticipants,
  lastReplyAt,
  isHighlighted = false,
}: ChatBubbleProps) {
  if (message.isRedacted) {
    return (
      <div className="px-4 py-1 pl-14">
        <p className="text-xs text-muted-foreground italic">
          This message was deleted.
        </p>
      </div>
    );
  }

  const gifMatch = message.body ? /^!\[(.*?)\]\((https?:\/\/.*?)\)$/.exec(message.body.trim()) : null;
  const isMentioned = message.body ? /@(here|channel|everyone|\w+)/.test(message.body) : false;

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/message relative flex gap-4 px-4 transition-colors',
        'hover:bg-accent',
        isGrouped ? 'py-0.5' : 'pt-2.5 pb-0.5',
        isPinned && 'border-l-2 border-l-warning',
        (isHighlighted || isMentioned) && 'border-l-2 border-l-primary',
      )}
    >
      {/* Avatar / Left Column with Profile Popover & Modal */}
      <div className="w-10 shrink-0">
        {isGrouped ? (
          <Hint label={formatFullTimestamp(message.timestamp)}>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="mt-1 hidden text-[10px] text-muted-foreground tabular-nums group-hover/message:block cursor-pointer hover:underline"
            >
              {new Date(message.timestamp).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </time>
          </Hint>
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
              size="md"
              className="size-10 rounded-full hover:opacity-90 cursor-pointer shadow-xs transition-transform hover:scale-105"
            />
          </UserProfileCard>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1">
        {isPinned && !isGrouped ? (
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-warning-text">
            <Pin className="size-3" aria-hidden />
            Pinned to this channel
          </p>
        ) : null}

        {!isGrouped ? (
          <header className="flex items-baseline gap-2">
            <UserProfileCard
              userId={message.senderId}
              name={message.senderName}
              avatarUrl={message.senderAvatarUrl}
            >
              <span className="text-sm font-bold text-foreground hover:underline cursor-pointer tracking-wide">
                {message.senderName}
              </span>
            </UserProfileCard>

            <Hint label={formatFullTimestamp(message.timestamp)}>
              <time
                dateTime={new Date(message.timestamp).toISOString()}
                className="text-[11px] font-medium text-muted-foreground cursor-pointer hover:underline"
              >
                {formatShortTimestamp(message.timestamp)}
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
          <p className="flex items-center gap-1.5 py-0.5 text-sm italic text-warning-text">
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
              <FormattedMessageBody text={message.body} />
            ) : null}
            {attachmentSlot}
          </>
        )}

        {/* Discord Reactions Row */}
        {message.reactions.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <li key={reaction.key}>
                <button
                  onClick={() => onReact?.(reaction.key)}
                  aria-pressed={reaction.reactedByMe}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
                    reaction.reactedByMe
                      /* `primary-foreground` is the deep green that rides the
                         solid mint fill; over a 15% tint it would vanish in
                         dark mode, so the tinted chip keeps body-text ink and
                         lets the border carry the "you reacted" signal. */
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
                    className="flex items-center rounded-md border border-border bg-surface px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
            className="mt-1.5 flex items-center gap-2 rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-info-text transition-colors hover:bg-accent hover:underline"
          >
            {threadParticipants && threadParticipants.length > 0 ? (
              <span className="flex items-center -space-x-1.5">
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
          'absolute -top-3.5 right-4 z-20 hidden items-center rounded-lg border border-border bg-surface-raised p-0.5 shadow-lg',
          'group-focus-within/message:flex group-hover/message:flex',
        )}
      >
        {onReact
          ? QUICK_REACTIONS.map((emoji) => (
              <Hint key={emoji} label={`React with ${emoji}`}>
                <button
                  onClick={() => onReact(emoji)}
                  aria-label={`React with ${emoji}`}
                  className="flex size-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent"
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
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Smile className="size-4" />
            </button>
          </ReactionPicker>
        ) : null}

        <Hint label="Reply in thread">
          <button
            aria-label="Reply in thread"
            onClick={onOpenThread ?? onReply}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
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
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-surface text-foreground border-border">
            <DropdownMenuItem onSelect={() => onOpenThread?.()} className="hover:bg-accent">
              <Reply className="mr-2 size-4" />
              Reply in thread
            </DropdownMenuItem>
            {onForward ? (
              <DropdownMenuItem onSelect={() => onForward()} className="hover:bg-accent">
                <Forward className="mr-2 size-4" />
                Forward message
              </DropdownMenuItem>
            ) : null}
            {onToggleSave ? (
              <DropdownMenuItem onSelect={() => onToggleSave()} className="hover:bg-accent">
                <Bookmark className="mr-2 size-4" />
                {isSaved ? 'Remove from saved' : 'Save for later'}
              </DropdownMenuItem>
            ) : null}
            {onTogglePin ? (
              <DropdownMenuItem onSelect={() => onTogglePin()} className="hover:bg-accent">
                {isPinned ? <PinOff className="mr-2 size-4" /> : <Pin className="mr-2 size-4" />}
                {isPinned ? 'Unpin from channel' : 'Pin to channel'}
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator className="bg-border" />

            {onCopyText ? (
              <DropdownMenuItem onSelect={() => onCopyText()} className="hover:bg-accent">
                <Copy className="mr-2 size-4" />
                Copy text
              </DropdownMenuItem>
            ) : null}
            {onCopyLink ? (
              <DropdownMenuItem onSelect={() => onCopyLink()} className="hover:bg-accent">
                <Link2 className="mr-2 size-4" />
                Copy link to message
              </DropdownMenuItem>
            ) : null}

            {isOwn ? (
              <>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onSelect={() => onEdit?.()} className="hover:bg-accent">
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
      <PopoverContent align="end" className="w-auto border-border bg-surface p-2 text-foreground">
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          React
        </p>
        <div className="grid grid-cols-6 gap-0.5">
          {PICKER_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              aria-label={`React with ${emoji}`}
              className="flex size-8 items-center justify-center rounded text-lg transition-transform hover:scale-125 hover:bg-accent"
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
  onJumpToDate?: (target: 'today' | 'yesterday' | 'last_week' | 'last_month' | 'beginning' | string) => void;
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
    <div className="sticky top-0 z-10 my-2 flex items-center gap-3 px-4 py-1">
      <span className="h-px flex-1 bg-border" aria-hidden />

      {/* Date Dropdown Trigger Button */}
      <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-foreground shadow-sm"
          >
            <span>{label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56 border-border bg-surface-inset p-1.5 text-foreground shadow-2xl">
          <DropdownMenuLabel className="px-2 py-1 text-[11px] font-bold text-muted-foreground">
            Jump to...
          </DropdownMenuLabel>

          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('today')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer"
          >
            Today
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('yesterday')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer"
          >
            Yesterday
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('last_week')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer"
          >
            Last week
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('last_month')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer"
          >
            Last month
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onJumpToDate?.('beginning')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer"
          >
            The very beginning
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-border" />

          <div className="p-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-primary-text hover:bg-primary/20 transition-colors"
                >
                  <CalendarIcon className="size-3.5" />
                  <span>Jump to a specific date</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto border-border bg-surface p-3 text-foreground">
                <p className="mb-2 text-xs font-bold text-muted-foreground">Select date</p>
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

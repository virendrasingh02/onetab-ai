import type { Message, RoomMember } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  Popover,
  PopoverContent,
  PopoverTrigger,
  UserAvatar,
} from '@org/ui';
import { cn, formatListTimestamp, formatRelative } from '@org/utils';
import {
  AlertTriangle,
  Bookmark,
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
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Offered inline on the hover toolbar; everything else lives behind the picker.
 * Three is the most that fits before the toolbar starts covering the message it
 * belongs to on a narrow pane.
 */
const QUICK_REACTIONS = ['👍', '🎉', '👀'];

const PICKER_REACTIONS = [
  '👍', '👎', '❤️', '🎉', '😄', '😮',
  '😢', '🙏', '🔥', '👀', '✅', '🚀',
  '💯', '🤔', '👏', '🐛', '📌', '☕',
];

export interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  /** Hides the avatar and header when the previous message shares a sender. */
  isGrouped?: boolean;
  onReact?: (key: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenThread?: () => void;
  threadReplyCount?: number;
  attachmentSlot?: ReactNode;
  /** True when the message is pinned to the channel, for everyone. */
  isPinned?: boolean;
  onTogglePin?: () => void;
  /** True when the reader saved it to their own list. */
  isSaved?: boolean;
  onToggleSave?: () => void;
  onCopyLink?: () => void;
  onCopyText?: () => void;
  onForward?: () => void;
  /** Avatars shown on the thread summary line. */
  threadParticipants?: RoomMember[];
  /** Timestamp of the newest reply, for the thread summary line. */
  lastReplyAt?: number;
  /** Tints the row — used when search or a pin jumps the reader here. */
  isHighlighted?: boolean;
}

/**
 * One message row.
 *
 * Grouped messages drop the avatar and header, which is what makes a dense
 * conversation readable rather than a wall of repeated names.
 *
 * Every action is duplicated between the hover toolbar and the overflow menu on
 * purpose: the toolbar is unreachable on touch, and the menu is the only path
 * that works for a keyboard user who has tabbed to the row.
 */
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
        <p className="text-sm text-muted-foreground italic">
          This message was deleted.
        </p>
      </div>
    );
  }

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/message gap-3 px-4 relative flex transition-colors',
        'hover:bg-muted/40',
        isGrouped ? 'py-0.5' : 'pt-3 pb-0.5',
        // A pinned message keeps a standing marker; a highlight is transient.
        isPinned && 'border-l-2 border-l-warning',
        isHighlighted && 'bg-warning/10',
      )}
    >
      <div className="w-8 shrink-0">
        {isGrouped ? (
          // Timestamp replaces the avatar on hover for grouped rows.
          <time
            dateTime={new Date(message.timestamp).toISOString()}
            className="mt-1 hidden text-[10px] text-muted-foreground tabular-nums group-hover/message:block"
          >
            {new Date(message.timestamp).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        ) : (
          <UserAvatar
            name={message.senderName}
            src={message.senderAvatarUrl}
            seed={message.senderId}
            size="md"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {isPinned && !isGrouped ? (
          <p className="mb-0.5 gap-1 text-[10px] font-medium flex items-center text-warning">
            <Pin className="size-2.5" aria-hidden />
            Pinned to this channel
          </p>
        ) : null}

        {!isGrouped ? (
          <header className="gap-2 flex items-baseline">
            <span className="text-sm font-semibold">{message.senderName}</span>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-xs text-muted-foreground"
            >
              {formatListTimestamp(message.timestamp)}
            </time>
            {message.isEncrypted ? (
              <Hint label="End-to-end encrypted">
                <Lock className="size-3 text-muted-foreground" aria-hidden />
              </Hint>
            ) : null}
            {isSaved ? (
              <Hint label="Saved for later">
                <Bookmark
                  className="size-3 fill-current text-primary"
                  aria-label="Saved for later"
                />
              </Hint>
            ) : null}
          </header>
        ) : null}

        {message.decryptionError ? (
          <p className="gap-1.5 py-0.5 text-sm flex items-center text-muted-foreground italic">
            <AlertTriangle className="size-3.5 shrink-0 text-warning" />
            {message.decryptionError}
          </p>
        ) : (
          <>
            {message.body ? (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                {message.body}
                {message.isEdited ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    (edited)
                  </span>
                ) : null}
              </p>
            ) : null}
            {attachmentSlot}
          </>
        )}

        {message.reactions.length > 0 ? (
          <ul className="mt-1 gap-1 flex flex-wrap">
            {message.reactions.map((reaction) => (
              <li key={reaction.key}>
                <button
                  onClick={() => onReact?.(reaction.key)}
                  aria-pressed={reaction.reactedByMe}
                  aria-label={`${reaction.key}, ${reaction.count} ${
                    reaction.count === 1 ? 'reaction' : 'reactions'
                  }`}
                  className={cn(
                    'gap-1 px-1.5 py-0.5 text-xs flex items-center rounded-full border transition-colors',
                    reaction.reactedByMe
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  <span aria-hidden>{reaction.key}</span>
                  <span className="tabular-nums">{reaction.count}</span>
                </button>
              </li>
            ))}

            {/* Adding a reaction is only one click away once the row has any. */}
            {onReact ? (
              <li>
                <ReactionPicker onSelect={onReact}>
                  <button
                    aria-label="Add a reaction"
                    className="gap-1 px-1.5 py-0.5 flex items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Smile className="size-3.5" aria-hidden />
                  </button>
                </ReactionPicker>
              </li>
            ) : null}
          </ul>
        ) : null}

        {threadReplyCount && threadReplyCount > 0 ? (
          <button
            onClick={onOpenThread}
            className="mt-1 gap-2 py-0.5 pr-2 -ml-1 pl-1 text-xs flex items-center rounded-md transition-colors hover:bg-muted"
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
                    className="ring-2 ring-background"
                  />
                ))}
              </span>
            ) : null}
            <span className="font-medium text-primary">
              {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
            </span>
            {lastReplyAt ? (
              <span className="text-subtle">
                last reply {formatRelative(lastReplyAt)}
              </span>
            ) : null}
          </button>
        ) : null}

        {message.sendState === 'failed' ? (
          <Badge variant="destructive" className="mt-1">
            Failed to send
          </Badge>
        ) : null}
      </div>

      {/* Actions appear on hover, and on keyboard focus so they stay reachable. */}
      <div
        className={cn(
          '-top-3 right-4 gap-0.5 p-0.5 shadow-xs absolute hidden items-center rounded-md border bg-background',
          'group-focus-within/message:flex group-hover/message:flex',
        )}
      >
        {/* The most-used emoji inline: reacting should not cost a menu. */}
        {onReact
          ? QUICK_REACTIONS.map((emoji) => (
              <Hint key={emoji} label={`React with ${emoji}`}>
                <button
                  onClick={() => onReact(emoji)}
                  aria-label={`React with ${emoji}`}
                  className="size-7 text-sm flex items-center justify-center rounded hover:bg-accent"
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              </Hint>
            ))
          : null}

        {onReact ? (
          <ReactionPicker onSelect={onReact}>
            <Button variant="ghost" size="icon-sm" aria-label="Add a reaction">
              <Smile />
            </Button>
          </ReactionPicker>
        ) : null}

        <Hint label="Reply in thread">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reply in thread"
            onClick={onOpenThread ?? onReply}
          >
            <Reply />
          </Button>
        </Hint>

        {onToggleSave ? (
          <Hint label={isSaved ? 'Remove from saved' : 'Save for later'}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isSaved ? 'Remove from saved' : 'Save for later'}
              aria-pressed={isSaved}
              onClick={onToggleSave}
              className={isSaved ? 'text-primary' : undefined}
            >
              <Bookmark className={cn(isSaved && 'fill-current')} />
            </Button>
          </Hint>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onOpenThread?.()}>
              <Reply />
              Reply in thread
            </DropdownMenuItem>
            {onForward ? (
              <DropdownMenuItem onSelect={() => onForward()}>
                <Forward />
                Forward message
              </DropdownMenuItem>
            ) : null}
            {onToggleSave ? (
              <DropdownMenuItem onSelect={() => onToggleSave()}>
                <Bookmark />
                {isSaved ? 'Remove from saved' : 'Save for later'}
              </DropdownMenuItem>
            ) : null}
            {onTogglePin ? (
              <DropdownMenuItem onSelect={() => onTogglePin()}>
                {isPinned ? <PinOff /> : <Pin />}
                {isPinned ? 'Unpin from channel' : 'Pin to channel'}
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            {onCopyText ? (
              <DropdownMenuItem onSelect={() => onCopyText()}>
                <Copy />
                Copy text
              </DropdownMenuItem>
            ) : null}
            {onCopyLink ? (
              <DropdownMenuItem onSelect={() => onCopyLink()}>
                <Link2 />
                Copy link to message
              </DropdownMenuItem>
            ) : null}

            {isOwn ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onEdit?.()}>
                  <Pencil />
                  Edit message
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete?.()}
                >
                  <Trash2 />
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

/** Emoji grid in a popover, anchored to whatever trigger it wraps. */
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
      <PopoverContent align="end" className="w-auto p-2">
        <p className="mb-1 px-1 font-medium text-[10px] text-muted-foreground uppercase">
          React
        </p>
        <div className="gap-0.5 grid grid-cols-6">
          {PICKER_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              aria-label={`React with ${emoji}`}
              className="size-8 text-lg flex items-center justify-center rounded hover:bg-accent"
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Sticky day marker between message groups. */
export function DateSeparator({ timestamp }: { timestamp: number }) {
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
    <div className="top-0 gap-3 px-4 py-2 sticky z-10 flex items-center">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-background text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

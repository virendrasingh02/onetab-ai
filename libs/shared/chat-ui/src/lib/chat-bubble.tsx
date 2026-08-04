import type { Message } from '@org/types';
import { Badge, Button, Hint, UserAvatar } from '@org/ui';
import { cn, formatListTimestamp } from '@org/utils';
import {
  AlertTriangle,
  Lock,
  MoreHorizontal,
  Pencil,
  Reply,
  Smile,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';

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
}

/**
 * One message row.
 *
 * Grouped messages drop the avatar and header, which is what makes a dense
 * conversation readable rather than a wall of repeated names.
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
}: ChatBubbleProps) {
  if (message.isRedacted) {
    return (
      <div className={cn('px-4 py-1', isGrouped ? 'pl-14' : 'pl-14')}>
        <p className="text-sm text-muted-foreground italic">
          This message was deleted.
        </p>
      </div>
    );
  }

  return (
    <article
      className={cn(
        'group/message gap-3 px-4 relative flex transition-colors',
        'hover:bg-muted/40',
        isGrouped ? 'py-0.5' : 'pt-3 pb-0.5',
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
          </ul>
        ) : null}

        {threadReplyCount && threadReplyCount > 0 ? (
          <button
            onClick={onOpenThread}
            className="mt-1 gap-1 text-xs font-medium flex items-center text-primary hover:underline"
          >
            {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
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
        <Hint label="React">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Add reaction"
            onClick={() => onReact?.('👍')}
          >
            <Smile />
          </Button>
        </Hint>
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
        {isOwn ? (
          <>
            <Hint label="Edit">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit message"
                onClick={onEdit}
              >
                <Pencil />
              </Button>
            </Hint>
            <Hint label="Delete">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete message"
                onClick={onDelete}
              >
                <Trash2 />
              </Button>
            </Hint>
          </>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        )}
      </div>
    </article>
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

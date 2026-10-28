import type { ForwardedMessage, RoomKind } from '@org/types';
import { Hint, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { format, isSameYear, isToday } from 'date-fns';
import {
  ArrowUpRight,
  Forward,
  Hash,
  Lock,
  MessageSquare,
  MessagesSquare,
  Users,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MarkdownMessage } from './markdown-message.js';

export interface ForwardedMessageCardProps {
  forwarded: ForwardedMessage;
  /**
   * Opens the original in its conversation. Omit when the viewer cannot see
   * the source (a DM they are not in) — the card then reads as a snapshot.
   */
  onOpen?: () => void;
  /** The original's attachment, rendered by the host (it owns the lightbox). */
  attachmentSlot?: ReactNode;
  /** The source is private — a DM, group or private channel. */
  isPrivate?: boolean;
  /**
   * `timeline` sits under a message; `preview` is the copy shown in the
   * Forward dialog, where the body is clamped tighter and nothing is clickable.
   */
  variant?: 'timeline' | 'preview';
  mentionNames?: string[];
  className?: string;
}

/** "2:45 PM" today, "Jul 20, 2:45 PM" this year, "Jul 20, 2025" before. */
function formatForwardedTime(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isSameYear(date, new Date())) return format(date, 'MMM d, h:mm a');
  return format(date, 'MMM d, yyyy');
}

/** Where the original was posted, as an icon and a short label. */
export function describeForwardSource(
  roomKind: RoomKind | undefined,
  roomName: string | undefined,
  isPrivate = false,
): { icon: ReactNode; label: string } {
  if (roomKind === 'direct') {
    return {
      icon: <MessageSquare className="size-3" />,
      label: 'Direct message',
    };
  }
  if (roomKind === 'group') {
    return { icon: <Users className="size-3" />, label: 'Group message' };
  }
  if (roomName) {
    return {
      icon: isPrivate ? (
        <Lock className="size-3" />
      ) : (
        <Hash className="size-3" />
      ),
      label: roomName.replace(/^#/, ''),
    };
  }
  return { icon: <MessagesSquare className="size-3" />, label: 'Conversation' };
}

/** Lines of body shown before "Show more". */
const CLAMP_LINES = { timeline: 6, preview: 4 } as const;

/**
 * A forwarded message, quoted inside the message that forwarded it.
 *
 * Reads like a miniature of the original — who wrote it, when, where — set
 * apart from the forwarder's own note by a left rule, so the two voices never
 * blur together. Long bodies clamp with a "Show more" toggle rather than
 * stretching the timeline.
 */
export function ForwardedMessageCard({
  forwarded,
  onOpen,
  attachmentSlot,
  isPrivate,
  variant = 'timeline',
  mentionNames,
  className,
}: ForwardedMessageCardProps) {
  const source = describeForwardSource(
    forwarded.roomKind,
    forwarded.roomName,
    isPrivate,
  );
  const time = formatForwardedTime(forwarded.timestamp);
  const interactive = variant === 'timeline' && Boolean(onOpen);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Measure once the clamp is applied: only offer "Show more" when it hides
  // something.
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node || expanded) return;
    setOverflows(node.scrollHeight - node.clientHeight > 2);
  }, [forwarded.body, expanded]);

  return (
    <div
      data-slot="forwarded-message"
      className={cn(
        'group/fwd mt-1.5 max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-xs',
        interactive &&
          'transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm',
        className,
      )}
    >
      {/* A labelled header strip — not a side rail — so a forward never reads
          like a reply quote: it says plainly where the message came from. */}
      <div className="gap-1.5 px-3 py-1.5 text-xs flex items-center border-b border-border bg-muted/50 text-muted-foreground">
        <Forward className="size-3.5 shrink-0 text-primary-text" aria-hidden />
        <span className="font-medium shrink-0 text-foreground">Forwarded</span>
        <span className="shrink-0" aria-hidden>
          from
        </span>
        <Hint label={source.label}>
          <span className="min-w-0 gap-1 px-1.5 font-medium inline-flex items-center rounded-md bg-background/80 py-px text-foreground ring-1 ring-border">
            <span className="shrink-0" aria-hidden>
              {source.icon}
            </span>
            <span className="truncate">{source.label}</span>
          </span>
        </Hint>
        {forwarded.threadRootId ? (
          <span className="shrink-0">· in a thread</span>
        ) : null}
      </div>

      <div className="px-3 pt-2.5 pb-2.5">
        <div className="gap-2 flex items-center">
          <UserAvatar
            name={forwarded.senderName}
            src={forwarded.senderAvatarUrl}
            seed={forwarded.senderId}
            className="size-6 shrink-0"
          />
          <span className="min-w-0 font-semibold truncate text-message text-foreground">
            {forwarded.senderName}
          </span>
          {time ? (
            <time
              dateTime={new Date(forwarded.timestamp).toISOString()}
              className="text-xs shrink-0 text-muted-foreground"
            >
              {time}
            </time>
          ) : null}
        </div>

        {forwarded.body ? (
          <div className="mt-1.5">
            <div
              ref={bodyRef}
              className={cn(!expanded && 'overflow-hidden')}
              style={
                expanded
                  ? undefined
                  : {
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: CLAMP_LINES[variant],
                    }
              }
            >
              <MarkdownMessage
                text={forwarded.body}
                mentionNames={mentionNames}
              />
            </div>
            {overflows || expanded ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-0.5 text-xs font-medium cursor-pointer text-primary-text hover:underline"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </div>
        ) : null}

        {attachmentSlot ? <div className="mt-2">{attachmentSlot}</div> : null}
      </div>

      {interactive ? (
        <button
          type="button"
          onClick={onOpen}
          className="gap-1 px-3 py-1.5 text-xs font-medium flex w-full cursor-pointer items-center justify-between border-t border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-primary-text focus-visible:bg-muted/50 focus-visible:outline-none"
        >
          View original message
          <ArrowUpRight
            className="size-3.5 group-hover/fwd:translate-x-0.5 group-hover/fwd:-translate-y-0.5 transition-transform"
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}

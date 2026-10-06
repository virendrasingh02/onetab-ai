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
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
    return { icon: <MessageSquare className="size-3" />, label: 'Direct message' };
  }
  if (roomKind === 'group') {
    return { icon: <Users className="size-3" />, label: 'Group message' };
  }
  if (roomName) {
    return {
      icon: isPrivate ? <Lock className="size-3" /> : <Hash className="size-3" />,
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
        'group/fwd mt-1.5 max-w-2xl relative overflow-hidden rounded-xl border border-border bg-surface',
        'pl-3.5 pr-3 py-2.5',
        // The rule that sets the original apart from the forwarder's note.
        'before:absolute before:inset-y-2 before:left-1.5 before:w-[3px] before:rounded-full before:bg-border-strong',
        interactive &&
          'transition-colors hover:border-border-strong hover:before:bg-primary/60',
        className,
      )}
    >
      <div className="gap-2 flex items-start">
        <UserAvatar
          name={forwarded.senderName}
          src={forwarded.senderAvatarUrl}
          seed={forwarded.senderId}
          className="size-7 mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="gap-1.5 flex items-baseline">
            <span className="truncate text-message font-semibold text-foreground">
              {forwarded.senderName}
            </span>
            {time ? (
              <time
                dateTime={new Date(forwarded.timestamp).toISOString()}
                className="shrink-0 text-[11px] text-muted-foreground"
              >
                {time}
              </time>
            ) : null}
            <Hint label="Forwarded message">
              <span className="ml-auto gap-1 font-medium shrink-0 inline-flex items-center self-center text-[10px] tracking-wide text-subtle uppercase">
                <Forward className="size-3" aria-hidden />
                <span className="sr-only sm:not-sr-only">Forwarded</span>
              </span>
            </Hint>
          </div>

          <p className="gap-1 flex items-center text-[11px] text-muted-foreground">
            <span className="shrink-0" aria-hidden>
              {source.icon}
            </span>
            <span className="truncate">
              {source.label}
              {forwarded.threadRootId ? ' · in a thread' : ''}
            </span>
          </p>
        </div>
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
            <MarkdownMessage text={forwarded.body} mentionNames={mentionNames} />
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

      {interactive ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 gap-1 text-xs font-medium inline-flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-primary-text"
        >
          View original message
          <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

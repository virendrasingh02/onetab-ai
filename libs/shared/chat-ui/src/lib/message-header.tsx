import type { ReactNode } from 'react';
import { cn } from '@org/utils';
import { MessageTime } from './message-time.js';

/** Sender name type — the same on every message row (people, agents, apps). */
export const MESSAGE_SENDER_NAME_CLASS =
  'font-semibold text-message text-foreground';

/** Time type beside the sender name. */
export const MESSAGE_TIME_CLASS =
  'font-medium text-xs shrink-0 text-muted-foreground';

/**
 * The one "Name · badge · time" line every message surface draws: the
 * timeline, thread panel, agent and app replies, pinned and thread lists, and
 * pending uploads. Pass `name` already wrapped (profile card, jump link) when
 * the surface needs it; `time` replaces the live clock where a list needs a
 * date-aware label instead.
 */
export function MessageHeader({
  name,
  badge,
  timestamp,
  time,
  children,
  className,
  as: Tag = 'header',
}: {
  /** `span` inside a button (list rows), where `header` isn't allowed. */
  as?: 'header' | 'div' | 'span';
  /** The sender name — a string, or a node that renders `SenderName`. */
  name: ReactNode;
  badge?: ReactNode;
  timestamp?: number;
  /** Overrides the live `MessageTime` (e.g. a dated label in a list). */
  time?: ReactNode;
  /** Trailing indicators: sending, encrypted, pinned, edited… */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn('gap-x-2 gap-y-0.5 flex flex-wrap items-baseline', className)}
    >
      {typeof name === 'string' ? <SenderName>{name}</SenderName> : name}
      {badge ? <span className="inline-flex items-center">{badge}</span> : null}
      {time !== undefined ? (
        <span className={MESSAGE_TIME_CLASS}>{time}</span>
      ) : timestamp !== undefined ? (
        <MessageTime
          timestamp={timestamp}
          className={cn(MESSAGE_TIME_CLASS, 'cursor-pointer hover:underline')}
        />
      ) : null}
      {children}
    </Tag>
  );
}

/** The sender name span, for surfaces that wrap it (profile card, link). */
export function SenderName({
  children,
  interactive,
  className,
  onClick,
}: {
  children: ReactNode;
  /** Underlines on hover — set when the name opens something. */
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={cn(
        MESSAGE_SENDER_NAME_CLASS,
        // No `truncate`: overflow-hidden moves a flex item's baseline and
        // knocks the name out of line with the time beside it.
        'min-w-0 break-words',
        interactive && 'cursor-pointer hover:underline',
        className,
      )}
    >
      {children}
    </span>
  );
}

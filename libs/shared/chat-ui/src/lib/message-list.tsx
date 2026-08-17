import type { Message } from '@org/types';
import { EmptyState, ErrorState, ScrollArea, Spinner } from '@org/ui';
import { cn } from '@org/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageSquare } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { UnreadDivider } from './channel-extras.js';
import { DateSeparator } from './chat-bubble.js';

/** Consecutive messages from one sender within this window are grouped. */
const GROUPING_WINDOW_MS = 5 * 60_000;

type Row =
  | { kind: 'separator'; key: string; timestamp: number }
  | { kind: 'unread'; key: string }
  | { kind: 'message'; key: string; message: Message; grouped: boolean };

/**
 * Flattens messages into rows, inserting a separator at each day boundary and
 * marking which messages continue the previous sender's run.
 *
 * `unreadBeforeId` places the "new messages" line above that message. It also
 * breaks grouping there: a run of messages split by the line would otherwise
 * lose its avatar on the first unread one, which is exactly the message the
 * reader is being sent to.
 */
export function buildRows(
  messages: Message[],
  unreadBeforeId?: string | null,
): Row[] {
  const rows: Row[] = [];
  let previous: Message | undefined;

  for (const message of messages) {
    const isNewDay =
      !previous ||
      new Date(previous.timestamp).toDateString() !==
        new Date(message.timestamp).toDateString();

    if (isNewDay) {
      rows.push({
        kind: 'separator',
        key: `sep-${message.timestamp}`,
        timestamp: message.timestamp,
      });
    }

    const isFirstUnread = !!unreadBeforeId && message.id === unreadBeforeId;
    if (isFirstUnread) {
      rows.push({ kind: 'unread', key: `unread-${message.id}` });
    }

    const grouped =
      !isNewDay &&
      !isFirstUnread &&
      !!previous &&
      previous.senderId === message.senderId &&
      message.timestamp - previous.timestamp < GROUPING_WINDOW_MS;

    rows.push({ kind: 'message', key: message.id, message, grouped });
    previous = message;
  }

  return rows;
}

export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  isLoadingOlder?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoadOlder?: () => void;
  renderMessage: (message: Message, grouped: boolean) => ReactNode;
  /** Draws the "new messages" line above this message. */
  unreadBeforeId?: string | null;
  className?: string;
}

/**
 * Virtualised timeline.
 *
 * Only visible rows are mounted, so a room with tens of thousands of messages
 * costs the same to render as one with fifty. Two behaviours matter more than
 * the virtualisation itself:
 *
 *  - the view pins to the bottom while the user is already at the bottom, and
 *    leaves them alone when they have scrolled up to read;
 *  - loading older history preserves the scroll offset, so the content the
 *    user is reading does not jump away from under them.
 */
export function MessageList({
  messages,
  isLoading = false,
  isLoadingOlder = false,
  hasMore = false,
  error,
  onRetry,
  onLoadOlder,
  renderMessage,
  unreadBeforeId,
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => buildRows(messages, unreadBeforeId),
    [messages, unreadBeforeId],
  );

  /** Whether the user was pinned to the bottom before this render. */
  const wasAtBottom = useRef(true);
  const previousScrollHeight = useRef(0);
  const previousCount = useRef(messages.length);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // A message row is ~64px; the virtualizer measures the real height after
    // mount, so this only has to be close.
    estimateSize: () => 64,
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const isAtBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return true;
    // 80px of slack: "near the bottom" should still count as following along.
    return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    wasAtBottom.current = isAtBottom();

    // Trigger backfill before the user actually hits the top.
    if (element.scrollTop < 200 && hasMore && !isLoadingOlder) {
      previousScrollHeight.current = element.scrollHeight;
      onLoadOlder?.();
    }
  }, [hasMore, isLoadingOlder, isAtBottom, onLoadOlder]);

  // Runs before paint, so neither correction is ever visible as a flicker.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const grew = messages.length > previousCount.current;
    previousCount.current = messages.length;

    if (previousScrollHeight.current && grew) {
      // Older messages were prepended: restore the reading position by the
      // exact amount the content grew.
      element.scrollTop = element.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = 0;
      return;
    }

    if (wasAtBottom.current && grew) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length]);

  // Land at the newest message on first load.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && !isLoading && messages.length > 0) {
      element.scrollTop = element.scrollHeight;
    }
    // Only on the transition out of loading, not on every new message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (error) {
    return (
      <ErrorState
        fullPage
        title="Could not load messages"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  if (!isLoading && messages.length === 0) {
    return (
      <EmptyState
        size="lg"
        icon={<MessageSquare />}
        title="No messages yet"
        description="Start the conversation — say hello."
      />
    );
  }

  return (
    /*
     * The virtualiser, the load-older backfill and the pin-to-bottom logic all
     * read `scrollRef`, so it has to land on the element SimpleBar actually
     * scrolls — `viewportRef`, not the root.
     */
    <ScrollArea
      className={cn('min-h-0 flex-1', className)}
      viewportRef={scrollRef}
      viewportProps={{
        onScroll: handleScroll,
        role: 'log',
        'aria-label': 'Messages',
        'aria-live': 'polite',
      }}
    >
      {isLoadingOlder ? (
        <div className="py-3 flex justify-center">
          <Spinner label="Loading earlier messages" />
        </div>
      ) : null}

      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.kind === 'separator' ? (
                <DateSeparator timestamp={row.timestamp} />
              ) : row.kind === 'unread' ? (
                <UnreadDivider />
              ) : (
                renderMessage(row.message, row.grouped)
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

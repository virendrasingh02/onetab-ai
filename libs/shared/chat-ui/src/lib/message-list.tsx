import type { Message } from '@org/types';
import { Button, EmptyState, ErrorState, ScrollArea, Spinner } from '@org/ui';
import { cn } from '@org/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, MessageSquare } from 'lucide-react';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UnreadDivider } from './channel-extras.js';
import { DateSeparator } from './chat-bubble.js';
import { getScrollPosition, setScrollPosition } from './scroll-position-store.js';

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
  /**
   * Identity of the conversation being shown — a room id, typically. Drives
   * this list's scroll-position memory: switching to a new value restores
   * that conversation's last known position (or lands at the bottom, for one
   * with no memory yet) instead of leaving the scroll where the previous
   * conversation left it. Left unset, no position is remembered or restored.
   */
  conversationId?: string | null;
  messages: Message[];
  isLoading?: boolean;
  isLoadingOlder?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoadOlder?: () => void;
  renderMessage: (
    message: Message,
    grouped: boolean,
    density?: 'comfy' | 'compact',
  ) => ReactNode;
  /** Draws the "new messages" line above this message. */
  unreadBeforeId?: string | null;
  /**
   * Message layout density.
   */
  density?: 'comfy' | 'compact';
  /**
   * Where to position scroll when opening a conversation.
   */
  openPosition?: 'last-read' | 'newest';
  /**
   * Rendered at the very top of the timeline — the channel's welcome block.
   *
   * It only appears once every older message has been loaded, so it marks the
   * real beginning of the conversation rather than the top of the current
   * page. In an empty conversation it stands in for the empty state.
   */
  introSlot?: ReactNode;
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
  conversationId,
  messages,
  isLoading = false,
  isLoadingOlder = false,
  hasMore = false,
  error,
  onRetry,
  onLoadOlder,
  renderMessage,
  unreadBeforeId,
  density = 'comfy',
  openPosition = 'last-read',
  introSlot,
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const rows = useMemo(
    () => buildRows(messages, unreadBeforeId),
    [messages, unreadBeforeId],
  );

  /** Whether the user was pinned to the bottom before this render. */
  const wasAtBottom = useRef(true);
  const previousScrollHeight = useRef(0);
  const previousCount = useRef(messages.length);
  /**
   * The conversation the scroll container is currently positioned for — lets
   * a conversation *switch* be told apart from this same conversation simply
   * getting more messages, in the effect below.
   */
  const previousConversationId = useRef(conversationId);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
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

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    wasAtBottom.current = true;
    setNewMessagesCount(0);
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const atBottom = isAtBottom();
    wasAtBottom.current = atBottom;
    if (atBottom) {
      setNewMessagesCount(0);
    }
    if (conversationId) setScrollPosition(conversationId, element.scrollTop);

    // Trigger backfill before the user actually hits the top.
    if (element.scrollTop < 200 && hasMore && !isLoadingOlder) {
      previousScrollHeight.current = element.scrollHeight;
      onLoadOlder?.();
    }
  }, [hasMore, isLoadingOlder, isAtBottom, onLoadOlder, conversationId]);

  /*
   * Switching conversations: land back on the reader's last known position in
   * the one being opened, or at the bottom for one with no memory yet — never
   * wherever the *previous* conversation happened to leave the scrollbar.
   */
  useLayoutEffect(() => {
    const switchedConversation =
      previousConversationId.current !== conversationId;
    previousConversationId.current = conversationId;
    previousCount.current = messages.length;
    previousScrollHeight.current = 0;

    if (!switchedConversation) return;

    setNewMessagesCount(0);

    const element = scrollRef.current;
    if (!element) return;

    if (openPosition === 'newest') {
      element.scrollTop = element.scrollHeight;
      wasAtBottom.current = true;
      return;
    }

    // 'last-read' mode:
    if (unreadBeforeId) {
      const unreadIndex = rows.findIndex(
        (r) =>
          r.kind === 'unread' ||
          (r.kind === 'message' && r.message.id === unreadBeforeId),
      );
      if (unreadIndex >= 0) {
        virtualizer.scrollToIndex(unreadIndex, { align: 'start' });
        wasAtBottom.current = false;
        return;
      }
    }

    const saved = conversationId ? getScrollPosition(conversationId) : undefined;
    if (saved !== undefined) {
      element.scrollTop = saved;
      wasAtBottom.current =
        element.scrollHeight - saved - element.clientHeight < 80;
    } else {
      element.scrollTop = element.scrollHeight;
      wasAtBottom.current = true;
    }
  }, [conversationId, openPosition, unreadBeforeId, rows, virtualizer]);

  // Runs before paint, so neither correction is ever visible as a flicker.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const diff = messages.length - previousCount.current;
    const grew = diff > 0;
    previousCount.current = messages.length;

    if (previousScrollHeight.current && grew) {
      // Older messages were prepended: restore the reading position by the
      // exact amount the content grew.
      element.scrollTop = element.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = 0;
      return;
    }

    if (wasAtBottom.current && grew) {
      requestAnimationFrame(() => {
        if (element && wasAtBottom.current) {
          element.scrollTop = element.scrollHeight;
        }
      });
    } else if (!wasAtBottom.current && grew) {
      // User is reading older messages and new messages arrived
      setNewMessagesCount((prev) => prev + diff);
    }
  }, [messages.length]);

  // Keep pinned to bottom when cards, images, or embeds dynamically expand heights
  const virtualContainerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = virtualContainerRef.current;
    if (!target) return;

    const observer = new ResizeObserver(() => {
      const element = scrollRef.current;
      if (element && wasAtBottom.current) {
        element.scrollTop = element.scrollHeight;
      }
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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
    return introSlot ? (
      <ScrollArea className={cn('min-h-0 flex-1', className)}>
        {introSlot}
      </ScrollArea>
    ) : (
      <EmptyState
        size="lg"
        icon={<MessageSquare />}
        title="No messages yet"
        description="Start the conversation — say hello."
      />
    );
  }

  return (
    <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
      <ScrollArea
        className={cn(
          'min-h-0 flex-1',
          density === 'compact' ? 'chat-density-compact' : 'chat-density-comfy',
          className,
        )}
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

        {/*
          The conversation is still being opened — its room resolved but no
          messages read from it yet. An empty, motionless timeline here would
          read as broken on a slow connection (see the acceptance test for it);
          this keeps the same scroll container in place and says so instead,
          rather than the host falling back to unmounting the whole surface for
          a full-page spinner (see `ChatPanel`).
        */}
        {isLoading && rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Spinner label="Loading messages…" />
          </div>
        ) : null}

        {/* Only once the history is exhausted is this actually the beginning. */}
        {introSlot && !hasMore && !isLoadingOlder ? introSlot : null}

        <div
          ref={virtualContainerRef}
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
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
                  renderMessage(row.message, row.grouped, density)
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Floating Slack-style Jump to Bottom Indicator */}
      {newMessagesCount > 0 ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Button
            variant="primary"
            size="sm"
            onClick={scrollToBottom}
            className="rounded-full shadow-md gap-1.5 px-3.5 py-1 h-8 text-xs font-semibold"
            aria-label={`Jump to ${newMessagesCount} new messages`}
          >
            <ArrowDown className="size-3.5" />
            <span>
              {newMessagesCount === 1
                ? '1 new message'
                : `${newMessagesCount} new messages`}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

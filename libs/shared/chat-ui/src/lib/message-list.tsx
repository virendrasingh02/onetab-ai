import type { ConnectionState, Message } from '@org/types';
import {
  Button,
  EmptyState,
  ErrorState,
  ScrollArea,
  Spinner,
  UserAvatarGroup,
  type AvatarGroupUser,
} from '@org/ui';
import { cn } from '@org/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, MessageSquare } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UnreadDivider } from './channel-extras.js';
import { DateSeparator, formatDaySeparatorLabel } from './chat-bubble.js';
import { ConnectionPill } from './indicators.js';
import {
  getScrollAnchor,
  setScrollAnchor,
  type ScrollAnchor,
} from './scroll-position-store.js';

/** Consecutive messages from one sender within this window are grouped. */
const GROUPING_WINDOW_MS = 5 * 60_000;

/** Height reserved for the floating day chip, and the inline separator's. */
const DAY_CHIP_HEIGHT = 34;

/**
 * Height of the sticky "N new messages" bar. The floating day chip and the
 * connection pill ride down by this much while the bar is showing so nothing
 * stacks on top of it.
 */
const NEW_MESSAGES_BAR_HEIGHT = 32;

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
   * Transient client connection state. When set to `connecting` / `syncing` /
   * `reconnecting`, a floating pill drops in at the top of the list; anything
   * else (or unset) shows nothing. Blocking states are the host's job.
   */
  connectionState?: ConnectionState;
  /**
   * Marks the conversation read from the sticky "new messages" bar. Without it
   * the bar still offers "jump to latest", just not "mark as read".
   */
  onMarkRead?: () => void;
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

type Anchor = { key: string; offset: number };

/**
 * Virtualised timeline.
 *
 * Only visible rows are mounted, so a room with tens of thousands of messages
 * costs the same to render as one with fifty. The behaviours layered on top of
 * the virtualisation are what make it feel like a chat log rather than a list:
 *
 *  - the view stays pinned to the newest message while the reader is already
 *    there, and leaves them alone the moment they scroll up to read;
 *  - paging in older history holds the reader on the exact message they were
 *    looking at, re-correcting for a few frames while the freshly inserted
 *    rows measure their real heights;
 *  - switching conversations restores the reader's last position in the one
 *    being opened — anchored to a message, not a raw pixel offset, so it
 *    survives the measure pass;
 *  - the current day's divider floats at the top of the viewport and is
 *    nudged up out of the way by the next day's as it scrolls in.
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
  connectionState,
  onMarkRead,
  introSlot,
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualContainerRef = useRef<HTMLDivElement>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [floatingDay, setFloatingDay] = useState<{
    ts: number;
    shift: number;
  } | null>(null);

  const rows = useMemo(
    () => buildRows(messages, unreadBeforeId),
    [messages, unreadBeforeId],
  );
  /** Latest `rows` for the rAF loops, which run outside the render pass. */
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /**
   * Distinct authors of the messages that arrived while the reader was scrolled
   * up — the faces on the jump-to-latest pill. Newest-first, capped at three;
   * `UserAvatarGroup` renders the "+N" itself.
   */
  const newSenders = useMemo<AvatarGroupUser[]>(() => {
    if (newMessagesCount <= 0) return [];
    const seen = new Map<string, AvatarGroupUser>();
    for (
      let i = messages.length - 1;
      i >= 0 && i >= messages.length - newMessagesCount;
      i--
    ) {
      const message = messages[i];
      if (!message || seen.has(message.senderId)) continue;
      seen.set(message.senderId, {
        id: message.senderId,
        name: message.senderName,
        avatarUrl: message.senderAvatarUrl,
      });
      if (seen.size >= 3) break;
    }
    return [...seen.values()];
  }, [messages, newMessagesCount]);

  /** The reader is at (or within 80px of) the newest message. */
  const stickToBottom = useRef(true);
  /** Message count at the previous commit — tells growth from a prepend. */
  const previousCount = useRef(messages.length);
  /** First *message* row key last commit — a stable prepend detector. */
  const firstMessageKey = useRef(
    rows.find((row) => row.kind === 'message')?.key,
  );
  /** Set synchronously when a backfill is asked for; cleared when it lands. */
  const loadingOlder = useRef(false);
  /** Row to hold steady while heights settle (prepend / conversation switch). */
  const pendingAnchor = useRef<(Anchor & { frames: number }) | null>(null);
  /** Conversation whose saved position we still owe a restore to. */
  const restorePendingFor = useRef<string | null | undefined>(undefined);
  /** True while we move the scrollbar ourselves — makes `onScroll` stand down. */
  const adjusting = useRef(false);
  const settleRaf = useRef<number | null>(null);
  const scrollRaf = useRef<number | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const totalSize = virtualizer.getTotalSize();

  const isAtBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return true;
    // 80px of slack: "near the bottom" should still count as following along.
    return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }, []);

  /**
   * Distance from the top of the scrollable content to the top of the
   * virtualiser's container — the "load earlier" slot and, once history is
   * exhausted, the welcome block sit above it. Virtualiser offsets are measured
   * from its container; `scrollTop` is measured from the content. This is what
   * converts between the two.
   */
  const getListOffset = useCallback(() => {
    const listElement = virtualContainerRef.current;
    const element = scrollRef.current;
    if (!listElement || !element) return 0;
    return (
      listElement.getBoundingClientRect().top -
      element.getBoundingClientRect().top +
      element.scrollTop
    );
  }, []);

  /** The row at the top edge of the viewport, and how far into it we are. */
  const captureAnchor = useCallback((): Anchor => {
    const element = scrollRef.current;
    if (!element) return { key: '', offset: 0 };
    const listTop = Math.max(0, element.scrollTop - getListOffset());
    const item = virtualizer.getVirtualItemForOffset(listTop);
    if (!item) return { key: '', offset: 0 };
    return { key: String(item.key), offset: item.start - listTop };
  }, [virtualizer, getListOffset]);

  const releaseAdjusting = useCallback(() => {
    requestAnimationFrame(() => {
      adjusting.current = false;
    });
  }, []);

  /**
   * Re-pin the viewport to `pendingAnchor` once per frame for a short burst.
   * Every frame recomputes the anchor row's offset from the virtualizer, so
   * as the rows around it measure their real heights the reader does not
   * drift.
   */
  const runSettle = useCallback(() => {
    const element = scrollRef.current;
    const anchor = pendingAnchor.current;
    if (!element || !anchor) {
      settleRaf.current = null;
      releaseAdjusting();
      return;
    }

    const index = rowsRef.current.findIndex((row) => row.key === anchor.key);
    if (index >= 0) {
      const info = virtualizer.getOffsetForIndex(index, 'start');
      if (info) {
        adjusting.current = true;
        element.scrollTop = Math.max(
          0,
          getListOffset() + info[0] - anchor.offset,
        );
      }
    }

    if (index >= 0 && anchor.frames > 1) {
      pendingAnchor.current = { ...anchor, frames: anchor.frames - 1 };
      settleRaf.current = requestAnimationFrame(runSettle);
    } else {
      pendingAnchor.current = null;
      settleRaf.current = null;
      releaseAdjusting();
    }
  }, [virtualizer, releaseAdjusting, getListOffset]);

  const startSettle = useCallback(() => {
    if (!pendingAnchor.current) return;
    if (settleRaf.current != null) cancelAnimationFrame(settleRaf.current);
    settleRaf.current = requestAnimationFrame(runSettle);
  }, [runSettle]);

  /** Glue the viewport to the newest message for a few frames as it renders. */
  const pinBottom = useCallback(
    (frames = 10) => {
      if (settleRaf.current != null) cancelAnimationFrame(settleRaf.current);
      pendingAnchor.current = null;
      let left = frames;
      const step = () => {
        const element = scrollRef.current;
        if (!element) {
          settleRaf.current = null;
          return;
        }
        adjusting.current = true;
        element.scrollTop = element.scrollHeight;
        if (--left > 0) {
          settleRaf.current = requestAnimationFrame(step);
        } else {
          settleRaf.current = null;
          releaseAdjusting();
        }
      };
      settleRaf.current = requestAnimationFrame(step);
    },
    [releaseAdjusting],
  );

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    stickToBottom.current = true;
    setNewMessagesCount(0);
  }, []);

  /** Which day divider is currently under the top edge, and its push-off. */
  const updateFloatingDay = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const listTop = element.scrollTop - getListOffset();
    const currentRows = rowsRef.current;

    let activeTs: number | null = null;
    let nextStart: number | null = null;
    for (let index = 0; index < currentRows.length; index++) {
      const row = currentRows[index];
      if (row.kind !== 'separator') continue;
      const info = virtualizer.getOffsetForIndex(index, 'start');
      const start = info ? info[0] : index * 64;
      if (start <= listTop + 1) {
        activeTs = row.timestamp;
      } else {
        nextStart = start;
        break;
      }
    }

    if (activeTs == null) {
      setFloatingDay((current) => (current === null ? current : null));
      return;
    }

    // As the next day's divider scrolls up towards the top, ride the floating
    // chip up ahead of it so one hands off to the other rather than overlapping.
    const shift =
      nextStart != null
        ? Math.min(0, nextStart - listTop - DAY_CHIP_HEIGHT)
        : 0;
    const ts = activeTs;
    setFloatingDay((current) =>
      current && current.ts === ts && current.shift === shift
        ? current
        : { ts, shift },
    );
  }, [virtualizer, getListOffset]);

  const processScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    if (!adjusting.current) {
      const atBottom = isAtBottom();
      stickToBottom.current = atBottom;
      if (atBottom) setNewMessagesCount(0);

      if (
        conversationId &&
        restorePendingFor.current !== conversationId
      ) {
        const anchor = captureAnchor();
        const next: ScrollAnchor = { ...anchor, atBottom };
        setScrollAnchor(conversationId, next);
      }

      const firstVisibleIndex =
        virtualizer.getVirtualItems()[0]?.index ?? Number.MAX_SAFE_INTEGER;
      const nearTop = element.scrollTop < 400 || firstVisibleIndex <= 2;
      if (nearTop && hasMore && !loadingOlder.current && !isLoadingOlder) {
        loadingOlder.current = true;
        const anchor = captureAnchor();
        if (anchor.key) pendingAnchor.current = { ...anchor, frames: 16 };
        onLoadOlder?.();
      }
    }

    updateFloatingDay();
  }, [
    conversationId,
    hasMore,
    isLoadingOlder,
    isAtBottom,
    captureAnchor,
    onLoadOlder,
    updateFloatingDay,
    virtualizer,
  ]);

  /** Coalesce the scroll handler to one run per frame. */
  const onScroll = useCallback(() => {
    if (scrollRaf.current != null) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      processScroll();
    });
  }, [processScroll]);

  /*
   * A conversation switch: mark that we owe this conversation a restore, and
   * silence `onScroll` until the restore effect below has placed the view —
   * the rows arrive a commit or two later, and every scroll event in between
   * is the virtualizer settling, not the reader.
   */
  useLayoutEffect(() => {
    restorePendingFor.current = conversationId;
    setNewMessagesCount(0);
    setFloatingDay(null);
    pendingAnchor.current = null;
    if (settleRaf.current != null) {
      cancelAnimationFrame(settleRaf.current);
      settleRaf.current = null;
    }
    previousCount.current = messages.length;
    firstMessageKey.current = rowsRef.current.find(
      (row) => row.kind === 'message',
    )?.key;
    adjusting.current = !!conversationId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  /*
   * Place the view for the conversation being opened, once its rows are
   * actually in. Unread divider first (last-read mode), then the reader's
   * saved anchor, then — for a conversation with no memory — the newest
   * message.
   */
  useLayoutEffect(() => {
    if (restorePendingFor.current !== conversationId) return;

    const element = scrollRef.current;
    if (!element) return;

    if (!conversationId) {
      restorePendingFor.current = null;
      adjusting.current = false;
      return;
    }
    if (rows.length === 0) return; // this conversation's messages aren't in yet

    restorePendingFor.current = null;
    previousCount.current = messages.length;
    firstMessageKey.current = rows.find((row) => row.kind === 'message')?.key;

    const unreadIndex =
      openPosition !== 'newest' && unreadBeforeId
        ? rows.findIndex((row) => row.kind === 'unread')
        : -1;
    if (unreadIndex >= 0) {
      stickToBottom.current = false;
      pendingAnchor.current = {
        key: rows[unreadIndex].key,
        offset: 0,
        frames: 16,
      };
      startSettle();
      updateFloatingDay();
      return;
    }

    const saved =
      openPosition === 'newest' ? undefined : getScrollAnchor(conversationId);
    if (
      saved &&
      !saved.atBottom &&
      rows.some((row) => row.key === saved.key)
    ) {
      stickToBottom.current = false;
      pendingAnchor.current = {
        key: saved.key,
        offset: saved.offset,
        frames: 16,
      };
      startSettle();
      updateFloatingDay();
      return;
    }

    stickToBottom.current = true;
    pinBottom();
    updateFloatingDay();
  }, [
    conversationId,
    messages.length,
    rows,
    openPosition,
    unreadBeforeId,
    startSettle,
    pinBottom,
    updateFloatingDay,
  ]);

  // Runs before paint, so none of these corrections flicker.
  useLayoutEffect(() => {
    const diff = messages.length - previousCount.current;
    previousCount.current = messages.length;

    const prevFirstMessage = firstMessageKey.current;
    firstMessageKey.current = rows.find((row) => row.kind === 'message')?.key;

    if (diff === 0) return;
    if (restorePendingFor.current === conversationId) return; // switch owns it

    const prepended =
      !!prevFirstMessage &&
      prevFirstMessage !== firstMessageKey.current &&
      rows.some(
        (row) => row.kind === 'message' && row.key === prevFirstMessage,
      );

    if (prepended) {
      if (!pendingAnchor.current) {
        pendingAnchor.current = {
          key: prevFirstMessage,
          offset: 0,
          frames: 16,
        };
      }
      startSettle();
      return;
    }

    if (diff > 0) {
      if (stickToBottom.current) {
        pinBottom();
      } else {
        setNewMessagesCount((previous) => previous + diff);
      }
    }
  }, [messages.length, rows, conversationId, startSettle, pinBottom]);

  // Clear the backfill guard when the load resolves; drop a stashed anchor if
  // the page came back empty (nothing was prepended to hold onto).
  useEffect(() => {
    if (isLoadingOlder) return;
    loadingOlder.current = false;
    if (pendingAnchor.current && settleRaf.current == null) {
      pendingAnchor.current = null;
    }
  }, [isLoadingOlder]);

  // Keep the floating day chip honest after a prepend / switch / resize, not
  // only on scroll.
  useLayoutEffect(() => {
    updateFloatingDay();
  }, [rows, updateFloatingDay]);

  // Follow measure-driven height growth while pinned to the bottom (a card,
  // image or embed expanding, or the first page finishing its measure pass).
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (
      stickToBottom.current &&
      !pendingAnchor.current &&
      !adjusting.current &&
      restorePendingFor.current !== conversationId
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [totalSize, conversationId]);

  useLayoutEffect(() => {
    const target = virtualContainerRef.current;
    if (!target) return;

    const observer = new ResizeObserver(() => {
      const element = scrollRef.current;
      if (
        element &&
        stickToBottom.current &&
        !pendingAnchor.current &&
        !adjusting.current &&
        !restorePendingFor.current
      ) {
        element.scrollTop = element.scrollHeight;
      }
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (settleRaf.current != null) cancelAnimationFrame(settleRaf.current);
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    },
    [],
  );

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
          onScroll,
          role: 'log',
          'aria-label': 'Messages',
          'aria-live': 'polite',
        }}
      >
        {/*
          Reserved whenever there is more history, spinner or not, so the row
          does not appear and shove the timeline down the instant a backfill
          starts.
        */}
        {hasMore || isLoadingOlder ? (
          <div className="h-11 shrink-0 flex items-center justify-center">
            {isLoadingOlder ? (
              <Spinner label="Loading earlier messages" />
            ) : null}
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
          style={{ height: totalSize, position: 'relative' }}
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

      {/*
        Sticky "N new messages" bar — pinned to the top of the list for the
        messages that arrived while the reader was scrolled up. The body jumps
        to the newest; "Mark as read" clears it without moving the viewport.
      */}
      {newMessagesCount > 0 ? (
        <div
          className="top-0 inset-x-0 absolute z-30 gap-2 pl-4 pr-2 text-xs font-medium flex items-center justify-between border-b border-primary/20 bg-primary/10 text-primary-text animate-in fade-in slide-in-from-top-1 duration-200"
          style={{ height: NEW_MESSAGES_BAR_HEIGHT }}
        >
          <button
            type="button"
            onClick={scrollToBottom}
            className="h-full flex-1 text-left"
          >
            {newMessagesCount === 1
              ? '1 new message'
              : `${newMessagesCount} new messages`}
          </button>
          {onMarkRead ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs text-primary-text hover:bg-primary/15"
              onClick={() => {
                onMarkRead();
                setNewMessagesCount(0);
              }}
            >
              Mark as read
            </Button>
          ) : null}
        </div>
      ) : null}

      {/*
        The current day's divider, floating at the top of the viewport. The
        inline `DateSeparator` rows still scroll past normally underneath — this
        is the one that stays put, and `shift` lifts it out of the way as the
        next day's inline divider arrives at the top.
      */}
      {floatingDay ? (
        <div
          className="top-0 inset-x-0 absolute z-20 flex justify-center overflow-hidden pointer-events-none pb-2"
          style={
            newMessagesCount > 0
              ? { transform: `translateY(${NEW_MESSAGES_BAR_HEIGHT}px)` }
              : undefined
          }
        >
          <div
            className="mt-2 px-4 py-1 text-xs font-semibold rounded-full border border-border bg-surface text-foreground shadow-xs"
            style={{ transform: `translateY(${floatingDay.shift}px)` }}
          >
            {formatDaySeparatorLabel(floatingDay.ts)}
          </div>
        </div>
      ) : null}

      {/*
        Transient connection status — a floating pill that never takes layout
        height, so a sync blip does not push the timeline around. Blocking
        states (expired / error) go through the host's full-width banner.
      */}
      {connectionState ? (
        <div
          className="top-0 inset-x-0 absolute z-30 flex justify-center pt-2 pointer-events-none"
          style={
            newMessagesCount > 0
              ? { transform: `translateY(${NEW_MESSAGES_BAR_HEIGHT}px)` }
              : undefined
          }
        >
          <ConnectionPill state={connectionState} />
        </div>
      ) : null}

      {/* Floating jump-to-latest pill, with the faces of who you missed. */}
      {newMessagesCount > 0 ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Button
            variant="primary"
            size="sm"
            onClick={scrollToBottom}
            className="rounded-full shadow-lg gap-2 py-1 pl-2 pr-3.5 h-8 text-xs font-semibold"
            aria-label={`Jump to ${newMessagesCount} new messages`}
          >
            {newSenders.length > 0 ? (
              <UserAvatarGroup users={newSenders} size="xs" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
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

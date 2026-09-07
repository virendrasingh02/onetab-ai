import type { MessageListHandle } from '@org/chat-ui';
import type { Message } from '@org/matrix-client';
import { toast } from '@org/ui';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface UseMessageScrollTargetParams {
  /** The messages currently loaded in the timeline, by id. */
  messagesById: Map<string, Message>;
  /** Whether older history remains to be paged in. */
  hasMore: boolean;
  /** True while a backfill request is in flight. */
  isLoadingOlder: boolean;
  /** Asks the host to page in the next older window. */
  loadOlder: () => void;
  /** Handle of the virtualised `MessageList`, for index-based scrolling. */
  listRef: RefObject<MessageListHandle | null>;
  /** Sets / clears the briefly-highlighted message id. */
  onHighlight: (messageId: string | null) => void;
}

export interface ScrollToMessageOptions {
  /** How long the target stays highlighted, ms. `0` disables the highlight. */
  highlightMs?: number;
}

const DEFAULT_HIGHLIGHT_MS = 2200;
/** Upper bound on backfill rounds when hunting for an off-screen message. */
const MAX_BACKFILL_ROUNDS = 25;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const now = () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = () => {
      if (predicate() || now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * A reliable "go to this message" for the virtualised timeline.
 *
 * `MessageList` mounts only the rows near the viewport, so a plain
 * `scrollIntoView` misses anything not currently rendered, and a message from
 * further back in history is not in the DOM at all. This resolves both: it
 * pages older history in until the target is loaded, scrolls the virtualiser to
 * its row (falling back to a DOM query for the non-virtualised thread panel),
 * waits a frame for it to mount, highlights it, then fades the highlight out.
 * Missing / deleted targets fail quietly with a toast.
 *
 * Reused by the unread-mentions pill, `?msg=` deep links, conversation search
 * and the pinned panel — the one place message navigation lives.
 */
export function useMessageScrollTarget(params: UseMessageScrollTargetParams) {
  const ref = useRef(params);
  ref.current = params;
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  return useCallback(
    async (
      messageId: string,
      options: ScrollToMessageOptions = {},
    ): Promise<boolean> => {
      const { highlightMs = DEFAULT_HIGHLIGHT_MS } = options;
      const has = () => ref.current.messagesById.has(messageId);

      let rounds = 0;
      while (!has() && ref.current.hasMore && rounds < MAX_BACKFILL_ROUNDS) {
        rounds += 1;
        const sizeBefore = ref.current.messagesById.size;
        ref.current.loadOlder();
        // Sequential on purpose: each round pages in the next older window and
        // we stop as soon as the target (or the start of history) is reached.
        // Wait for the page to land or the target to appear, whichever first.
        await waitFor(
          () =>
            has() ||
            (!ref.current.isLoadingOlder &&
              ref.current.messagesById.size !== sizeBefore),
          5000,
        );
        await nextFrame();
        // A completed round that added nothing means we have hit the start of
        // history (or the page is stuck) — stop rather than spin the cap out.
        if (
          !has() &&
          !ref.current.isLoadingOlder &&
          ref.current.messagesById.size === sizeBefore
        ) {
          break;
        }
      }

      if (!has()) {
        toast.error('That message could not be found.', {
          description: 'It may have been deleted or is no longer available.',
        });
        return false;
      }

      const scrolled =
        ref.current.listRef.current?.scrollToMessage(messageId) ?? false;
      if (!scrolled) {
        await nextFrame();
        document
          .querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }

      // Let the row mount before painting the highlight on it.
      await nextFrame();
      ref.current.onHighlight(messageId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (highlightMs > 0) {
        highlightTimer.current = setTimeout(() => {
          ref.current.onHighlight(null);
        }, highlightMs);
      }

      return true;
    },
    [],
  );
}

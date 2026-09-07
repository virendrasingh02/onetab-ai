import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScrollToMessageOptions } from './use-message-scroll-target.js';

export interface UseMentionNavigationParams {
  /** Unread mention event ids for this conversation, oldest first. */
  ids: string[];
  /** Unread mentions older than the loaded window — forces an "up" affordance. */
  unloadedCount: number;
  /**
   * The timeline's scroll viewport. Mention rows are located inside it by
   * `data-message-id`; their position relative to its edges gives the arrow
   * direction without touching the virtualiser or a per-scroll layout pass.
   */
  scrollElement: HTMLElement | null;
  /** Jump + highlight — from {@link useMessageScrollTarget}. */
  scrollToMessage: (
    messageId: string,
    options?: ScrollToMessageOptions,
  ) => Promise<boolean>;
  /**
   * The id actually reached, so the host can advance the read marker to it
   * (which drops it — and everything before it — out of `ids` on the next
   * recompute, so a second click lands on the following mention).
   */
  onMentionReached?: (messageId: string) => void;
}

export interface MentionNavigation {
  /**
   * `down` — the nearest unread mention is below the viewport; `up` — above it
   * (or only older, unloaded ones remain); `null` — every remaining mention is
   * in view, so the pill hides.
   */
  direction: 'up' | 'down' | null;
  /** Unread mentions still ahead of the reader in `direction` (SR label). */
  remaining: number;
  /** Walk to the next unread mention in the current direction. */
  jumpToNext: () => void;
}

interface Split {
  above: string[];
  below: string[];
  inView: string[];
}

/** Buckets mention rows by where they sit relative to the viewport edges. */
function splitByViewport(
  ids: readonly string[],
  scrollElement: HTMLElement | null,
): Split {
  const above: string[] = [];
  const below: string[] = [];
  const inView: string[] = [];
  if (!scrollElement) return { above, below, inView };

  const bounds = scrollElement.getBoundingClientRect();
  for (const id of ids) {
    const row = scrollElement.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(id)}"]`,
    );
    if (!row) {
      // Loaded but not mounted → it is outside the overscan window, i.e. well
      // above or below. Ordered ids let us guess: compare to what we have seen.
      below.push(id);
      continue;
    }
    const rect = row.getBoundingClientRect();
    if (rect.bottom < bounds.top + 4) above.push(id);
    else if (rect.top > bounds.bottom - 4) below.push(id);
    else inView.push(id);
  }
  return { above, below, inView };
}

/**
 * Direction + cursor for stepping through a conversation's unread `@mentions`.
 *
 * Direction is recomputed from the mention rows' rects on a coalesced scroll
 * frame (a handful of `querySelector`s, not a full timeline scan), plus on
 * resize and whenever the mention set changes. `jumpToNext` picks the nearest
 * unread mention in that direction and hands it to `scrollToMessage`.
 */
export function useMentionNavigation({
  ids,
  unloadedCount,
  scrollElement,
  scrollToMessage,
  onMentionReached,
}: UseMentionNavigationParams): MentionNavigation {
  const [nav, setNav] = useState<{ direction: 'up' | 'down' | null; remaining: number }>(
    { direction: null, remaining: 0 },
  );
  const idsKey = ids.join(',');
  const busy = useRef(false);
  const latest = useRef({ ids, unloadedCount, scrollElement });
  latest.current = { ids, unloadedCount, scrollElement };

  useEffect(() => {
    const element = scrollElement;
    let frame: number | null = null;

    const recompute = () => {
      frame = null;
      const { above, below } = splitByViewport(
        latest.current.ids,
        latest.current.scrollElement,
      );
      const unloaded = latest.current.unloadedCount;

      if (latest.current.ids.length === 0 && unloaded === 0) {
        setNav((current) =>
          current.direction === null && current.remaining === 0
            ? current
            : { direction: null, remaining: 0 },
        );
        return;
      }

      let direction: 'up' | 'down' | null;
      let remaining: number;
      if (below.length > 0) {
        direction = 'down';
        remaining = below.length;
      } else if (above.length > 0 || unloaded > 0) {
        direction = 'up';
        remaining = above.length + unloaded;
      } else {
        direction = null;
        remaining = 0;
      }

      setNav((current) =>
        current.direction === direction && current.remaining === remaining
          ? current
          : { direction, remaining },
      );
    };

    const schedule = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(recompute);
    };

    recompute();
    element?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      element?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame != null) cancelAnimationFrame(frame);
    };
    // `idsKey` stands in for the mutable `ids` array; `latest` carries the rest.
  }, [idsKey, unloadedCount, scrollElement]);

  const jumpToNext = useCallback(() => {
    if (busy.current) return;
    const { ids: currentIds, scrollElement: element } = latest.current;
    const { above, below } = splitByViewport(currentIds, element);

    const target =
      below.length > 0
        ? below[0]
        : above.length > 0
          ? above[above.length - 1]
          : currentIds[0];
    if (!target) return;

    busy.current = true;
    void scrollToMessage(target)
      .then((ok) => {
        if (ok) onMentionReached?.(target);
      })
      .finally(() => {
        busy.current = false;
      });
  }, [scrollToMessage, onMentionReached]);

  return { direction: nav.direction, remaining: nav.remaining, jumpToNext };
}

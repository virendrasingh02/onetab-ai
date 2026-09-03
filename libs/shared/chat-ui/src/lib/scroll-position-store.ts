/**
 * Per-conversation scroll memory for `MessageList`.
 *
 * Module-level rather than component state, deliberately: the surface a
 * conversation renders in can itself be recreated (a route change that does
 * remount it, a panel closed and reopened) without that being a reason to
 * forget where the reader was. A `Map` keyed by conversation id is the same
 * shape a browser tab's own scroll-restoration memory takes, kept here
 * because the app owns one scroll container per conversation rather than a
 * full page per conversation.
 *
 * The position is stored as an *anchor* — the key of the row sitting at the
 * top edge of the viewport plus the pixel offset into it — not a raw
 * `scrollTop`. The list is virtualised, so a raw offset means nothing until
 * every row above it has been measured; a row key survives the measure pass
 * and paging in older history, and `MessageList` can scroll straight back to
 * it. `atBottom` short-circuits all of that: a reader who was following the
 * conversation live just wants the newest message again.
 *
 * Not persisted beyond the session — this is reading-position memory for a
 * conversation you might switch back to in the next few minutes, not a
 * bookmark. Reloading the app is expected to reset it, the same as it would
 * scroll position on a regular web page.
 */
export interface ScrollAnchor {
  /** `getItemKey` of the row at the top edge of the viewport. */
  key: string;
  /** Pixels from the viewport top to that row's top — usually `<= 0`. */
  offset: number;
  /** The reader was pinned to the newest message; ignore `key`/`offset`. */
  atBottom: boolean;
}

const anchors = new Map<string, ScrollAnchor>();

export function getScrollAnchor(conversationId: string): ScrollAnchor | undefined {
  return anchors.get(conversationId);
}

export function setScrollAnchor(
  conversationId: string,
  anchor: ScrollAnchor,
): void {
  anchors.set(conversationId, anchor);
}

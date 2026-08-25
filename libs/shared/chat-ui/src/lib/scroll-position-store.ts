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
 * Not persisted beyond the session — this is reading-position memory for a
 * conversation you might switch back to in the next few minutes, not a
 * bookmark. Reloading the app is expected to reset it, the same as it would
 * scroll position on a regular web page.
 */
const positions = new Map<string, number>();

export function getScrollPosition(conversationId: string): number | undefined {
  return positions.get(conversationId);
}

export function setScrollPosition(
  conversationId: string,
  scrollTop: number,
): void {
  positions.set(conversationId, scrollTop);
}

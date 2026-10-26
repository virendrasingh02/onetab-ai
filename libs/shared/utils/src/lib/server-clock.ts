/**
 * Server-aligned clock.
 *
 * Message timestamps come from the server (Matrix `origin_server_ts`), while
 * "how long ago" was previously measured against the device clock. A device
 * that is a few minutes off then shows "Just now" next to a message that is
 * visibly later, or never leaves "Just now" at all. Every API response that
 * carries a server time (the sync digest) feeds the offset here so relative
 * labels are measured against the same clock that stamped the message.
 */

let offsetMs = 0;
const listeners = new Set<() => void>();

/** Record the server's current time as observed at `receivedAt` (device clock). */
export function syncServerTime(serverTimeMs: number, receivedAt = Date.now()): void {
  if (!Number.isFinite(serverTimeMs)) return;
  const next = serverTimeMs - receivedAt;
  // Ignore sub-second jitter so subscribers don't re-render on every poll.
  if (Math.abs(next - offsetMs) < 1000) return;
  offsetMs = next;
  listeners.forEach((listener) => listener());
}

/** Current time on the server's clock. Equals `Date.now()` until first synced. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function getServerClockOffset(): number {
  return offsetMs;
}

export function subscribeServerClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

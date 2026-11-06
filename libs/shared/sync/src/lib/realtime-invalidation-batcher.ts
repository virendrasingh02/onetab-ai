import { partialMatchKey, type QueryKey } from '@tanstack/react-query';

/** Quiet time that ends a burst. Short enough that one event still feels live. */
export const INVALIDATION_WINDOW_MS = 200;
/**
 * Longest a key can wait. A steady stream never goes quiet, so without this cap
 * a busy board would stop updating until the stream ended.
 */
export const INVALIDATION_MAX_WAIT_MS = 1000;

/**
 * Collects the query keys from a burst of realtime events and hands them over
 * once, so a bulk change costs one refetch per query rather than one per event.
 *
 * A pending key that sits under a broader pending key is dropped, because
 * invalidating `['a']` already covers `['a', 'b']`.
 */
export class InvalidationBatcher {
  private pending: QueryKey[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline: number | null = null;

  constructor(
    private readonly onFlush: (keys: readonly QueryKey[]) => void,
    private readonly windowMs = INVALIDATION_WINDOW_MS,
    private readonly maxWaitMs = INVALIDATION_MAX_WAIT_MS,
  ) {}

  get size(): number {
    return this.pending.length;
  }

  add(queryKey: QueryKey): void {
    if (!this.pending.some((key) => partialMatchKey(queryKey, key))) {
      this.pending = this.pending.filter((key) => !partialMatchKey(key, queryKey));
      this.pending.push(queryKey);
    }

    const now = Date.now();
    this.deadline ??= now + this.maxWaitMs;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.flush(),
      Math.min(this.windowMs, this.deadline - now),
    );
  }

  /** Forgets everything pending without invalidating it. */
  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
    this.pending = [];
  }

  private flush(): void {
    const keys = this.pending;
    this.clear();
    this.onFlush(keys);
  }
}

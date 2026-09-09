import { ApiError } from '@org/api-client';

/**
 * The backoff ladder for a failing background operation, in milliseconds.
 * Matches the brief: 5s → 10s → 30s → 60s → 2m → 5m, then holds at the cap.
 * A successful run calls {@link RetryPolicy.reset} and the ladder starts over.
 */
export const BACKOFF_LADDER_MS = [
  5_000, 10_000, 30_000, 60_000, 120_000, 300_000,
] as const;

export const MAX_BACKOFF_MS = BACKOFF_LADDER_MS[BACKOFF_LADDER_MS.length - 1];

export type ErrorClass =
  | 'network'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'rate-limit'
  | 'timeout'
  | 'conflict'
  | 'server'
  | 'unknown';

export interface ClassifiedError {
  class: ErrorClass;
  /** Safe to retry the exact same operation unchanged. */
  retryable: boolean;
  status: number;
}

/**
 * Buckets an error so the caller knows whether retrying is pointless (a 400, a
 * 403), harmful (a 401 — stop and let the shared refresh flow handle it), or
 * worth backing off on (a 500, a timeout, an offline network).
 */
export function classifyError(error: unknown): ClassifiedError {
  const status =
    error instanceof ApiError
      ? error.status
      : typeof (error as { status?: number })?.status === 'number'
        ? (error as { status: number }).status
        : 0;

  if (status === 0) {
    // No response — offline, DNS failure, connection reset, CORS. Always
    // transient from the client's point of view.
    return { class: 'network', retryable: true, status };
  }
  if (status === 401) {
    return { class: 'auth', retryable: false, status };
  }
  if (status === 403) {
    return { class: 'permission', retryable: false, status };
  }
  if (status === 408 || status === 504) {
    return { class: 'timeout', retryable: true, status };
  }
  if (status === 409 || status === 412 || status === 428) {
    return { class: 'conflict', retryable: false, status };
  }
  if (status === 429) {
    return { class: 'rate-limit', retryable: true, status };
  }
  if (status >= 500) {
    return { class: 'server', retryable: true, status };
  }
  if (status >= 400) {
    return { class: 'validation', retryable: false, status };
  }
  return { class: 'unknown', retryable: false, status };
}

/**
 * A single, resettable backoff counter. One per failing unit of work (the
 * catch-up fetch, a scheduled resource, the offline-queue drain).
 */
export class RetryPolicy {
  private attempt = 0;

  /** Whether at least one failure is outstanding. */
  get failing(): boolean {
    return this.attempt > 0;
  }

  get attempts(): number {
    return this.attempt;
  }

  /**
   * The backoff floor for the *current* attempt count, without advancing it or
   * adding jitter. Used to hold a failing resource off until its delay elapses.
   */
  currentFloor(): number {
    if (this.attempt === 0) return 0;
    const index = Math.min(this.attempt - 1, BACKOFF_LADDER_MS.length - 1);
    return BACKOFF_LADDER_MS[index];
  }

  /**
   * Records a failure and returns how long to wait before the next try. Adds
   * ±15% jitter so a fleet of tabs recovering from the same outage does not
   * stampede the API in lockstep.
   */
  nextDelay(): number {
    const index = Math.min(this.attempt, BACKOFF_LADDER_MS.length - 1);
    const base = BACKOFF_LADDER_MS[index];
    this.attempt += 1;
    const jitter = base * 0.15 * (Math.random() * 2 - 1);
    return Math.max(1_000, Math.round(base + jitter));
  }

  /** Clears the backoff after a successful run. */
  reset(): void {
    this.attempt = 0;
  }
}

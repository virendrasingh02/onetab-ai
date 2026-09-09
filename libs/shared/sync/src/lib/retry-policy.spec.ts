import { ApiError } from '@org/api-client';
import { ApiErrorCode } from '@org/types';
import { describe, expect, it } from 'vitest';
import {
  BACKOFF_LADDER_MS,
  MAX_BACKOFF_MS,
  RetryPolicy,
  classifyError,
} from './retry-policy.js';

function apiError(status: number): ApiError {
  return new ApiError({
    statusCode: status,
    code: ApiErrorCode.INTERNAL,
    message: 'x',
    path: '/x',
    timestamp: new Date().toISOString(),
  });
}

describe('classifyError', () => {
  it('treats a missing response (status 0) as a retryable network error', () => {
    const c = classifyError(new Error('offline'));
    expect(c).toMatchObject({ class: 'network', retryable: true, status: 0 });
  });

  it('never retries auth (401) or permission (403)', () => {
    expect(classifyError(apiError(401))).toMatchObject({
      class: 'auth',
      retryable: false,
    });
    expect(classifyError(apiError(403))).toMatchObject({
      class: 'permission',
      retryable: false,
    });
  });

  it('does not retry a plain validation 4xx but does retry 408/429', () => {
    expect(classifyError(apiError(400)).retryable).toBe(false);
    expect(classifyError(apiError(422)).retryable).toBe(false);
    expect(classifyError(apiError(408)).retryable).toBe(true);
    expect(classifyError(apiError(429))).toMatchObject({
      class: 'rate-limit',
      retryable: true,
    });
  });

  it('treats a write conflict (409/412/428) as terminal', () => {
    for (const status of [409, 412, 428]) {
      expect(classifyError(apiError(status))).toMatchObject({
        class: 'conflict',
        retryable: false,
      });
    }
  });

  it('retries 5xx', () => {
    expect(classifyError(apiError(500)).retryable).toBe(true);
    expect(classifyError(apiError(503)).retryable).toBe(true);
  });
});

describe('RetryPolicy', () => {
  it('walks the backoff ladder and holds at the cap', () => {
    const p = new RetryPolicy();
    expect(p.failing).toBe(false);

    const seen: number[] = [];
    for (let i = 0; i < BACKOFF_LADDER_MS.length + 3; i += 1) {
      seen.push(p.nextDelay());
    }
    // Each delay is within ±15% of the corresponding ladder rung (last rung
    // repeats once the ladder is exhausted).
    seen.forEach((delay, i) => {
      const rung = BACKOFF_LADDER_MS[Math.min(i, BACKOFF_LADDER_MS.length - 1)];
      expect(delay).toBeGreaterThanOrEqual(Math.round(rung * 0.85) - 1);
      expect(delay).toBeLessThanOrEqual(Math.round(rung * 1.15) + 1);
    });
    expect(seen[seen.length - 1]).toBeLessThanOrEqual(
      Math.round(MAX_BACKOFF_MS * 1.15) + 1,
    );
    expect(p.failing).toBe(true);
  });

  it('currentFloor reflects the attempt count without advancing it', () => {
    const p = new RetryPolicy();
    expect(p.currentFloor()).toBe(0);
    p.nextDelay(); // attempt 1
    expect(p.currentFloor()).toBe(BACKOFF_LADDER_MS[0]);
    p.nextDelay(); // attempt 2
    expect(p.currentFloor()).toBe(BACKOFF_LADDER_MS[1]);
    expect(p.attempts).toBe(2);
  });

  it('reset clears the backoff', () => {
    const p = new RetryPolicy();
    p.nextDelay();
    p.nextDelay();
    p.reset();
    expect(p.failing).toBe(false);
    expect(p.attempts).toBe(0);
    expect(p.currentFloor()).toBe(0);
  });
});

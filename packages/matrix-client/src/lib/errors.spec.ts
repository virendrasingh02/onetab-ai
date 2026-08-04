import { isRetryable, toMatrixError, withRetry } from './errors.js';
import { MatrixError } from './types.js';

describe('toMatrixError', () => {
  it('maps Matrix errcodes onto transport-neutral codes', () => {
    expect(toMatrixError({ errcode: 'M_FORBIDDEN' }).code).toBe('FORBIDDEN');
    expect(toMatrixError({ errcode: 'M_UNKNOWN_TOKEN' }).code).toBe(
      'SESSION_EXPIRED',
    );
    expect(toMatrixError({ errcode: 'M_LIMIT_EXCEEDED' }).code).toBe(
      'RATE_LIMITED',
    );
  });

  it('carries the server-supplied retry delay', () => {
    const error = toMatrixError({
      errcode: 'M_LIMIT_EXCEEDED',
      data: { retry_after_ms: 4200 },
    });
    expect(error.retryAfterMs).toBe(4200);
  });

  it('falls back to the HTTP status when there is no errcode', () => {
    expect(toMatrixError({ httpStatus: 403 }).code).toBe('FORBIDDEN');
    expect(toMatrixError({ httpStatus: 429 }).code).toBe('RATE_LIMITED');
  });

  it('treats a connection failure as NETWORK', () => {
    expect(toMatrixError({ name: 'ConnectionError' }).code).toBe('NETWORK');
  });

  it('passes an existing MatrixError through unchanged', () => {
    const original = new MatrixError('ENCRYPTION', 'nope');
    expect(toMatrixError(original)).toBe(original);
  });

  it('never throws on unexpected input', () => {
    expect(toMatrixError(undefined).code).toBe('UNKNOWN');
    expect(toMatrixError('a string').code).toBe('UNKNOWN');
  });
});

describe('isRetryable', () => {
  it('retries transient failures only', () => {
    expect(isRetryable(new MatrixError('NETWORK', ''))).toBe(true);
    expect(isRetryable(new MatrixError('RATE_LIMITED', ''))).toBe(true);
    expect(isRetryable(new MatrixError('FORBIDDEN', ''))).toBe(false);
    expect(isRetryable(new MatrixError('SESSION_EXPIRED', ''))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the first successful result without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('retries a transient failure and then succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ name: 'ConnectionError' })
      .mockResolvedValue('recovered');

    await expect(withRetry(operation, { baseDelayMs: 1 })).resolves.toBe(
      'recovered',
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent failure', async () => {
    const operation = vi.fn().mockRejectedValue({ errcode: 'M_FORBIDDEN' });

    await expect(
      withRetry(operation, { baseDelayMs: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // A 403 will never become a 200; retrying only delays the error.
    expect(operation).toHaveBeenCalledOnce();
  });

  it('gives up after the configured number of attempts', async () => {
    const operation = vi.fn().mockRejectedValue({ name: 'ConnectionError' });

    await expect(
      withRetry(operation, { attempts: 3, baseDelayMs: 1 }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('honours an abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn();

    await expect(
      withRetry(operation, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    expect(operation).not.toHaveBeenCalled();
  });
});

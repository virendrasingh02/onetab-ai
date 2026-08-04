import { MatrixError, type MatrixErrorCode } from './types.js';

interface SdkErrorShape {
  errcode?: string;
  httpStatus?: number;
  message?: string;
  data?: { retry_after_ms?: number; error?: string };
  name?: string;
}

/** Matrix `M_` error codes mapped onto our transport-neutral codes. */
const ERRCODE_MAP: Record<string, MatrixErrorCode> = {
  M_FORBIDDEN: 'FORBIDDEN',
  M_UNKNOWN_TOKEN: 'SESSION_EXPIRED',
  M_MISSING_TOKEN: 'SESSION_EXPIRED',
  M_NOT_FOUND: 'NOT_FOUND',
  M_LIMIT_EXCEEDED: 'RATE_LIMITED',
  M_USER_DEACTIVATED: 'SESSION_EXPIRED',
  M_UNAUTHORIZED: 'INVALID_CREDENTIALS',
};

const STATUS_MAP: Record<number, MatrixErrorCode> = {
  401: 'SESSION_EXPIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

/**
 * Normalises anything thrown by the SDK into a `MatrixError`.
 *
 * Callers outside this package must never have to inspect `errcode` or an HTTP
 * status — that coupling is exactly what the abstraction exists to prevent.
 */
export function toMatrixError(error: unknown): MatrixError {
  if (error instanceof MatrixError) return error;

  const sdkError = error as SdkErrorShape | undefined;

  if (sdkError?.errcode) {
    const code = ERRCODE_MAP[sdkError.errcode] ?? 'UNKNOWN';
    return new MatrixError(
      code,
      sdkError.data?.error ?? sdkError.message ?? sdkError.errcode,
      sdkError.data?.retry_after_ms,
    );
  }

  if (sdkError?.httpStatus && STATUS_MAP[sdkError.httpStatus]) {
    return new MatrixError(
      STATUS_MAP[sdkError.httpStatus],
      sdkError.message ?? `Request failed with ${sdkError.httpStatus}`,
      sdkError.data?.retry_after_ms,
    );
  }

  // ConnectionError is what the SDK throws when the request never landed.
  if (sdkError?.name === 'ConnectionError' || sdkError?.name === 'AbortError') {
    return new MatrixError(
      'NETWORK',
      'Could not reach the homeserver. Check your connection.',
    );
  }

  return new MatrixError(
    'UNKNOWN',
    error instanceof Error ? error.message : 'An unexpected error occurred.',
  );
}

/** True when retrying could plausibly succeed. */
export function isRetryable(error: MatrixError): boolean {
  return (
    error.code === 'NETWORK' ||
    error.code === 'RATE_LIMITED' ||
    error.code === 'UNKNOWN'
  );
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
}

/**
 * Retries an operation with exponential backoff and full jitter.
 *
 * Jitter matters here: without it, every client that lost connection at the
 * same moment retries in lockstep and stampedes the homeserver on recovery.
 * A server-supplied `retry_after_ms` always wins over the computed delay.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 4,
    baseDelayMs = 500,
    maxDelayMs = 15_000,
    signal,
  } = options;

  let lastError: MatrixError | undefined;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) {
      throw new MatrixError('NETWORK', 'The operation was cancelled.');
    }

    try {
      return await operation();
    } catch (raw) {
      const error = toMatrixError(raw);
      lastError = error;

      if (!isRetryable(error) || attempt === attempts - 1) throw error;

      const exponential = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const delay = error.retryAfterMs ?? Math.random() * exponential;

      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new MatrixError('UNKNOWN', 'Retry loop exhausted.');
}

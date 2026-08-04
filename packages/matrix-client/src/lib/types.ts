/**
 * Transport-level types.
 *
 * The domain model lives in `@org/types`: messages, rooms and presence are
 * application concepts, not Matrix ones, so presentational libraries can use
 * them without depending on this package. Only the error type — which encodes
 * transport failure modes — belongs here.
 */
export * from '@org/types';

// --- errors ----------------------------------------------------------------

export type MatrixErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'ENCRYPTION'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

/** Transport-neutral error. Callers never see a raw SDK error. */
export class MatrixError extends Error {
  readonly code: MatrixErrorCode;
  readonly retryAfterMs?: number;

  constructor(code: MatrixErrorCode, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'MatrixError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Cursor-paginated collection. Cursors avoid offset drift on live lists. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

/**
 * Error body emitted by the API's exception filter. The client narrows on
 * `code` for behaviour and shows `message` to the user.
 */
export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  /** Field-level failures, keyed by dotted path. */
  errors?: Record<string, string[]>;
  path: string;
  timestamp: string;
  requestId?: string;
}

export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** Tokens returned by the auth endpoints. */
export interface AuthTokens {
  accessToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
  tokenType: 'Bearer';
  /**
   * The opaque refresh token.
   *
   * Omitted on the plain browser path, where it is delivered as an httpOnly
   * cookie instead. Present for clients that cannot use that cookie and must
   * hold the token themselves: the desktop shell, and a browser multi-account
   * session keeping a *background* account alive (a browser has only one
   * refresh cookie, so every account past the first carries its own token).
   */
  refreshToken?: string;
}

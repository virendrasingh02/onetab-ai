/**
 * Custom error hierarchy for email operations.
 * All errors ensure sensitive information (API keys, authorization headers, raw tokens)
 * is never leaked in error messages or logs.
 */

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/re_[a-zA-Z0-9_-]+/g, 're_***')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***')
    .replace(/token=[a-zA-Z0-9._-]+/gi, 'token=***');
}

export class EmailError extends Error {
  public readonly code: string;
  public readonly isTransient: boolean;
  public readonly status?: number;

  constructor(message: string, code = 'EMAIL_ERROR', isTransient = false, status?: number) {
    super(sanitizeErrorMessage(message));
    this.name = this.constructor.name;
    this.code = code;
    this.isTransient = isTransient;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EmailConfigurationError extends EmailError {
  constructor(message: string) {
    super(message, 'EMAIL_CONFIGURATION_ERROR', false);
  }
}

export class EmailAuthenticationError extends EmailError {
  constructor(message = 'Failed to authenticate with email provider (401/403)') {
    super(message, 'EMAIL_AUTHENTICATION_ERROR', false, 401);
  }
}

export class EmailRateLimitError extends EmailError {
  public readonly retryAfterSeconds?: number;

  constructor(message = 'Email provider rate limit reached (429)', retryAfterSeconds?: number) {
    super(message, 'EMAIL_RATE_LIMIT_ERROR', true, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class EmailValidationError extends EmailError {
  constructor(message: string, status = 422) {
    super(message, 'EMAIL_VALIDATION_ERROR', false, status);
  }
}

export class EmailTransientError extends EmailError {
  constructor(message: string, status?: number) {
    super(message, 'EMAIL_TRANSIENT_ERROR', true, status);
  }
}

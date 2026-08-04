import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque secret generation and hashing for refresh tokens, password resets and
 * invitations.
 *
 * The plaintext is returned to the caller exactly once (emailed or set as a
 * cookie); only the SHA-256 digest is stored, so a database leak yields no
 * usable tokens. SHA-256 is correct here — unlike passwords these are
 * high-entropy random values, so a slow KDF buys nothing.
 */

export function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison, to keep digest checks free of timing signal. */
export function tokensMatch(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Milliseconds for a duration string such as `15m`, `7d`, `30s`, `12h`. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Use a form like "15m", "7d" or "30s".`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2] as 'ms' | 's' | 'm' | 'h' | 'd';
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  } as const;
  return amount * multipliers[unit];
}

export function expiresAt(duration: string, from: Date = new Date()): Date {
  return new Date(from.getTime() + parseDuration(duration));
}

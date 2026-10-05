import {
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey,
} from 'node:crypto';
import axios from 'axios';

/** One RSA signing key from a provider's JWKS document. */
export interface Jwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

/** The ID-token claims sign-in relies on. Everything else is ignored. */
export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

export class IdTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdTokenError';
  }
}

const KEYS_TTL_MS = 60 * 60 * 1000;
/** A `kid` miss forces a refetch (the provider rotated keys) — at most this often. */
const MISS_REFETCH_INTERVAL_MS = 60 * 1000;

/**
 * Caches a provider's published signing keys. An unknown `kid` triggers one
 * refetch, since providers rotate keys without notice; a stale cache is still
 * served if the provider is briefly unreachable.
 */
export class JwksCache {
  private keys: Jwk[] = [];
  private fetchedAt = 0;

  constructor(
    private readonly url: string,
    private readonly fetchKeys: (
      url: string,
    ) => Promise<Jwk[]> = defaultFetchKeys,
  ) {}

  async getKey(kid: string): Promise<Jwk | undefined> {
    const age = Date.now() - this.fetchedAt;
    if (age > KEYS_TTL_MS) await this.refresh();

    let key = this.keys.find((k) => k.kid === kid);
    if (!key && Date.now() - this.fetchedAt > MISS_REFETCH_INTERVAL_MS) {
      await this.refresh();
      key = this.keys.find((k) => k.kid === kid);
    }
    return key;
  }

  private async refresh(): Promise<void> {
    try {
      this.keys = await this.fetchKeys(this.url);
      this.fetchedAt = Date.now();
    } catch (error) {
      if (this.keys.length === 0) throw error;
      // Keep serving the cached set; retry on the next miss.
    }
  }
}

async function defaultFetchKeys(url: string): Promise<Jwk[]> {
  const res = await axios.get<{ keys: Jwk[] }>(url, { timeout: 10_000 });
  return Array.isArray(res.data?.keys) ? res.data.keys : [];
}

function decodeSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw new IdTokenError('ID token is not valid JSON.');
  }
}

/** Allowed clock drift between us and the provider, in seconds. */
const CLOCK_SKEW_S = 60;

/**
 * Verifies an OIDC ID token: RS256 signature against the provider's JWKS,
 * then issuer, audience, expiry, issued-at and (when one was sent) nonce.
 * Every check is mandatory — any failure throws {@link IdTokenError}.
 */
export async function verifyIdToken(
  token: string,
  options: {
    jwks: JwksCache;
    issuers: readonly string[];
    audience: string;
    nonce?: string;
    now?: number;
  },
): Promise<IdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    throw new IdTokenError('ID token is malformed.');
  }
  const [encHeader, encPayload, encSignature] = parts as [
    string,
    string,
    string,
  ];

  const header = decodeSegment<{ alg?: string; kid?: string }>(encHeader);
  if (header.alg !== 'RS256') {
    throw new IdTokenError(
      `Unsupported ID token algorithm: ${String(header.alg)}.`,
    );
  }
  if (!header.kid) throw new IdTokenError('ID token has no key id.');

  const jwk = await options.jwks.getKey(header.kid);
  if (!jwk || jwk.kty !== 'RSA') {
    throw new IdTokenError('ID token was signed with an unknown key.');
  }

  const valid = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${encHeader}.${encPayload}`),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(encSignature, 'base64url'),
  );
  if (!valid) throw new IdTokenError('ID token signature is invalid.');

  const claims = decodeSegment<IdTokenClaims>(encPayload);
  const now = Math.floor((options.now ?? Date.now()) / 1000);

  if (!options.issuers.includes(claims.iss)) {
    throw new IdTokenError('ID token issuer is not trusted.');
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.audience)) {
    throw new IdTokenError('ID token was issued for a different client.');
  }
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S <= now) {
    throw new IdTokenError('ID token has expired.');
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now) {
    throw new IdTokenError('ID token was issued in the future.');
  }
  if (options.nonce !== undefined && claims.nonce !== options.nonce) {
    throw new IdTokenError('ID token nonce does not match this sign-in.');
  }
  if (!claims.sub) throw new IdTokenError('ID token has no subject.');

  return claims;
}

/** Google sends a boolean; Apple sends `true` or the string `"true"`. */
export function isEmailVerified(
  claims: Pick<IdTokenClaims, 'email_verified'>,
): boolean {
  return claims.email_verified === true || claims.email_verified === 'true';
}

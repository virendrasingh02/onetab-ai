import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Derives a dedicated 256-bit encryption key from the application secret
 * using HKDF-SHA256 with an enterprise SSO salt/info tag.
 */
export function deriveSecretKey(baseSecret: string, purpose = 'enterprise-sso-secrets-v1'): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      baseSecret,
      Buffer.alloc(0),
      purpose,
      32,
    ),
  );
}

/**
 * Encrypts sensitive credentials (OIDC client secrets, recovery keys) using AES-256-GCM.
 * Output format: `<iv_base64url>.<authTag_base64url>.<ciphertext_base64url>`
 */
export function encryptSecret(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/**
 * Decrypts AES-256-GCM encrypted credentials. Returns null if invalid or tampered with.
 */
export function decryptSecret(payload: string | null | undefined, key: Buffer): string | null {
  if (!payload) return null;
  const parts = payload.split('.');
  if (parts.length !== 3) return null;

  try {
    const [ivB64, authTagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(authTagB64, 'base64url');
    const cipherText = Buffer.from(cipherB64, 'base64url');

    if (iv.length !== 12 || authTag.length !== 16) return null;

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Computes a secure SHA-256 digest of a token (e.g. SCIM bearer token or recovery code).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time comparison between a candidate token and a stored hash.
 */
export function verifyTokenHash(candidateToken: string, storedHash: string): boolean {
  if (!candidateToken || !storedHash) return false;
  const candidateHash = hashToken(candidateToken);
  try {
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Generates an enterprise SCIM live bearer token with high entropy.
 * Format: `scim_live_<hex32>`
 */
export function generateScimToken(): { rawToken: string; tokenPrefix: string; tokenHash: string } {
  const entropy = randomBytes(32).toString('hex');
  const rawToken = `scim_live_${entropy}`;
  const tokenPrefix = `scim_live_${entropy.slice(0, 8)}...`;
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenPrefix, tokenHash };
}

/**
 * Generates an emergency recovery break-glass code for organization administrators.
 * Format: `mie-recov-XXXX-XXXX-XXXX-XXXX`
 */
export function generateRecoveryCode(): { rawCode: string; codeHash: string } {
  const parts = [
    randomBytes(2).toString('hex').toUpperCase(),
    randomBytes(2).toString('hex').toUpperCase(),
    randomBytes(2).toString('hex').toUpperCase(),
    randomBytes(2).toString('hex').toUpperCase(),
  ];
  const rawCode = `mie-recov-${parts.join('-')}`;
  const codeHash = hashToken(rawCode);
  return { rawCode, codeHash };
}

/**
 * Normalizes an X.509 certificate to standard PEM format:
 * `-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----`
 */
export function normalizeCertificatePem(raw: string): string {
  const cleaned = raw
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) return '';

  const chunks = cleaned.match(/.{1,64}/g) ?? [cleaned];
  return `-----BEGIN CERTIFICATE-----\n${chunks.join('\n')}\n-----END CERTIFICATE-----\n`;
}

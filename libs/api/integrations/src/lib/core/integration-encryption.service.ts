import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class IntegrationEncryptionService {
  private readonly logger = new Logger(IntegrationEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawSecret =
      this.config.get<string>('ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'onetab-ai-secret-default-key-for-credentials-32b';

    // Derive a fixed 32-byte key using SHA-256
    this.key = createHash('sha256').update(rawSecret).digest();
  }

  /**
   * Encrypts a plaintext secret (OAuth token, API key, refresh token) using AES-256-GCM.
   * Returns a serialized string: `ivHex:authTagHex:ciphertextHex`.
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err) {
      this.logger.error(
        `Failed to encrypt credential: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error('Credential encryption failed', { cause: err });
    }
  }

  /**
   * Decrypts an AES-256-GCM encrypted serialized credential.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted payload format');
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Malformed encryption tokens');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      this.logger.error(
        `Failed to decrypt credential: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error('Credential decryption failed', { cause: err });
    }
  }

  /**
   * Generates a safe masked representation of an API key or token.
   * E.g. "••••••••1234"
   */
  maskSecret(secret?: string | null): string {
    if (!secret) return '';
    const trimmed = secret.trim();
    if (trimmed.length <= 4) {
      return '••••••••';
    }
    if (trimmed.length <= 8) {
      return `••••••••${trimmed.slice(-2)}`;
    }
    return `••••••••••••${trimmed.slice(-4)}`;
  }

  /**
   * Computes an HMAC SHA-256 signature for state validation or webhook verification.
   */
  computeHmacSha256(data: string, secret?: string): string {
    const key = secret ? Buffer.from(secret) : this.key;
    return createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Timing-safe equality check to protect against timing attacks on signatures.
   */
  verifySignature(expected: string, actual: string): boolean {
    if (!expected || !actual) return false;
    try {
      const bufA = Buffer.from(expected, 'utf8');
      const bufB = Buffer.from(actual, 'utf8');
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}

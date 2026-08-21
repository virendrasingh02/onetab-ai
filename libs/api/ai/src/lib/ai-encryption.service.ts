import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class AIEncryptionService {
  private readonly logger = new Logger(AIEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawSecret =
      this.config.get<string>('ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'onetab-ai-secret-default-key-for-credentials-32b';

    // Derive a fixed 32-byte key using SHA-256
    this.key = createHash('sha256').update(rawSecret).digest();
  }

  /**
   * Encrypts a plaintext API key or credential using AES-256-GCM.
   * Returns a compact serialized string: `iv:authTag:encryptedContent` (in hex).
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
      this.logger.error(`Failed to encrypt AI credential: ${err instanceof Error ? err.message : String(err)}`);
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
      this.logger.error(`Failed to decrypt AI credential: ${err instanceof Error ? err.message : String(err)}`);
      throw new Error('Credential decryption failed', { cause: err });
    }
  }

  /**
   * Generates a safe masked representation of an API key.
   * Only the last 4 characters (or last 2 for very short keys) are revealed.
   * e.g. "••••••••••••1234"
   */
  maskApiKey(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.length <= 4) {
      return '••••••••';
    }
    if (trimmed.length <= 8) {
      return `••••••••${trimmed.slice(-2)}`;
    }
    return `••••••••••••${trimmed.slice(-4)}`;
  }
}

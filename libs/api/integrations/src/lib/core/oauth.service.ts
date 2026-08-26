import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { IntegrationEncryptionService } from './integration-encryption.service.js';

export interface OAuthStatePayload {
  workspaceId?: string;
  userId?: string;
  provider: string;
  scopeType: 'WORKSPACE' | 'USER';
  timestamp: number;
  nonce: string;
  redirectUrl?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private readonly encryption: IntegrationEncryptionService) {}

  /**
   * Generates a signed, tamper-proof state token for OAuth flows.
   */
  generateState(payload: Omit<OAuthStatePayload, 'timestamp' | 'nonce'>): string {
    const fullPayload: OAuthStatePayload = {
      ...payload,
      timestamp: Date.now(),
      nonce: randomBytes(16).toString('hex'),
    };

    const json = JSON.stringify(fullPayload);
    const b64 = Buffer.from(json, 'utf8').toString('base64url');
    const signature = this.encryption.computeHmacSha256(b64);
    return `${b64}.${signature}`;
  }

  /**
   * Validates and unpacks a signed OAuth state token.
   * Throws BadRequestException if state is invalid, tampered with, or expired.
   */
  verifyState(stateString: string): OAuthStatePayload {
    if (!stateString || typeof stateString !== 'string') {
      throw new BadRequestException('Missing or invalid OAuth state parameter.');
    }

    const [b64, signature] = stateString.split('.');
    if (!b64 || !signature) {
      throw new BadRequestException('Malformed OAuth state parameter.');
    }

    const expectedSignature = this.encryption.computeHmacSha256(b64);
    if (!this.encryption.verifySignature(expectedSignature, signature)) {
      this.logger.warn('OAuth state verification failed: Invalid HMAC signature.');
      throw new BadRequestException('OAuth state validation failed. Possible CSRF attempt.');
    }

    try {
      const json = Buffer.from(b64, 'base64url').toString('utf8');
      const payload = JSON.parse(json) as OAuthStatePayload;

      // Expiry check
      if (Date.now() - payload.timestamp > this.STATE_TTL_MS) {
        this.logger.warn('OAuth state verification failed: State has expired.');
        throw new BadRequestException('OAuth authorization session expired. Please try connecting again.');
      }

      return payload;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Failed to parse OAuth state payload: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('Invalid OAuth state data.');
    }
  }

  /**
   * Generates PKCE code_verifier and code_challenge (S256).
   */
  generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }
}

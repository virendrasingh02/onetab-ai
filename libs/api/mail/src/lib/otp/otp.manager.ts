import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@org/database';
import * as crypto from 'crypto';

export interface GenerateOtpOptions {
  identifier: string; // email or user id
  purpose?: string;   // 'LOGIN' | '2FA' | 'VERIFY_EMAIL' | 'PASSWORD_RESET'
  expiresInMinutes?: number;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyOtpOptions {
  identifier: string;
  code: string;
  purpose?: string;
}

export interface VerifyOtpResult {
  valid: boolean;
  message: string;
  remainingAttempts?: number;
}

const COOLDOWN_MS = 30_000;

interface InMemoryOtpRecord {
  id: string;
  identifier: string;
  purpose: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  usedAt?: Date;
}

@Injectable()
export class OtpManager {
  private readonly logger = new Logger(OtpManager.name);
  private readonly secret: string;
  private readonly memoryStore = new Map<string, InMemoryOtpRecord>();
  private readonly lastSentTime = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const secret =
      this.config.get<string>('OTP_SECRET') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret && this.config.get<string>('NODE_ENV') === 'production') {
      // A known key would let anyone with a database read brute-force every
      // stored code offline.
      throw new Error('OTP_SECRET (or JWT_ACCESS_SECRET) must be set in production.');
    }
    this.secret = secret || 'onetab-otp-dev-secret';
  }

  private static hashesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  /** Forget cooldowns and in-memory codes that can no longer matter. */
  private prune(now: number): void {
    for (const [key, at] of this.lastSentTime) {
      if (now - at >= COOLDOWN_MS) this.lastSentTime.delete(key);
    }
    for (const [key, rec] of this.memoryStore) {
      if (rec.expiresAt.getTime() <= now) this.memoryStore.delete(key);
    }
  }

  /**
   * Hashes an OTP code using HMAC-SHA256 to ensure zero plain text storage.
   */
  private hashCode(code: string, identifier: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`${identifier}:${code.trim()}`)
      .digest('hex');
  }

  /**
   * Generates a cryptographically secure 6-digit numeric OTP.
   */
  private generateRandomCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Requests a new OTP code for an identifier and purpose.
   * Enforces a cooldown (default 30-60s) to prevent mail bombing.
   */
  async createOtp(options: GenerateOtpOptions): Promise<{ code: string; expiresInMinutes: number; recordId: string }> {
    const identifier = options.identifier.trim().toLowerCase();
    const purpose = options.purpose || 'LOGIN';
    const cooldownKey = `${identifier}:${purpose}`;
    const now = Date.now();
    this.prune(now);

    // 1. Check cooldown
    const lastSent = this.lastSentTime.get(cooldownKey) || 0;
    if (now - lastSent < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now - lastSent)) / 1000);
      throw new Error(`Please wait ${waitSec} seconds before requesting a new verification code.`);
    }

    const code = this.generateRandomCode();
    const codeHash = this.hashCode(code, identifier);
    const expiresInMinutes = options.expiresInMinutes || 10;
    const expiresAt = new Date(now + expiresInMinutes * 60_000);
    const maxAttempts = options.maxAttempts || 5;

    let recordId = `otp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 2. Persist to Prisma if available
    if (this.prisma) {
      try {
        // Invalidate any existing active OTPs for this identifier & purpose
        await this.prisma.otpCode.updateMany({
          where: {
            identifier,
            purpose,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        const created = await this.prisma.otpCode.create({
          data: {
            identifier,
            purpose,
            codeHash,
            expiresAt,
            attempts: 0,
            maxAttempts,
            metadata: options.metadata as Prisma.InputJsonValue | undefined,
          },
          select: { id: true },
        });
        recordId = created.id;
      } catch (err) {
        this.logger.warn(`Could not persist OTP in DB, using memory fallback: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Store in memory fallback
    this.memoryStore.set(`${identifier}:${purpose}`, {
      id: recordId,
      identifier,
      purpose,
      codeHash,
      expiresAt,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
    });

    this.lastSentTime.set(cooldownKey, now);

    this.logger.log({
      event: 'otp.generated',
      identifier: `${identifier.slice(0, 2)}***@${identifier.split('@')[1] || 'id'}`,
      purpose,
      expiresInMinutes,
    });

    return { code, expiresInMinutes, recordId };
  }

  /**
   * Verifies an OTP code.
   * Handles attempt counting, expiration check, and invalidation.
   */
  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    const identifier = options.identifier.trim().toLowerCase();
    const purpose = options.purpose || 'LOGIN';
    const submittedCode = options.code.trim();
    const now = new Date();

    const expectedHash = this.hashCode(submittedCode, identifier);

    // 1. Try DB lookup first
    if (this.prisma) {
      try {
        const record = await this.prisma.otpCode.findFirst({
          where: {
            identifier,
            purpose,
            usedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (record) {
          if (record.attempts >= record.maxAttempts) {
            return {
              valid: false,
              message: 'Maximum verification attempts exceeded. Please request a new code.',
              remainingAttempts: 0,
            };
          }

          if (OtpManager.hashesMatch(record.codeHash, expectedHash)) {
            // Consume atomically: of two concurrent correct submissions only
            // the one that flips `usedAt` wins.
            const consumed = await this.prisma.otpCode.updateMany({
              where: { id: record.id, usedAt: null },
              data: { usedAt: now },
            });
            if (consumed.count === 0) {
              return { valid: false, message: 'Verification code has expired or is invalid.' };
            }

            this.memoryStore.delete(`${identifier}:${purpose}`);
            this.logger.log({ event: 'otp.verified', identifier: record.identifier, purpose });
            return { valid: true, message: 'Verification successful.' };
          } else {
            // Increment failed attempt
            const updated = await this.prisma.otpCode.update({
              where: { id: record.id },
              data: { attempts: { increment: 1 } },
              select: { attempts: true, maxAttempts: true },
            });
            const remaining = Math.max(0, updated.maxAttempts - updated.attempts);
            return {
              valid: false,
              message: `Invalid code. ${remaining} attempts remaining.`,
              remainingAttempts: remaining,
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Prisma OTP query error, checking memory: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Memory store fallback
    const memKey = `${identifier}:${purpose}`;
    const memRecord = this.memoryStore.get(memKey);

    if (!memRecord || memRecord.usedAt || memRecord.expiresAt < now) {
      return { valid: false, message: 'Verification code has expired or is invalid.' };
    }

    if (memRecord.attempts >= memRecord.maxAttempts) {
      this.memoryStore.delete(memKey);
      return { valid: false, message: 'Maximum verification attempts exceeded.', remainingAttempts: 0 };
    }

    if (OtpManager.hashesMatch(memRecord.codeHash, expectedHash)) {
      memRecord.usedAt = now;
      this.memoryStore.delete(memKey);
      this.logger.log({ event: 'otp.verified_memory', identifier, purpose });
      return { valid: true, message: 'Verification successful.' };
    }

    memRecord.attempts++;
    const remaining = Math.max(0, memRecord.maxAttempts - memRecord.attempts);
    return {
      valid: false,
      message: `Invalid code. ${remaining} attempts remaining.`,
      remainingAttempts: remaining,
    };
  }
}

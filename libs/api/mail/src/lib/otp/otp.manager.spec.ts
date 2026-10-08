import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OtpManager } from './otp.manager.js';

describe('OtpManager', () => {
  let otpManager: OtpManager;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      JWT_ACCESS_SECRET: 'test-secret-salt-key-123',
    });
    // In-memory mode (without Prisma)
    otpManager = new OtpManager(configService);
  });

  it('generates a 6-digit numeric OTP code', async () => {
    const result = await otpManager.createOtp({
      identifier: 'user@example.com',
      purpose: 'LOGIN',
      expiresInMinutes: 10,
    });

    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.expiresInMinutes).toBe(10);
    expect(result.recordId).toBeDefined();
  });

  it('enforces a 30-second cooldown on consecutive requests for the same identifier and purpose', async () => {
    await otpManager.createOtp({
      identifier: 'test@example.com',
      purpose: 'LOGIN',
    });

    // Immediate second attempt should fail with cooldown message
    await expect(
      otpManager.createOtp({
        identifier: 'test@example.com',
        purpose: 'LOGIN',
      }),
    ).rejects.toThrow(/Please wait/);
  });

  it('allows different purposes without colliding on cooldown', async () => {
    const loginOtp = await otpManager.createOtp({
      identifier: 'multi@example.com',
      purpose: 'LOGIN',
    });

    const resetOtp = await otpManager.createOtp({
      identifier: 'multi@example.com',
      purpose: 'PASSWORD_RESET',
    });

    expect(loginOtp.code).toMatch(/^\d{6}$/);
    expect(resetOtp.code).toMatch(/^\d{6}$/);
  });

  it('successfully verifies a valid OTP code', async () => {
    const { code } = await otpManager.createOtp({
      identifier: 'verify@example.com',
      purpose: 'LOGIN',
    });

    const verifyResult = await otpManager.verifyOtp({
      identifier: 'verify@example.com',
      purpose: 'LOGIN',
      code,
    });

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.message).toBe('Verification successful.');
  });

  it('rejects an incorrect OTP code and decrements remaining attempts', async () => {
    await otpManager.createOtp({
      identifier: 'wrong@example.com',
      purpose: 'LOGIN',
      maxAttempts: 3,
    });

    const fail1 = await otpManager.verifyOtp({
      identifier: 'wrong@example.com',
      purpose: 'LOGIN',
      code: '000000',
    });

    expect(fail1.valid).toBe(false);
    expect(fail1.remainingAttempts).toBe(2);

    const fail2 = await otpManager.verifyOtp({
      identifier: 'wrong@example.com',
      purpose: 'LOGIN',
      code: '111111',
    });

    expect(fail2.valid).toBe(false);
    expect(fail2.remainingAttempts).toBe(1);

    const fail3 = await otpManager.verifyOtp({
      identifier: 'wrong@example.com',
      purpose: 'LOGIN',
      code: '222222',
    });

    expect(fail3.valid).toBe(false);
    expect(fail3.remainingAttempts).toBe(0);

    // Any further attempt is blocked
    const fail4 = await otpManager.verifyOtp({
      identifier: 'wrong@example.com',
      purpose: 'LOGIN',
      code: '333333',
    });
    expect(fail4.valid).toBe(false);
    expect(fail4.message).toContain('Maximum verification attempts exceeded');
  });

  it('prevents replay of an already used OTP', async () => {
    const { code } = await otpManager.createOtp({
      identifier: 'replay@example.com',
      purpose: 'LOGIN',
    });

    const firstVerify = await otpManager.verifyOtp({
      identifier: 'replay@example.com',
      purpose: 'LOGIN',
      code,
    });
    expect(firstVerify.valid).toBe(true);

    const secondVerify = await otpManager.verifyOtp({
      identifier: 'replay@example.com',
      purpose: 'LOGIN',
      code,
    });
    expect(secondVerify.valid).toBe(false);
    expect(secondVerify.message).toContain('expired or is invalid');
  });
});

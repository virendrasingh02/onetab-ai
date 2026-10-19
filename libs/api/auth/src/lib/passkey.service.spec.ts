import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { hashToken } from '@org/api-common';
import type { PrismaService } from '@org/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthService } from './auth.service.js';
import { PasskeyService } from './passkey.service.js';

const webauthn = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
vi.mock('@simplewebauthn/server', () => webauthn);

describe('PasskeyService', () => {
  const userId = 'user_pk';
  const credentialId = 'Y3JlZC1pZA';
  const storedCredential = {
    id: 'wac_1',
    userId,
    credentialId,
    publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
    counter: BigInt(4),
    transports: '["internal"]',
  };
  const authResponse = (userHandle?: string) => ({
    id: credentialId,
    rawId: credentialId,
    type: 'public-key' as const,
    clientExtensionResults: {},
    response: { userHandle },
  });

  let prisma: any;
  let auth: any;
  let service: PasskeyService;
  let challengeRow: any;

  beforeEach(() => {
    vi.clearAllMocks();
    challengeRow = {
      id: 'chal_1',
      type: 'authentication',
      userId: null,
      challenge: 'expected-challenge',
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          email: 'sam@example.com',
          name: 'Sam',
          displayName: null,
          webAuthnCredentials: [],
        }),
      },
      webAuthnChallenge: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockImplementation(() => challengeRow),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      webAuthnCredential: {
        findUnique: vi.fn().mockResolvedValue(storedCredential),
        create: vi.fn().mockImplementation(({ data }) => ({
          id: 'wac_new',
          createdAt: new Date(),
          ...data,
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    auth = {
      signInWithPasskey: vi.fn().mockResolvedValue({ user: { id: userId }, session: {} }),
    };
    const env: Record<string, string> = {
      WEB_APP_URL: 'https://app.example.com',
      NODE_ENV: 'production',
    };
    service = new PasskeyService(
      prisma as unknown as PrismaService,
      { get: (key: string) => env[key] } as unknown as ConfigService,
      auth as unknown as AuthService,
    );
  });

  it('stores the registration challenge for the user behind a hashed handle', async () => {
    webauthn.generateRegistrationOptions.mockResolvedValue({ challenge: 'reg-challenge' });

    const { challengeToken } = await service.registrationOptions(userId);

    expect(webauthn.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: 'app.example.com', userName: 'sam@example.com' }),
    );
    expect(prisma.webAuthnChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'registration',
        userId,
        challenge: 'reg-challenge',
        tokenHash: hashToken(challengeToken),
      }),
    });
  });

  it('verifies the attestation against the stored challenge, RP ID and origin', async () => {
    challengeRow = { ...challengeRow, type: 'registration', userId };
    webauthn.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'new-cred',
          publicKey: new Uint8Array([9, 8, 7]),
          counter: 0,
          transports: ['internal', 'hybrid'],
        },
      },
    });
    prisma.webAuthnCredential.findUnique.mockResolvedValue(null);

    const dto = await service.verifyRegistration(userId, {
      challengeToken: 'tok',
      deviceName: 'MacBook',
      response: authResponse() as never,
    });

    expect(webauthn.verifyRegistrationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'expected-challenge',
        expectedRPID: 'app.example.com',
        expectedOrigin: ['https://app.example.com'],
      }),
    );
    expect(prisma.webAuthnCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        credentialId: 'new-cred',
        publicKey: Buffer.from([9, 8, 7]).toString('base64url'),
        transports: '["internal","hybrid"]',
        deviceName: 'MacBook',
      }),
    });
    expect(dto.credentialId).toBe('new-cred');
  });

  it("refuses another user's registration challenge", async () => {
    challengeRow = { ...challengeRow, type: 'registration', userId: 'someone_else' };

    await expect(
      service.verifyRegistration(userId, {
        challengeToken: 'tok',
        response: authResponse() as never,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webauthn.verifyRegistrationResponse).not.toHaveBeenCalled();
  });

  it('refuses a challenge that was already redeemed or expired', async () => {
    prisma.webAuthnChallenge.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.verifyAuthentication({ challengeToken: 'tok', response: authResponse() as never }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webauthn.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it('signs in with a verified assertion and advances the counter', async () => {
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 5, userVerified: true },
    });

    await service.verifyAuthentication({
      challengeToken: 'tok',
      response: authResponse(Buffer.from(userId).toString('base64url')) as never,
    });

    expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'expected-challenge',
        credential: expect.objectContaining({ id: credentialId, counter: 4 }),
      }),
    );
    expect(prisma.webAuthnCredential.updateMany).toHaveBeenCalledWith({
      where: { id: 'wac_1', counter: BigInt(4) },
      data: expect.objectContaining({ counter: BigInt(5) }),
    });
    expect(auth.signInWithPasskey).toHaveBeenCalledWith(userId, true, {});
  });

  it('rejects an unknown credential', async () => {
    prisma.webAuthnCredential.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyAuthentication({ challengeToken: 'tok', response: authResponse() as never }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.signInWithPasskey).not.toHaveBeenCalled();
  });

  it("rejects a user handle that is not the credential owner's", async () => {
    await expect(
      service.verifyAuthentication({
        challengeToken: 'tok',
        response: authResponse(Buffer.from('intruder').toString('base64url')) as never,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webauthn.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it('rejects a bad signature or a counter that went backwards', async () => {
    webauthn.verifyAuthenticationResponse.mockRejectedValue(
      new Error('Response counter value 3 was lower than expected 4'),
    );

    await expect(
      service.verifyAuthentication({ challengeToken: 'tok', response: authResponse() as never }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.webAuthnCredential.updateMany).not.toHaveBeenCalled();
    expect(auth.signInWithPasskey).not.toHaveBeenCalled();
  });
});

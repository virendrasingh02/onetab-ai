import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateToken, hashToken } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  ApiErrorCode,
  type PasskeyOptionsResponse,
  type WebAuthnCredentialDto,
} from '@org/types';
import type {
  PasskeyLoginVerifyInput,
  PasskeyRegisterVerifyInput,
} from '@org/validation';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AuthService, type SessionContext, type SignInResult } from './auth.service.js';

/** How long the browser prompt may stay open before the challenge is void. */
const CHALLENGE_TTL_MS = 5 * 60_000;

type ChallengeType = 'registration' | 'authentication';

/**
 * Real WebAuthn: the server issues every challenge, keeps it (hashed handle,
 * short TTL, single use) and verifies the authenticator's attestation /
 * assertion against it with the configured RP ID and origins. Sign-in uses
 * discoverable credentials, so no email is needed up front.
 */
@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  /* --- Configuration ------------------------------------------------------ */

  private get webAppUrl(): string {
    const raw =
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('VITE_WEB_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:4200';
    return raw.replace(/\/+$/, '');
  }

  /** `WEBAUTHN_RP_ID`, else the web app's hostname. */
  private get rpID(): string {
    return (
      this.config.get<string>('WEBAUTHN_RP_ID') ||
      new URL(this.webAppUrl).hostname
    );
  }

  private get rpName(): string {
    return this.config.get<string>('WEBAUTHN_RP_NAME') || 'OneTab AI';
  }

  /**
   * `WEBAUTHN_ORIGINS` (comma-separated), else the web app URL. Outside
   * production the local dev ports are accepted too, mirroring the CORS list.
   */
  private get expectedOrigins(): string[] {
    const configured = (this.config.get<string>('WEBAUTHN_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    const origins = new Set(configured.length ? configured : [this.webAppUrl]);
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      for (let port = 4200; port < 4210; port++) {
        origins.add(`http://localhost:${port}`);
      }
    }
    return [...origins];
  }

  /* --- Challenges --------------------------------------------------------- */

  private async storeChallenge(
    type: ChallengeType,
    challenge: string,
    userId: string | null,
  ): Promise<string> {
    const now = new Date();
    // Opportunistic sweep: abandoned prompts leave rows behind.
    await this.prisma.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const token = generateToken(32);
    await this.prisma.webAuthnChallenge.create({
      data: {
        type,
        userId,
        challenge,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
      },
    });
    return token;
  }

  /**
   * Burns a challenge and returns its value. The conditional delete makes it
   * single use even when the same response is replayed from two tabs.
   */
  private async consumeChallenge(
    type: ChallengeType,
    token: string,
    userId: string | null,
  ): Promise<string> {
    const invalid = () =>
      new UnauthorizedException({
        code: ApiErrorCode.TOKEN_EXPIRED,
        message: 'This passkey request expired. Try again.',
      });
    const tokenHash = hashToken(token);
    const row = await this.prisma.webAuthnChallenge.findUnique({
      where: { tokenHash },
    });
    if (!row || row.type !== type || row.userId !== userId) throw invalid();
    const claimed = await this.prisma.webAuthnChallenge.deleteMany({
      where: { id: row.id, expiresAt: { gt: new Date() } },
    });
    if (claimed.count !== 1) throw invalid();
    return row.challenge;
  }

  /* --- Registration (signed in) ------------------------------------------- */

  async registrationOptions(
    userId: string,
  ): Promise<PasskeyOptionsResponse<PublicKeyCredentialCreationOptionsJSON>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        displayName: true,
        webAuthnCredentials: { select: { credentialId: true, transports: true } },
      },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userDisplayName: user.displayName || user.name || user.email,
      // The user handle comes back on sign-in; it is checked against the
      // credential's owner there.
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      excludeCredentials: user.webAuthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: parseTransports(c.transports),
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    const challengeToken = await this.storeChallenge(
      'registration',
      options.challenge,
      userId,
    );
    return { options, challengeToken };
  }

  async verifyRegistration(
    userId: string,
    input: PasskeyRegisterVerifyInput,
  ): Promise<WebAuthnCredentialDto> {
    const expectedChallenge = await this.consumeChallenge(
      'registration',
      input.challengeToken,
      userId,
    );

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: input.response as unknown as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: this.expectedOrigins,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });
    } catch (error) {
      this.logger.warn({
        event: 'passkey_registration_rejected',
        userId,
        reason: (error as Error).message,
      });
      throw new BadRequestException('This passkey could not be verified.');
    }
    if (!verification.verified) {
      throw new BadRequestException('This passkey could not be verified.');
    }

    const { credential } = verification.registrationInfo;
    const existing = await this.prisma.webAuthnCredential.findUnique({
      where: { credentialId: credential.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This passkey is already registered.');
    }

    const created = await this.prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: BigInt(credential.counter),
        transports: JSON.stringify(credential.transports ?? []),
        deviceName: input.deviceName || 'Passkey',
      },
    });

    this.logger.log({ event: 'passkey_registered', userId });
    return {
      id: created.id,
      credentialId: created.credentialId,
      deviceName: created.deviceName,
      createdAt: created.createdAt.toISOString(),
      lastUsedAt: null,
    };
  }

  /* --- Sign-in (public) --------------------------------------------------- */

  async authenticationOptions(): Promise<
    PasskeyOptionsResponse<PublicKeyCredentialRequestOptionsJSON>
  > {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'preferred',
    });
    const challengeToken = await this.storeChallenge(
      'authentication',
      options.challenge,
      null,
    );
    return { options, challengeToken };
  }

  async verifyAuthentication(
    input: PasskeyLoginVerifyInput,
    context: SessionContext = {},
  ): Promise<SignInResult> {
    const rejected = () =>
      new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'That passkey is not recognised. Try another sign-in method.',
      });

    const expectedChallenge = await this.consumeChallenge(
      'authentication',
      input.challengeToken,
      null,
    );
    const response = input.response as unknown as AuthenticationResponseJSON;

    const stored = await this.prisma.webAuthnCredential.findUnique({
      where: { credentialId: response.id },
    });
    if (!stored) throw rejected();

    const userHandle = response.response.userHandle;
    if (
      userHandle &&
      Buffer.from(userHandle, 'base64url').toString('utf8') !== stored.userId
    ) {
      throw rejected();
    }

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.expectedOrigins,
        expectedRPID: this.rpID,
        requireUserVerification: false,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64url')),
          counter: Number(stored.counter),
          transports: parseTransports(stored.transports),
        },
      });
    } catch (error) {
      // Includes a signature counter that went backwards — a cloned key.
      this.logger.warn({
        event: 'passkey_sign_in_rejected',
        userId: stored.userId,
        ip: context.ipAddress,
        reason: (error as Error).message,
      });
      throw rejected();
    }
    if (!verification.verified) throw rejected();

    const { newCounter, userVerified } = verification.authenticationInfo;
    // Conditional on the counter we verified against, so two racing
    // assertions with the same counter cannot both land.
    const updated = await this.prisma.webAuthnCredential.updateMany({
      where: { id: stored.id, counter: stored.counter },
      data: { counter: BigInt(newCounter), lastUsedAt: new Date() },
    });
    if (updated.count !== 1) throw rejected();

    return this.auth.signInWithPasskey(stored.userId, userVerified, context);
  }
}

function parseTransports(raw: string): AuthenticatorTransport[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is AuthenticatorTransport => typeof t === 'string')
      : [];
  } catch {
    return [];
  }
}

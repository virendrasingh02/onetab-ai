import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { generateToken } from '@org/api-common';
import { PrismaService } from '@org/database';
import { ApiErrorCode, type CurrentUser } from '@org/types';
import type {
  CreateDeviceAuthInput,
  CreateDeviceAuthResponse,
  DeviceAuthInfoResponse,
  ExchangeDeviceAuthInput,
  PollDeviceAuthInput,
} from '@org/validation';
import { toCurrentUser, type SessionContext } from './auth.service.js';
import { TokenService, type IssuedSession } from './token.service.js';

interface PendingDeviceRequest {
  requestId: string;
  userCode: string;
  secretToken: string;
  deviceInfo: {
    clientName: string;
    platform: string;
    os: string;
    browser: string;
    ip?: string;
    location?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';
  approvedUserId: string | null;
  createdAt: number;
  expiresAt: number;
}

const DEVICE_AUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PAIRING_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // Excludes 0, 1, I, L, O for clarity

function generatePairingCode(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += PAIRING_CHARS[bytes[i] % PAIRING_CHARS.length];
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function normalizePairingCode(code: string): string {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}

@Injectable()
export class DeviceAuthService {
  private readonly logger = new Logger(DeviceAuthService.name);
  private readonly requestsById = new Map<string, PendingDeviceRequest>();
  private readonly requestsByCode = new Map<string, string>(); // userCode -> requestId

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {
    setInterval(() => this.pruneExpired(), 30_000).unref();
  }

  /**
   * Desktop client creates a device authorization request.
   */
  async createRequest(
    input: CreateDeviceAuthInput,
    context: SessionContext = {},
    webAppUrl = 'http://localhost:4200',
  ): Promise<CreateDeviceAuthResponse> {
    const requestId = generateToken(32);
    let userCode = generatePairingCode();

    // Ensure collision resistance for active pairing codes
    while (this.requestsByCode.has(userCode)) {
      userCode = generatePairingCode();
    }

    const secretToken = generateToken(32);
    const now = Date.now();
    const expiresAt = now + DEVICE_AUTH_TTL_MS;

    const deviceInfo = {
      clientName: input.clientName || 'OneTab AI Desktop',
      platform: input.platform || 'Desktop PC',
      os: input.os || 'Windows / macOS / Linux',
      browser: input.browser || 'Desktop Client',
      ip: context.ipAddress || 'Local Network',
    };

    const entry: PendingDeviceRequest = {
      requestId,
      userCode,
      secretToken,
      deviceInfo,
      status: 'pending',
      approvedUserId: null,
      createdAt: now,
      expiresAt,
    };

    this.requestsById.set(requestId, entry);
    this.requestsByCode.set(userCode, requestId);

    const baseUrl = webAppUrl.replace(/\/+$/, '');
    const verificationUrl = `${baseUrl}/auth/device?request=${requestId}`;
    const deepLinkUrl = `mie://auth/device?request=${requestId}`;

    this.logger.log(`Created device auth request ${requestId} (Code: ${userCode})`);

    return {
      requestId,
      userCode,
      secretToken,
      verificationUrl,
      deepLinkUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInSeconds: Math.floor(DEVICE_AUTH_TTL_MS / 1000),
    };
  }

  /**
   * Retrieves sanitized public metadata for a device request.
   */
  async getInfo(requestId?: string, userCode?: string): Promise<DeviceAuthInfoResponse> {
    const entry = this.findEntry(requestId, userCode);

    if (!entry) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Device authorization request not found or has expired.',
      });
    }

    const isExpired = Date.now() > entry.expiresAt;
    const effectiveStatus = isExpired && entry.status === 'pending' ? 'expired' : entry.status;

    return {
      requestId: entry.requestId,
      userCode: entry.userCode,
      deviceInfo: entry.deviceInfo,
      status: effectiveStatus,
      expiresAt: new Date(entry.expiresAt).toISOString(),
    };
  }

  /**
   * Authenticated mobile user approves the device authorization request.
   */
  async approve(
    user: CurrentUser,
    requestId?: string,
    userCode?: string,
  ): Promise<{ success: boolean; status: string }> {
    const entry = this.findEntry(requestId, userCode);

    if (!entry) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Device authorization request not found or has expired.',
      });
    }

    if (Date.now() > entry.expiresAt || entry.status === 'expired') {
      entry.status = 'expired';
      throw new BadRequestException({
        code: ApiErrorCode.TOKEN_EXPIRED,
        message: 'Device authorization request has expired.',
      });
    }

    if (entry.status !== 'pending') {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Device authorization request has already been ${entry.status}.`,
      });
    }

    entry.status = 'approved';
    entry.approvedUserId = user.id;

    this.logger.log(`Device auth request ${entry.requestId} approved by user ${user.id}`);
    return { success: true, status: 'approved' };
  }

  /**
   * Mobile user rejects/cancels the device authorization request.
   */
  async reject(requestId?: string, userCode?: string): Promise<{ success: boolean }> {
    const entry = this.findEntry(requestId, userCode);
    if (entry && entry.status === 'pending') {
      entry.status = 'rejected';
      this.logger.log(`Device auth request ${entry.requestId} rejected`);
    }
    return { success: true };
  }

  /**
   * Desktop client polls the status of its active request.
   */
  async pollStatus(input: PollDeviceAuthInput): Promise<{ status: PendingDeviceRequest['status'] }> {
    const entry = this.requestsById.get(input.requestId);

    if (!entry || !this.verifySecret(entry.secretToken, input.secretToken)) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid request ID or secret token.',
      });
    }

    if (Date.now() > entry.expiresAt && entry.status === 'pending') {
      entry.status = 'expired';
    }

    return { status: entry.status };
  }

  /**
   * Desktop client exchanges approved request + secretToken for session tokens.
   */
  async exchange(
    input: ExchangeDeviceAuthInput,
    context: SessionContext = {},
  ): Promise<{ user: CurrentUser; session: IssuedSession }> {
    const entry = this.requestsById.get(input.requestId);

    if (!entry || !this.verifySecret(entry.secretToken, input.secretToken)) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid device authorization credentials.',
      });
    }

    if (Date.now() > entry.expiresAt || entry.status === 'expired') {
      entry.status = 'expired';
      this.cleanup(entry.requestId);
      throw new UnauthorizedException({
        code: ApiErrorCode.TOKEN_EXPIRED,
        message: 'Device authorization request has expired.',
      });
    }

    if (entry.status !== 'approved' || !entry.approvedUserId) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: `Device authorization request is not approved (Current status: ${entry.status}).`,
      });
    }

    // Immediately consume request (one-time use)
    entry.status = 'consumed';
    const userId = entry.approvedUserId;
    this.cleanup(entry.requestId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'User account no longer exists.',
      });
    }

    const signedIn = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), presence: 'ONLINE' },
    });

    const session = await this.tokens.issueSession(signedIn, {
      ...context,
      userAgent: context.userAgent ? `Desktop-Paired ${context.userAgent}` : 'Desktop-Paired',
    });

    this.logger.log(`Device auth successfully completed for user ${user.id} on desktop`);
    return { user: toCurrentUser(signedIn), session };
  }

  private findEntry(requestId?: string, userCode?: string): PendingDeviceRequest | undefined {
    if (requestId && this.requestsById.has(requestId)) {
      return this.requestsById.get(requestId);
    }
    if (userCode) {
      const normalized = normalizePairingCode(userCode);
      const id = this.requestsByCode.get(normalized);
      if (id) return this.requestsById.get(id);
    }
    return undefined;
  }

  private verifySecret(storedSecret: string, providedSecret: string): boolean {
    const bufA = Buffer.from(storedSecret);
    const bufB = Buffer.from(providedSecret);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }

  private cleanup(requestId: string): void {
    const entry = this.requestsById.get(requestId);
    if (entry) {
      this.requestsByCode.delete(entry.userCode);
      this.requestsById.delete(requestId);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.requestsById.entries()) {
      if (now > entry.expiresAt + 60_000) {
        this.cleanup(id);
      }
    }
  }
}

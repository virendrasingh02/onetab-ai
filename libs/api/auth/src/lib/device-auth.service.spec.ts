import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@org/database';
import type { CurrentUser } from '@org/types';
import { DeviceAuthService } from './device-auth.service.js';
import type { TokenService } from './token.service.js';

describe('DeviceAuthService', () => {
  let service: DeviceAuthService;
  let mockPrisma: any;
  let mockTokens: any;

  const mockUser: CurrentUser = {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'MEMBER',
    status: 'ONLINE',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'MEMBER',
          presence: 'ONLINE',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: vi.fn().mockResolvedValue({
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'MEMBER',
          presence: 'ONLINE',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    };

    mockTokens = {
      issueSession: vi.fn().mockResolvedValue({
        tokens: {
          accessToken: 'mock_access_token',
          expiresIn: 900,
          tokenType: 'Bearer',
        },
        refreshToken: 'mock_refresh_token',
        expiresAt: new Date(Date.now() + 30 * 86400000),
      }),
    };

    service = new DeviceAuthService(
      mockPrisma as unknown as PrismaService,
      mockTokens as unknown as TokenService,
    );
  });

  describe('createRequest & getInfo', () => {
    it('creates a valid device authorization request with pairing code', async () => {
      const res = await service.createRequest(
        { clientName: 'OneTab AI Desktop', platform: 'Windows PC' },
        { ip: '127.0.0.1' },
      );

      expect(res.requestId).toBeDefined();
      expect(res.userCode).toMatch(/^[2-9A-Z]{3}-[2-9A-Z]{3}$/);
      expect(res.secretToken).toBeDefined();
      expect(res.verificationUrl).toContain(res.requestId);
      expect(res.deepLinkUrl).toContain(res.requestId);

      const info = await service.getInfo(res.requestId);
      expect(info.requestId).toBe(res.requestId);
      expect(info.userCode).toBe(res.userCode);
      expect(info.status).toBe('pending');
      expect(info.deviceInfo.platform).toBe('Windows PC');
    });

    it('looks up request by pairing userCode regardless of dash formatting', async () => {
      const res = await service.createRequest({ clientName: 'Desktop' });
      const rawCode = res.userCode.replace('-', '').toLowerCase();

      const info = await service.getInfo(undefined, rawCode);
      expect(info.requestId).toBe(res.requestId);
    });
  });

  describe('approve & exchange workflow', () => {
    it('successfully approves and exchanges device authorization', async () => {
      const created = await service.createRequest({ clientName: 'Desktop' });

      // Initial status: pending
      const initialPoll = await service.pollStatus({
        requestId: created.requestId,
        secretToken: created.secretToken,
      });
      expect(initialPoll.status).toBe('pending');

      // Mobile approves
      const approveRes = await service.approve(mockUser, created.requestId);
      expect(approveRes.success).toBe(true);

      // Status becomes approved
      const approvedPoll = await service.pollStatus({
        requestId: created.requestId,
        secretToken: created.secretToken,
      });
      expect(approvedPoll.status).toBe('approved');

      // Desktop exchanges
      const exchanged = await service.exchange({
        requestId: created.requestId,
        secretToken: created.secretToken,
      });

      expect(exchanged.user.id).toBe(mockUser.id);
      expect(exchanged.session.tokens.accessToken).toBe('mock_access_token');

      // Request is consumed and single-use
      await expect(
        service.exchange({
          requestId: created.requestId,
          secretToken: created.secretToken,
        }),
      ).rejects.toThrow();
    });

    it('handles request rejection', async () => {
      const created = await service.createRequest({ clientName: 'Desktop' });

      await service.reject(created.requestId);

      const poll = await service.pollStatus({
        requestId: created.requestId,
        secretToken: created.secretToken,
      });
      expect(poll.status).toBe('rejected');

      await expect(
        service.exchange({
          requestId: created.requestId,
          secretToken: created.secretToken,
        }),
      ).rejects.toThrow();
    });
  });
});

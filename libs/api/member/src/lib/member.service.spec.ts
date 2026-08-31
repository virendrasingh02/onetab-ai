import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { hashToken } from '@org/api-common';
import type { PrismaService } from '@org/database';
import { InvitationStatus, WorkspaceRole } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberService } from './member.service.js';

describe('MemberService - Complete Invitation System', () => {
  let service: MemberService;
  let mockPrisma: any;
  let mockEvents: any;

  const workspaceId = 'ws_123';
  const actorId = 'user_admin';
  const invitedUserId = 'user_invited';

  beforeEach(() => {
    mockPrisma = {
      workspaceMember: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
      channelMember: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
      invitation: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      channel: {
        findFirst: vi.fn(),
      },
      team: {
        findFirst: vi.fn(),
      },
      project: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockEvents = {
      emit: vi.fn(),
    };

    service = new MemberService(
      mockPrisma as unknown as PrismaService,
      mockEvents,
    );
  });

  describe('Batch Invitations & Role Security', () => {
    it('creates invitations for new emails and reports already existing members', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        { user: { email: 'alice@example.com' } },
      ]);
      mockPrisma.invitation.findFirst.mockResolvedValue(null);
      mockPrisma.invitation.create.mockImplementation(({ data }: any) => ({
        id: 'inv_1',
        ...data,
        invitedBy: { id: actorId, name: 'Admin', displayName: null, avatarUrl: null },
      }));

      const result = await service.invite(
        workspaceId,
        actorId,
        WorkspaceRole.ADMIN,
        {
          emails: ['alice@example.com', 'bob@example.com'],
          role: WorkspaceRole.MEMBER,
          message: 'Welcome to the team!',
        },
        true,
      );

      expect(result.alreadyMembers).toEqual(['alice@example.com']);
      expect(result.invited).toHaveLength(1);
      expect(result.invited[0].email).toBe('bob@example.com');
      expect(result.tokens?.['bob@example.com']).toBeDefined();
      expect(mockEvents.emit).toHaveBeenCalledWith('workspace.invited', expect.any(Object));
    });

    it('rejects inviting with a role higher than the actor role', async () => {
      await expect(
        service.invite(
          workspaceId,
          actorId,
          WorkspaceRole.MEMBER, // actor is MEMBER
          {
            emails: ['new@example.com'],
            role: WorkspaceRole.ADMIN, // trying to invite as ADMIN
          },
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates channel scope existence', async () => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);

      await expect(
        service.invite(
          workspaceId,
          actorId,
          WorkspaceRole.ADMIN,
          {
            emails: ['new@example.com'],
            role: WorkspaceRole.MEMBER,
            channelId: 'non_existent_channel',
          },
          false,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Public Preview', () => {
    it('returns sanitized public preview details for a valid token', async () => {
      const rawToken = 'sample_secure_token_1234567890';
      const hashed = hashToken(rawToken);

      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_1',
        tokenHash: hashed,
        email: 'recipient@example.com',
        role: WorkspaceRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        message: 'Join us!',
        isLink: false,
        useCount: 0,
        maxUses: null,
        workspace: {
          id: workspaceId,
          name: 'Acme Corp',
          slug: 'acme',
          avatarUrl: null,
          icon: null,
          iconColor: null,
        },
        invitedBy: {
          id: actorId,
          name: 'Alice',
          displayName: 'Alice Admin',
          avatarUrl: null,
        },
        channel: null,
        team: null,
        project: null,
      });

      const preview = await service.getInvitationPreview(rawToken);

      expect(preview.valid).toBe(true);
      expect(preview.workspace.name).toBe('Acme Corp');
      expect(preview.inviter.name).toBe('Alice');
      expect(preview.role).toBe(WorkspaceRole.MEMBER);
    });

    it('marks expired invitation as EXPIRED on preview', async () => {
      const rawToken = 'expired_token';
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_1',
        tokenHash: hashToken(rawToken),
        email: 'recipient@example.com',
        role: WorkspaceRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 10000), // in the past
        isLink: false,
        useCount: 0,
        workspace: { id: workspaceId, name: 'Acme', slug: 'acme' },
        invitedBy: { id: actorId, name: 'Alice' },
      });
      mockPrisma.invitation.update.mockResolvedValue({});

      const preview = await service.getInvitationPreview(rawToken);
      expect(preview.valid).toBe(false);
      expect(preview.status).toBe(InvitationStatus.EXPIRED);
      expect(mockPrisma.invitation.update).toHaveBeenCalled();
    });
  });

  describe('Acceptance & Idempotency', () => {
    it('accepts an invitation, grants workspace and channel membership, and marks status ACCEPTED', async () => {
      const rawToken = 'valid_token';
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_1',
        tokenHash: hashToken(rawToken),
        workspaceId,
        email: 'invited@example.com',
        role: WorkspaceRole.MEMBER,
        channelId: 'ch_general',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        isLink: false,
        useCount: 0,
        maxUses: null,
        workspace: { id: workspaceId, slug: 'acme' },
        channel: { id: 'ch_general', slug: 'general' },
        invitedBy: { id: actorId, name: 'Alice' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: invitedUserId,
        email: 'invited@example.com',
      });
      mockPrisma.workspaceMember.upsert.mockResolvedValue({});
      mockPrisma.channelMember.upsert.mockResolvedValue({});
      mockPrisma.invitation.update.mockResolvedValue({});

      const res = await service.acceptInvitation(rawToken, invitedUserId);

      expect(res.workspaceSlug).toBe('acme');
      expect(res.channelSlug).toBe('general');
      expect(mockPrisma.workspaceMember.upsert).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId, userId: invitedUserId } },
        create: {
          workspaceId,
          userId: invitedUserId,
          role: WorkspaceRole.MEMBER,
          email: 'invited@example.com',
        },
        update: { email: 'invited@example.com' },
      });
      expect(mockPrisma.channelMember.upsert).toHaveBeenCalledWith({
        where: { channelId_userId: { channelId: 'ch_general', userId: invitedUserId } },
        create: { channelId: 'ch_general', userId: invitedUserId, role: 'MEMBER' },
        update: {},
      });
      expect(mockEvents.emit).toHaveBeenCalledWith('member.joined', expect.any(Object));
    });

    it('rejects an expired or revoked invitation', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_revoked',
        tokenHash: hashToken('revoked_token'),
        workspaceId,
        email: null,
        status: InvitationStatus.REVOKED,
        expiresAt: new Date(Date.now() + 100000),
        isLink: true,
        useCount: 0,
        maxUses: null,
        workspace: { id: workspaceId, slug: 'acme' },
        channel: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: invitedUserId,
        email: 'invited@example.com',
      });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.acceptInvitation('revoked_token', invitedUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses an invitation sent to a different email address', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_wrong',
        tokenHash: hashToken('wrong_token'),
        workspaceId,
        email: 'someone-else@example.com',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        isLink: false,
        useCount: 0,
        maxUses: null,
        workspace: { id: workspaceId, slug: 'acme' },
        channel: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: invitedUserId,
        email: 'invited@example.com',
      });

      await expect(
        service.acceptInvitation('wrong_token', invitedUserId),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.workspaceMember.upsert).not.toHaveBeenCalled();
    });

    it('is idempotent: an existing member gets alreadyMember without a second write', async () => {
      const rawToken = 'already_member_token';
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_2',
        tokenHash: hashToken(rawToken),
        workspaceId,
        email: 'invited@example.com',
        role: WorkspaceRole.MEMBER,
        channelId: null,
        // Already consumed once — the status gate would otherwise 404 here.
        status: InvitationStatus.ACCEPTED,
        expiresAt: new Date(Date.now() + 100000),
        isLink: false,
        useCount: 1,
        maxUses: null,
        workspace: { id: workspaceId, slug: 'acme' },
        channel: null,
        invitedBy: { id: actorId, name: 'Alice' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: invitedUserId,
        email: 'invited@example.com',
      });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({ id: 'wm_1' });

      const res = await service.acceptInvitation(rawToken, invitedUserId);

      expect(res).toEqual({
        workspaceSlug: 'acme',
        channelSlug: undefined,
        alreadyMember: true,
      });
      expect(mockPrisma.workspaceMember.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Decline & Resend', () => {
    it('marks invitation as DECLINED when declined', async () => {
      const rawToken = 'token_to_decline';
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv_1',
        status: InvitationStatus.PENDING,
      });
      mockPrisma.invitation.update.mockResolvedValue({});

      await service.declineInvitation(rawToken);

      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        data: expect.objectContaining({ status: InvitationStatus.DECLINED }),
      });
    });

    it('resends an invitation by refreshing token and expiration', async () => {
      mockPrisma.invitation.findFirst.mockResolvedValue({
        id: 'inv_1',
        role: WorkspaceRole.MEMBER,
        status: InvitationStatus.PENDING,
        workspaceId,
        invitedBy: { id: actorId, name: 'Admin' },
      });
      mockPrisma.invitation.update.mockImplementation(({ data }: any) => ({
        id: 'inv_1',
        ...data,
        invitedBy: { id: actorId, name: 'Admin' },
      }));

      const res = await service.resendInvitation(
        workspaceId,
        WorkspaceRole.ADMIN,
        'inv_1',
        true,
      );

      expect(res.token).toBeDefined();
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        data: expect.objectContaining({ status: InvitationStatus.PENDING }),
        include: expect.any(Object),
      });
    });
  });

  describe('Shareable Invitation Links', () => {
    it('creates a shareable invitation link with expiration and usage limits', async () => {
      mockPrisma.invitation.create.mockImplementation(({ data }: any) => ({
        id: 'link_1',
        ...data,
        invitedBy: { id: actorId, name: 'Admin' },
      }));

      const res = await service.createInvitationLink(
        workspaceId,
        actorId,
        WorkspaceRole.ADMIN,
        {
          role: WorkspaceRole.MEMBER,
          expiresInDays: 7,
          maxUses: 10,
        },
      );

      expect(res.link.isLink).toBe(true);
      expect(res.link.maxUses).toBe(10);
      expect(res.url).toContain('/invite/');
      expect(res.token).toBeDefined();
    });

    it('regenerates a link token and resets useCount', async () => {
      mockPrisma.invitation.findFirst.mockResolvedValue({
        id: 'link_1',
        role: WorkspaceRole.MEMBER,
        isLink: true,
        workspaceId,
        invitedBy: { id: actorId, name: 'Admin' },
      });
      mockPrisma.invitation.update.mockImplementation(({ data }: any) => ({
        id: 'link_1',
        ...data,
        invitedBy: { id: actorId, name: 'Admin' },
      }));

      const res = await service.regenerateInvitationLink(
        workspaceId,
        WorkspaceRole.ADMIN,
        'link_1',
      );

      expect(res.token).toBeDefined();
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'link_1' },
        data: expect.objectContaining({
          status: InvitationStatus.PENDING,
          useCount: 0,
        }),
        include: expect.any(Object),
      });
    });
  });
});

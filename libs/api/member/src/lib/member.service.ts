import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
  PUBLIC_USER_SELECT,
  expiresAt,
  generateToken,
  hashToken,
  toInvitation,
  toPublicUser,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  InvitationStatus,
  WorkspaceRole,
  hasWorkspaceRole,
  type Invitation,
  type InvitationPublicPreview,
  type InviteBatchResult,
  type MembershipStatus,
  type WorkspaceMember,
} from '@org/types';
import type {
  CreateInvitationLinkInput,
  InviteMembersInput,
  UpdateInvitationLinkInput,
  UpdateMemberRoleInput,
} from '@org/validation';

const INVITATION_TTL = '14d';

const INVITATION_INCLUDE = {
  invitedBy: { select: PUBLIC_USER_SELECT },
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
      avatarUrl: true,
      icon: true,
      iconColor: true,
    },
  },
  channel: { select: { id: true, name: true, slug: true } },
  team: { select: { id: true, name: true, key: true } },
  project: { select: { id: true, name: true, slug: true } },
};

@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(workspaceId: string): Promise<WorkspaceMember[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ joinedAt: 'asc' }],
      include: { user: { select: { ...PUBLIC_USER_SELECT, email: true } } },
    });

    return members.map((member) => ({
      id: member.id,
      workspaceId: member.workspaceId,
      role: member.role as WorkspaceRole,
      status: member.status as MembershipStatus,
      joinedAt: member.joinedAt.toISOString(),
      user: toPublicUser(member.user),
      email: member.email ?? member.user?.email ?? null,
    }));
  }

  /**
   * Changes a member's role.
   *
   * An actor may not promote anyone to a role at or above their own, which is
   * what stops an ADMIN from minting peers or escalating themselves.
   */
  async updateRole(
    workspaceId: string,
    actorRole: WorkspaceRole,
    targetUserId: string,
    input: UpdateMemberRoleInput,
  ): Promise<void> {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found.');

    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        'The owner role can only change through an ownership transfer.',
      );
    }

    const targetRole = target.role as WorkspaceRole;
    if (
      hasWorkspaceRole(targetRole, actorRole) ||
      hasWorkspaceRole(input.role, actorRole)
    ) {
      throw new ForbiddenException(
        'You cannot assign a role at or above your own.',
      );
    }

    await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role: input.role },
    });
  }

  async remove(
    workspaceId: string,
    actorRole: WorkspaceRole,
    targetUserId: string,
  ): Promise<void> {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found.');

    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('The owner cannot be removed.');
    }
    if (hasWorkspaceRole(target.role as WorkspaceRole, actorRole)) {
      throw new ForbiddenException(
        'You cannot remove someone at or above your own role.',
      );
    }

    await this.detach(workspaceId, targetUserId);
  }

  /** Voluntary exit. The owner must transfer ownership first. */
  async leave(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('You are not a member.');

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ConflictException(
        'Transfer ownership before leaving this workspace.',
      );
    }

    await this.detach(workspaceId, userId);
  }

  /**
   * Drops every trace of a user's membership in one transaction.
   */
  private async detach(workspaceId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.channelMember.deleteMany({
        where: { userId, channel: { workspaceId } },
      }),
      this.prisma.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId, userId } },
      }),
    ]);
  }

  // --- invitations --------------------------------------------------------

  async listInvitations(
    workspaceId: string,
    params?: { status?: string; search?: string; scope?: string },
  ): Promise<Invitation[]> {
    const where: Record<string, unknown> = {
      workspaceId,
      isLink: false,
    };

    if (params?.status && params.status !== 'ALL') {
      where['status'] = params.status as InvitationStatus;
    }

    if (params?.search) {
      where['email'] = {
        contains: params.search.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (params?.scope) {
      if (params.scope === 'CHANNEL') {
        where['channelId'] = { not: null };
      } else if (params.scope === 'TEAM') {
        where['teamId'] = { not: null };
      } else if (params.scope === 'PROJECT') {
        where['projectId'] = { not: null };
      } else if (params.scope === 'WORKSPACE') {
        where['channelId'] = null;
        where['teamId'] = null;
        where['projectId'] = null;
      }
    }

    const invitations = await this.prisma.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: INVITATION_INCLUDE,
    });

    // Check expiration on read
    const now = Date.now();
    return invitations.map((inv) => {
      if (
        inv.status === InvitationStatus.PENDING &&
        inv.expiresAt.getTime() <= now
      ) {
        return toInvitation({ ...inv, status: InvitationStatus.EXPIRED });
      }
      return toInvitation(inv);
    });
  }

  /**
   * Invites by email.
   *
   * Addresses that already belong to the workspace are reported back rather
   * than failing the batch, so inviting a mixed list stays a single action.
   * Tokens are returned only outside production, where no mailer exists yet.
   */
  async invite(
    workspaceId: string,
    invitedById: string,
    actorRole: WorkspaceRole,
    input: InviteMembersInput,
    includeTokens: boolean,
  ): Promise<InviteBatchResult> {
    if (!hasWorkspaceRole(actorRole, input.role)) {
      throw new ForbiddenException(
        'You cannot assign a role higher than your own.',
      );
    }

    // Validate scopes if provided
    if (input.channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: input.channelId, workspaceId },
        select: { id: true },
      });
      if (!channel) throw new NotFoundException('Channel not found.');
    }
    if (input.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: input.teamId, workspaceId },
        select: { id: true },
      });
      if (!team) throw new NotFoundException('Team not found.');
    }
    if (input.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: input.projectId, workspaceId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('Project not found.');
    }

    // Check who is already a member
    const existingMembers = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { in: input.emails } },
      },
      select: { user: { select: { email: true } } },
    });
    const alreadyMembers = existingMembers.map((row) => row.user.email);
    const pendingEmails = input.emails.filter(
      (email) => !alreadyMembers.includes(email),
    );

    if (pendingEmails.length === 0) {
      return { invited: [], alreadyMembers };
    }

    const tokens: Record<string, string> = {};
    const invited: Invitation[] = [];

    for (const email of pendingEmails) {
      const token = generateToken(32);
      tokens[email] = token;

      // Find any existing pending invitation for this email in this workspace
      const existingInvitation = await this.prisma.invitation.findFirst({
        where: { workspaceId, email, isLink: false },
        select: { id: true },
      });

      let invitation;
      if (existingInvitation) {
        invitation = await this.prisma.invitation.update({
          where: { id: existingInvitation.id },
          data: {
            role: input.role,
            tokenHash: hashToken(token),
            expiresAt: expiresAt(INVITATION_TTL),
            status: InvitationStatus.PENDING,
            invitedById,
            channelId: input.channelId ?? null,
            teamId: input.teamId ?? null,
            projectId: input.projectId ?? null,
            message: input.message ?? null,
            revokedAt: null,
            acceptedAt: null,
            declinedAt: null,
          },
          include: INVITATION_INCLUDE,
        });
      } else {
        invitation = await this.prisma.invitation.create({
          data: {
            workspaceId,
            email,
            role: input.role,
            tokenHash: hashToken(token),
            expiresAt: expiresAt(INVITATION_TTL),
            status: InvitationStatus.PENDING,
            invitedById,
            channelId: input.channelId ?? null,
            teamId: input.teamId ?? null,
            projectId: input.projectId ?? null,
            message: input.message ?? null,
            isLink: false,
          },
          include: INVITATION_INCLUDE,
        });
      }

      invited.push(toInvitation(invitation));
    }

    this.events.emit(AppEvent.WorkspaceInvited, {
      workspaceId,
      actorId: invitedById,
      count: invited.length,
    });

    return {
      invited,
      alreadyMembers,
      ...(includeTokens ? { tokens } : {}),
    };
  }

  async resendInvitation(
    workspaceId: string,
    actorRole: WorkspaceRole,
    invitationId: string,
    includeTokens: boolean,
  ): Promise<{ invitation: Invitation; token?: string }> {
    const existing = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId, isLink: false },
      include: INVITATION_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Invitation not found.');

    if (existing.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException(
        'This invitation has already been accepted.',
      );
    }

    if (!hasWorkspaceRole(actorRole, existing.role as WorkspaceRole)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const token = generateToken(32);
    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        tokenHash: hashToken(token),
        expiresAt: expiresAt(INVITATION_TTL),
        status: InvitationStatus.PENDING,
        revokedAt: null,
        declinedAt: null,
      },
      include: INVITATION_INCLUDE,
    });

    return {
      invitation: toInvitation(updated),
      ...(includeTokens ? { token } : {}),
    };
  }

  async revokeInvitation(
    workspaceId: string,
    actorRole: WorkspaceRole,
    invitationId: string,
  ): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId },
      select: { id: true, role: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    if (!hasWorkspaceRole(actorRole, invitation.role as WorkspaceRole)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    });
  }

  /**
   * Public preview information about an invitation by its token.
   * Safe to call unauthenticated.
   */
  async getInvitationPreview(token: string): Promise<InvitationPublicPreview> {
    const hashed = hashToken(token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashed },
      include: INVITATION_INCLUDE,
    });

    if (!invitation) {
      throw new NotFoundException('This invitation does not exist.');
    }

    const isExpired =
      invitation.expiresAt.getTime() <= Date.now() ||
      (invitation.maxUses !== null &&
        invitation.maxUses !== undefined &&
        invitation.useCount >= invitation.maxUses);

    if (isExpired && invitation.status === InvitationStatus.PENDING) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      invitation.status = InvitationStatus.EXPIRED;
    }

    const isValid = invitation.status === InvitationStatus.PENDING && !isExpired;

    return {
      valid: isValid,
      status: invitation.status as InvitationStatus,
      email: invitation.email,
      role: invitation.role as WorkspaceRole,
      expiresAt: invitation.expiresAt.toISOString(),
      message: invitation.message,
      isLink: invitation.isLink,
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
        slug: invitation.workspace.slug,
        avatarUrl: invitation.workspace.avatarUrl,
        icon: invitation.workspace.icon,
        iconColor: invitation.workspace.iconColor,
      },
      inviter: {
        id: invitation.invitedBy.id,
        name: invitation.invitedBy.name,
        displayName: invitation.invitedBy.displayName,
        avatarUrl: invitation.invitedBy.avatarUrl,
      },
      channel: invitation.channel,
      team: invitation.team,
      project: invitation.project,
    };
  }

  /**
   * Accepts an invitation for the signed-in user.
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ workspaceSlug: string; channelSlug?: string }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: INVITATION_INCLUDE,
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('This invitation is no longer valid.');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('This invitation has expired.');
    }

    if (
      invitation.maxUses !== null &&
      invitation.maxUses !== undefined &&
      invitation.useCount >= invitation.maxUses
    ) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException(
        'This invitation link has reached its maximum uses.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    const newUseCount = invitation.useCount + 1;
    const isExhausted =
      !invitation.isLink ||
      (invitation.maxUses !== null &&
        invitation.maxUses !== undefined &&
        newUseCount >= invitation.maxUses);

    await this.prisma.$transaction(async (tx) => {
      // Upsert workspace membership
      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: invitation.workspaceId, userId },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          email: invitation.email ?? user.email,
        },
        update: {
          email: invitation.email ?? user.email,
        },
      });

      // If scoped to a channel, add to channel membership
      if (invitation.channelId) {
        await tx.channelMember.upsert({
          where: {
            channelId_userId: {
              channelId: invitation.channelId,
              userId,
            },
          },
          create: {
            channelId: invitation.channelId,
            userId,
            role: 'MEMBER',
          },
          update: {},
        });
      }

      // Update invitation usage/status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          useCount: { increment: 1 },
          ...(isExhausted
            ? { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() }
            : {}),
        },
      });
    });

    this.events.emit(AppEvent.MemberJoined, {
      workspaceId: invitation.workspaceId,
      actorId: userId,
      channelId: invitation.channelId,
    });

    return {
      workspaceSlug: invitation.workspace.slug,
      channelSlug: invitation.channel?.slug,
    };
  }

  /**
   * Declines an invitation.
   */
  async declineInvitation(token: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, status: true },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('This invitation is no longer valid.');
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.DECLINED, declinedAt: new Date() },
    });
  }

  // --- Shareable Invitation Links ----------------------------------------

  async listInvitationLinks(workspaceId: string): Promise<Invitation[]> {
    const links = await this.prisma.invitation.findMany({
      where: { workspaceId, isLink: true },
      orderBy: { createdAt: 'desc' },
      include: INVITATION_INCLUDE,
    });

    return links.map(toInvitation);
  }

  async createInvitationLink(
    workspaceId: string,
    actorId: string,
    actorRole: WorkspaceRole,
    input: CreateInvitationLinkInput,
  ): Promise<{ link: Invitation; url: string; token: string }> {
    if (!hasWorkspaceRole(actorRole, input.role)) {
      throw new ForbiddenException(
        'You cannot assign a role higher than your own.',
      );
    }

    const token = generateToken(32);
    const days = input.expiresInDays && input.expiresInDays > 0 ? input.expiresInDays : 30;
    const expires = new Date(Date.now() + days * 86400000);

    const link = await this.prisma.invitation.create({
      data: {
        workspaceId,
        email: null,
        role: input.role,
        tokenHash: hashToken(token),
        expiresAt: expires,
        status: InvitationStatus.PENDING,
        invitedById: actorId,
        channelId: input.channelId ?? null,
        teamId: input.teamId ?? null,
        projectId: input.projectId ?? null,
        maxUses: input.maxUses ?? null,
        useCount: 0,
        isLink: true,
      },
      include: INVITATION_INCLUDE,
    });

    return {
      link: toInvitation(link),
      url: `/invite/${token}`,
      token,
    };
  }

  async updateInvitationLink(
    workspaceId: string,
    actorRole: WorkspaceRole,
    linkId: string,
    input: UpdateInvitationLinkInput,
  ): Promise<Invitation> {
    const existing = await this.prisma.invitation.findFirst({
      where: { id: linkId, workspaceId, isLink: true },
      select: { id: true, role: true },
    });
    if (!existing) throw new NotFoundException('Invitation link not found.');

    if (input.role && !hasWorkspaceRole(actorRole, input.role)) {
      throw new ForbiddenException('Cannot assign a higher role.');
    }

    const updated = await this.prisma.invitation.update({
      where: { id: linkId },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
        ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
        ...(input.isActive !== undefined
          ? {
              status: input.isActive
                ? InvitationStatus.PENDING
                : InvitationStatus.REVOKED,
              revokedAt: input.isActive ? null : new Date(),
            }
          : {}),
      },
      include: INVITATION_INCLUDE,
    });

    return toInvitation(updated);
  }

  async revokeInvitationLink(
    workspaceId: string,
    actorRole: WorkspaceRole,
    linkId: string,
  ): Promise<void> {
    await this.revokeInvitation(workspaceId, actorRole, linkId);
  }

  async regenerateInvitationLink(
    workspaceId: string,
    actorRole: WorkspaceRole,
    linkId: string,
  ): Promise<{ link: Invitation; url: string; token: string }> {
    const existing = await this.prisma.invitation.findFirst({
      where: { id: linkId, workspaceId, isLink: true },
      include: INVITATION_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Invitation link not found.');

    if (!hasWorkspaceRole(actorRole, existing.role as WorkspaceRole)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const token = generateToken(32);
    const updated = await this.prisma.invitation.update({
      where: { id: linkId },
      data: {
        tokenHash: hashToken(token),
        expiresAt: expiresAt('30d'),
        status: InvitationStatus.PENDING,
        useCount: 0,
        revokedAt: null,
      },
      include: INVITATION_INCLUDE,
    });

    return {
      link: toInvitation(updated),
      url: `/invite/${token}`,
      token,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
  type MembershipStatus,
  type WorkspaceMember,
} from '@org/types';
import type {
  InviteMembersInput,
  UpdateMemberRoleInput,
} from '@org/validation';

const INVITATION_TTL = '14d';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

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
   *
   * Channel membership hangs off `channels`, not `workspace_members`, so no
   * foreign key cascades from the workspace row. Deleting it alone would leave
   * the person listed in — and counted against — every channel of a workspace
   * they are no longer in.
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

  async listInvitations(workspaceId: string): Promise<Invitation[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: PUBLIC_USER_SELECT } },
    });
    return invitations.map(toInvitation);
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
    input: InviteMembersInput,
    includeTokens: boolean,
  ): Promise<{
    invited: Invitation[];
    alreadyMembers: string[];
    tokens?: Record<string, string>;
  }> {
    const existingMembers = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, user: { email: { in: input.emails } } },
      select: { user: { select: { email: true } } },
    });
    const alreadyMembers = existingMembers.map((row) => row.user.email);
    const pending = input.emails.filter(
      (email) => !alreadyMembers.includes(email),
    );

    if (pending.length === 0) {
      return { invited: [], alreadyMembers };
    }

    const tokens: Record<string, string> = {};
    const invited: Invitation[] = [];

    for (const email of pending) {
      const token = generateToken(32);
      tokens[email] = token;

      // Re-inviting refreshes the existing row rather than colliding with the
      // (workspaceId, email) unique constraint.
      const invitation = await this.prisma.invitation.upsert({
        where: { workspaceId_email: { workspaceId, email } },
        create: {
          workspaceId,
          email,
          role: input.role,
          tokenHash: hashToken(token),
          expiresAt: expiresAt(INVITATION_TTL),
          invitedById,
        },
        update: {
          role: input.role,
          tokenHash: hashToken(token),
          expiresAt: expiresAt(INVITATION_TTL),
          status: InvitationStatus.PENDING,
          invitedById,
          revokedAt: null,
          acceptedAt: null,
        },
        include: { invitedBy: { select: PUBLIC_USER_SELECT } },
      });

      invited.push(toInvitation(invitation));
    }

    return {
      invited,
      alreadyMembers,
      ...(includeTokens ? { tokens } : {}),
    };
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId },
      select: { id: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    });
  }

  /**
   * Accepts an invitation for the signed-in user.
   *
   * The token itself is the secret — whoever holds the link redeems it — so
   * the signed-in account's email no longer has to match the invited address.
   * That is what lets someone join a workspace under a second email without a
   * second account: the invited address is stored on the membership as its
   * workspace-specific email rather than being checked against the user.
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ workspaceSlug: string }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { workspace: { select: { id: true, slug: true } } },
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

    await this.prisma.$transaction([
      this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: invitation.workspaceId, userId },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          email: invitation.email,
        },
        update: {
          email: invitation.email,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      }),
    ]);

    return { workspaceSlug: invitation.workspace.slug };
  }
}

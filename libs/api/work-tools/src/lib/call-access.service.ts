import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Prisma } from '@org/database';

/**
 * Who may see a call's notes, summary, decisions, action items and transcript.
 *
 * A call records a private conversation — a 1:1 DM or a private channel — so
 * workspace membership alone is not enough. A user can see a call when any of
 * these hold:
 *
 *  - they started it or took part in it;
 *  - it happened in a channel they can read (public, or a private one they are
 *    a member of — resolved from `channelId`);
 *  - it is linked to a meeting (meetings are workspace-visible);
 *  - it was explicitly shared with the workspace or with them.
 *
 * Everything that reads or writes call data goes through here, so the rule has
 * one definition. A call the user may not see answers 404, never 403, so its
 * existence does not leak.
 */
@Injectable()
export class CallAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** A `where` matching exactly the calls `userId` may see in the workspace. */
  visibleWhere(workspaceId: string, userId: string): Prisma.CallWhereInput {
    return {
      workspaceId,
      OR: [
        { startedById: userId },
        { participants: { some: { userId } } },
        { sharedWithWorkspace: true },
        { sharedWithUserIds: { has: userId } },
        { meetingId: { not: null } },
        { channel: { is: { visibility: 'PUBLIC' } } },
        { channel: { is: { members: { some: { userId } } } } },
      ],
    };
  }

  /** Throws 404 unless the call exists in this workspace and `userId` may see it. */
  async assertCanView(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<void> {
    const visible = await this.prisma.call.count({
      where: { id: callId, ...this.visibleWhere(workspaceId, userId) },
    });
    if (visible === 0) throw new NotFoundException('Call not found.');
  }

  /**
   * Controls on the live session itself — ending it, renaming it, feeding it
   * transcript — belong to the people on it, not to everyone who can read the
   * summary afterwards.
   */
  async assertIsParticipant(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<void> {
    await this.assertCanView(workspaceId, userId, callId);
    const onCall = await this.prisma.call.count({
      where: {
        id: callId,
        OR: [{ startedById: userId }, { participants: { some: { userId } } }],
      },
    });
    if (onCall === 0) {
      throw new ForbiddenException('Only people on this call can do that.');
    }
  }

  /** Drops ids that are not active members of the workspace. */
  async filterWorkspaceMembers(
    workspaceId: string,
    userIds: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return [];
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE', userId: { in: unique } },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  /** Throws unless `userId` is an active member — for assignees and the like. */
  async assertWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    const [member] = await this.filterWorkspaceMembers(workspaceId, [userId]);
    if (!member) {
      throw new NotFoundException('That person is not a member of this workspace.');
    }
  }
}

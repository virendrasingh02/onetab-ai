import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { CatchUpSummary } from '@org/types';

@Injectable()
export class CatchUpService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatchUp(workspaceId: string, userId: string): Promise<CatchUpSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, displayName: true, lastSeenAt: true },
    });

    const now = new Date();
    // Default to last 24 hours if user has never logged out or lastSeenAt is null
    const fallbackSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since = user?.lastSeenAt && user.lastSeenAt < now ? user.lastSeenAt : fallbackSince;
    const sinceHours = Math.max(1, Math.round((now.getTime() - since.getTime()) / (1000 * 60 * 60)));

    const userName = user?.displayName || user?.name || 'there';
    const greeting =
      sinceHours < 4
        ? `Welcome back, ${userName}! Here is what happened recently.`
        : sinceHours < 24
        ? `Welcome back, ${userName}! Here is your catch-up for today.`
        : `Welcome back, ${userName}! Here is what happened while you were away.`;

    // 1. Unread Mentions count
    const unreadMentionsCount = await this.prisma.recentActivity.count({
      where: {
        workspaceId,
        mentionedUserIds: { has: userId },
        occurredAt: { gte: since },
      },
    });

    // 2. Unread Notifications count
    const unreadNotificationsCount = await this.prisma.notification.count({
      where: {
        workspaceId,
        recipientId: userId,
        readAt: null,
      },
    });

    // 3. Tasks Completed in workspace
    const tasksCompletedCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: 'DONE',
        completedAt: { gte: since },
      },
    });

    // 4. Tasks Assigned to User
    const tasksAssignedCount = await this.prisma.task.count({
      where: {
        workspaceId,
        assigneeIds: { has: userId },
        createdAt: { gte: since },
      },
    });

    // 5. Active Huddles in workspace
    const activeHuddlesCount = await this.prisma.huddle.count({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
    });

    // 6. Meeting Decisions made
    const decisions = await this.prisma.meetingDecision.findMany({
      where: {
        meeting: { workspaceId },
        createdAt: { gte: since },
      },
      include: {
        author: { select: { name: true, displayName: true, avatarUrl: true } },
        meeting: { select: { title: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    // 7. Recent key updates
    const keyUpdates: CatchUpSummary['keyUpdates'] = [];

    for (const d of decisions) {
      keyUpdates.push({
        id: `decision:${d.id}`,
        type: 'decision',
        title: `Decision in ${d.meeting.title}`,
        summary: d.text,
        timestamp: d.createdAt.toISOString(),
        href: `meetings?meetingId=${d.meetingId}`,
        actor: {
          name: d.author.displayName || d.author.name,
          avatarUrl: d.author.avatarUrl,
        },
      });
    }

    // Recent tasks completed
    const recentCompletedTasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: 'DONE',
        completedAt: { gte: since },
      },
      select: {
        id: true,
        title: true,
        identifier: true,
        completedAt: true,
        assignee: { select: { name: true, displayName: true, avatarUrl: true } },
      },
      take: 5,
      orderBy: { completedAt: 'desc' },
    });

    for (const t of recentCompletedTasks) {
      keyUpdates.push({
        id: `task:${t.id}`,
        type: 'task',
        title: t.identifier ? `${t.identifier} ${t.title}` : t.title,
        summary: 'Completed and verified',
        timestamp: (t.completedAt ?? now).toISOString(),
        href: `tasks?taskId=${t.id}`,
        actor: t.assignee
          ? {
              name: t.assignee.displayName || t.assignee.name,
              avatarUrl: t.assignee.avatarUrl,
            }
          : undefined,
      });
    }

    // Recent Documents created
    const recentDocs = await this.prisma.workDocument.findMany({
      where: {
        workspaceId,
        createdAt: { gte: since },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: { select: { name: true, displayName: true, avatarUrl: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    for (const doc of recentDocs) {
      keyUpdates.push({
        id: `doc:${doc.id}`,
        type: 'document',
        title: doc.title || 'Untitled Document',
        summary: 'New document created',
        timestamp: doc.createdAt.toISOString(),
        href: `docs/${doc.id}`,
        actor: {
          name: doc.author.displayName || doc.author.name,
          avatarUrl: doc.author.avatarUrl,
        },
      });
    }

    return {
      workspaceId,
      lastActiveAt: since.toISOString(),
      sinceHours,
      greeting,
      unreadMentionsCount,
      unreadDMsCount: unreadNotificationsCount,
      tasksCompletedCount,
      tasksAssignedCount,
      activeHuddlesCount,
      decisionsMadeCount: decisions.length,
      keyUpdates: keyUpdates.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    };
  }
}

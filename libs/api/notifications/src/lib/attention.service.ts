import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  classifyAttentionCategory,
  sortAttentionItems,
  type AttentionAction,
  type AttentionItem,
} from '@org/types';

@Injectable()
export class AttentionService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttention(
    workspaceId: string,
    userId: string,
  ): Promise<AttentionItem[]> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Fetch dismissed or snoozed states for this user in this workspace
    const states = await this.prisma.attentionItemState.findMany({
      where: {
        workspaceId,
        userId,
        OR: [{ dismissedAt: { not: null } }, { snoozedUntil: { gt: now } }],
      },
      select: { itemKey: true, dismissedAt: true, snoozedUntil: true },
    });

    const activeSuppressionKeys = new Set(states.map((s) => s.itemKey));

    const items: AttentionItem[] = [];

    // 2. Overdue and Due-Soon Tasks
    const activeTasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        assigneeIds: { has: userId },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        identifier: true,
        createdAt: true,
        reporter: {
          select: { id: true, name: true, displayName: true, avatarUrl: true },
        },
      },
      take: 20,
    });

    for (const task of activeTasks) {
      const itemKey = `task:${task.id}`;
      if (activeSuppressionKeys.has(itemKey)) continue;

      const label = task.identifier
        ? `${task.identifier} ${task.title}`
        : task.title;
      const isOverdue = task.dueDate && task.dueDate < now;
      const isDueSoon =
        task.dueDate && task.dueDate >= now && task.dueDate <= in24Hours;

      let priorityScore = 50;
      if (isOverdue) priorityScore = 95;
      else if (isDueSoon) priorityScore = 80;
      else if (task.priority === 'URGENT') priorityScore = 88;
      else if (task.priority === 'HIGH') priorityScore = 70;

      // Only include tasks that require active attention
      if (
        isOverdue ||
        isDueSoon ||
        task.priority === 'URGENT' ||
        task.priority === 'HIGH'
      ) {
        const actions: AttentionAction[] = [
          {
            id: 'complete',
            label: 'Mark Done',
            kind: 'primary',
            actionType: 'MARK_COMPLETE',
          },
          {
            id: 'view',
            label: 'Open Task',
            kind: 'secondary',
            actionType: 'NAVIGATE',
            href: `tasks?taskId=${task.id}`,
          },
          {
            id: 'snooze',
            label: 'Snooze',
            kind: 'secondary',
            actionType: 'SNOOZE',
          },
          {
            id: 'dismiss',
            label: 'Dismiss',
            kind: 'danger',
            actionType: 'DISMISS',
          },
        ];

        items.push({
          id: task.id,
          itemKey,
          category: classifyAttentionCategory(priorityScore),
          title: isOverdue ? `Overdue: ${label}` : label,
          description: isOverdue
            ? `Was due on ${task.dueDate?.toLocaleDateString()}`
            : isDueSoon
            ? `Due soon: ${task.dueDate?.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : `High priority task in progress`,
          priorityScore,
          sourceType: 'task',
          sourceId: task.id,
          deepLink: `tasks?taskId=${task.id}`,
          timestamp: (task.dueDate ?? task.createdAt).toISOString(),
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
          actor: task.reporter
            ? {
                id: task.reporter.id,
                name: task.reporter.displayName || task.reporter.name,
                avatarUrl: task.reporter.avatarUrl,
              }
            : null,
          actions,
        });
      }
    }

    // 3. Mentions in Recent Activity
    const recentMentions = await this.prisma.recentActivity.findMany({
      where: {
        workspaceId,
        mentionedUserIds: { has: userId },
        occurredAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        summary: true,
        channelId: true,
        occurredAt: true,
        resourceType: true,
        resourceId: true,
      },
      take: 10,
      orderBy: { occurredAt: 'desc' },
    });

    for (const mention of recentMentions) {
      const itemKey = `mention:${mention.id}`;
      if (activeSuppressionKeys.has(itemKey)) continue;

      const priorityScore = 75;
      const actions: AttentionAction[] = [
        {
          id: 'reply',
          label: 'View Mention',
          kind: 'primary',
          actionType: 'NAVIGATE',
          href: mention.channelId
            ? `c/${mention.channelId}`
            : mention.resourceType
            ? `${mention.resourceType}s`
            : 'inbox',
        },
        {
          id: 'dismiss',
          label: 'Dismiss',
          kind: 'secondary',
          actionType: 'DISMISS',
        },
      ];

      items.push({
        id: mention.id,
        itemKey,
        category: classifyAttentionCategory(priorityScore),
        title: mention.summary || 'You were mentioned in a conversation',
        description: 'Mentioned recently in this workspace',
        priorityScore,
        sourceType: 'mention',
        sourceId: mention.id,
        deepLink: mention.channelId
          ? `c/${mention.channelId}`
          : mention.resourceType
          ? `${mention.resourceType}s`
          : 'inbox',
        timestamp: mention.occurredAt.toISOString(),
        actions,
      });
    }

    // 4. Upcoming Meetings in next 2 hours
    const upcomingParticipations =
      await this.prisma.meetingParticipant.findMany({
        where: {
          userId,
          meeting: {
            workspaceId,
            status: 'SCHEDULED',
            startAt: { gte: now, lte: in2Hours },
          },
        },
        include: {
          meeting: {
            select: {
              id: true,
              title: true,
              startAt: true,
              organizer: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        take: 5,
      });

    for (const p of upcomingParticipations) {
      const meeting = p.meeting;
      const itemKey = `meeting:${meeting.id}`;
      if (activeSuppressionKeys.has(itemKey)) continue;

      const priorityScore = 85;
      const actions: AttentionAction[] = [
        {
          id: 'join',
          label: 'Open Meeting',
          kind: 'primary',
          actionType: 'NAVIGATE',
          href: `meetings?meetingId=${meeting.id}`,
        },
        {
          id: 'dismiss',
          label: 'Dismiss',
          kind: 'secondary',
          actionType: 'DISMISS',
        },
      ];

      items.push({
        id: meeting.id,
        itemKey,
        category: classifyAttentionCategory(priorityScore),
        title: `Upcoming Meeting: ${meeting.title}`,
        description: `Starts at ${meeting.startAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        priorityScore,
        sourceType: 'meeting',
        sourceId: meeting.id,
        deepLink: `meetings?meetingId=${meeting.id}`,
        timestamp: meeting.startAt.toISOString(),
        actor: meeting.organizer
          ? {
              id: meeting.organizer.id,
              name: meeting.organizer.displayName || meeting.organizer.name,
              avatarUrl: meeting.organizer.avatarUrl,
            }
          : null,
        actions,
      });
    }

    // 5. Unread High-Priority Notifications
    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        workspaceId,
        recipientId: userId,
        readAt: null,
        kind: {
          in: [
            'TASK_ASSIGNED',
            'CHANNEL_INVITE',
            'WORKSPACE_INVITE',
            'DOCUMENT_SHARED',
          ],
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    for (const n of unreadNotifications) {
      const itemKey = `notification:${n.id}`;
      if (activeSuppressionKeys.has(itemKey)) continue;

      const priorityScore = 65;
      const actions: AttentionAction[] = [
        {
          id: 'open',
          label: 'View',
          kind: 'primary',
          actionType: 'NAVIGATE',
          href: n.deepLink || 'inbox',
        },
        {
          id: 'dismiss',
          label: 'Dismiss',
          kind: 'secondary',
          actionType: 'DISMISS',
        },
      ];

      items.push({
        id: n.id,
        itemKey,
        category: classifyAttentionCategory(priorityScore),
        title: n.title,
        description: n.body,
        priorityScore,
        sourceType: 'system',
        sourceId: n.id,
        deepLink: n.deepLink || 'inbox',
        timestamp: n.createdAt.toISOString(),
        actions,
      });
    }

    return sortAttentionItems(items).slice(0, 25);
  }

  async snooze(
    workspaceId: string,
    userId: string,
    itemKey: string,
    snoozeDurationMinutes: number,
  ): Promise<void> {
    const snoozedUntil = new Date(
      Date.now() + snoozeDurationMinutes * 60 * 1000,
    );
    await this.prisma.attentionItemState.upsert({
      where: {
        workspaceId_userId_itemKey: {
          workspaceId,
          userId,
          itemKey,
        },
      },
      create: {
        workspaceId,
        userId,
        itemKey,
        snoozedUntil,
      },
      update: {
        snoozedUntil,
        dismissedAt: null,
      },
    });
  }

  async dismiss(
    workspaceId: string,
    userId: string,
    itemKey: string,
  ): Promise<void> {
    await this.prisma.attentionItemState.upsert({
      where: {
        workspaceId_userId_itemKey: {
          workspaceId,
          userId,
          itemKey,
        },
      },
      create: {
        workspaceId,
        userId,
        itemKey,
        dismissedAt: new Date(),
      },
      update: {
        dismissedAt: new Date(),
        snoozedUntil: null,
      },
    });
  }
}

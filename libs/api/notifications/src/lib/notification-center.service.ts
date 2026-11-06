import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, normalisePagination, toPage, type CursorQuery } from '@org/api-common';
import { NotificationKind, PrismaService } from '@org/database';
import type { Paginated } from '@org/types';

export interface CreateNotificationInput {
  workspaceId: string;
  recipientId: string;
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  deepLink?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

/**
 * Marks a row as a client-reported chat message. Clients with a Matrix session
 * have already shown it natively, so realtime and desktop polling skip these.
 */
export const CHAT_ROOM_RESOURCE = 'chat-room';

export interface ChatMessageReport {
  roomId: string;
  /** The Matrix event: what stops two reporters announcing it twice. */
  eventId: string;
  title: string;
  body?: string | null;
  /** Omit to have it built from the room, as for another workspace's channel. */
  deepLink?: string | null;
  threadRootId?: string | null;
  senderId?: string | null;
  isMention?: boolean;
  isGroup?: boolean;
  /** For a DM, which has no workspace of its own. Channels ignore it. */
  workspaceId?: string | null;
}

const NOTIFICATION_ROW_SELECT = {
  id: true,
  workspaceId: true,
  recipientId: true,
  actorId: true,
  kind: true,
  title: true,
  body: true,
  deepLink: true,
  resourceType: true,
  resourceId: true,
  readAt: true,
  createdAt: true,
} as const;

interface NotificationRow {
  id: string;
  workspaceId: string;
  recipientId: string;
  createdAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2002';
}

export interface NotificationView {
  id: string;
  workspaceId: string;
  kind: string;
  title: string;
  body: string | null;
  deepLink: string | null;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  workspace?: {
    id: string;
    name: string;
    slug?: string;
    avatarUrl?: string | null;
    icon?: string | null;
    iconColor?: string | null;
  } | null;
  workspaceName?: string | null;
  workspaceIcon?: string | null;
}

/**
 * The per-recipient notification store — the bell menu and its unread badge.
 *
 * Rows are written by `DomainEventsListener` reacting to the app event bus, not
 * by the services that do the work, so a new notification trigger is a new
 * `@OnEvent` handler and never a change to `WorkToolsService`.
 */
@Injectable()
export class NotificationCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Creates one notification, unless it would duplicate one the recipient has
   * not read yet.
   *
   * The dedup key is (recipient, kind, resource): re-assigning an already
   * assigned task, or two quick edits, should not stack identical unread rows.
   * Returns null when nothing was written.
   */
  async create(input: CreateNotificationInput): Promise<{ id: string } | null> {
    if (input.actorId && input.actorId === input.recipientId) {
      // Don't notify someone about their own action.
      return null;
    }

    if (input.resourceType && input.resourceId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: input.recipientId,
          kind: input.kind,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          readAt: null,
        },
        select: { id: true },
      });
      if (existing) return existing;
    }

    const created = await this.prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        deepLink: input.deepLink ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
      },
      select: NOTIFICATION_ROW_SELECT,
    });

    await this.announce(created);
    return { id: created.id };
  }

  /** Hands a row to realtime and push delivery. */
  private async announce(row: NotificationRow): Promise<void> {
    const unreadCount = await this.unreadCount(row.workspaceId, row.recipientId);

    this.events.emit(AppEvent.NotificationCreated, {
      recipientId: row.recipientId,
      workspaceId: row.workspaceId,
      notification: {
        ...row,
        read: false,
        createdAt: row.createdAt.toISOString(),
      },
      unreadCount,
    });
  }

  /**
   * Records a chat message for its recipient and announces it, which is what
   * reaches their bell and phones. Called by the recipient's own clients, and by
   * the server when they have none open, so the recipient is never taken from
   * the report's content.
   *
   * A conversation keeps one unread row. Each new message updates that row and
   * announces it again, so phones get every message while the bell does not
   * stack. `sourceEventId` is what makes a second report of the same message a
   * no-op, including one that loses a race.
   */
  async reportChatMessage(
    recipientId: string,
    report: ChatMessageReport,
  ): Promise<{ id: string } | null> {
    if (report.senderId === recipientId) return null;

    const channel = await this.prisma.channel.findFirst({
      where: { matrixRoomId: report.roomId },
      select: { id: true, slug: true, workspaceId: true },
    });
    const workspaceId =
      channel?.workspaceId ??
      report.workspaceId ??
      (await this.sharedWorkspaceId(recipientId, report.senderId));
    if (!workspaceId) return null;

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: recipientId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!member) return null;

    if (channel && (await this.isQuiet(recipientId, channel, report))) {
      return null;
    }

    // The sender comes from the client: only trust it for someone in this
    // workspace, or a caller could attach a stranger's identity to a row.
    const actor = report.senderId
      ? await this.prisma.workspaceMember.findFirst({
          where: { workspaceId, userId: report.senderId },
          select: { userId: true },
        })
      : null;

    const data = {
      title: report.title,
      body: report.body ?? null,
      deepLink: report.deepLink ?? this.chatDeepLink(report, channel?.slug),
      actorId: actor?.userId ?? null,
      sourceEventId: report.eventId,
    };
    const kind = report.isMention
      ? NotificationKind.MENTION
      : NotificationKind.CHAT_MESSAGE;

    try {
      const unread = await this.prisma.notification.findFirst({
        where: {
          recipientId,
          kind,
          resourceType: CHAT_ROOM_RESOURCE,
          resourceId: report.roomId,
          readAt: null,
        },
        select: { id: true },
      });

      if (!unread) {
        const created = await this.prisma.notification.create({
          data: {
            ...data,
            workspaceId,
            recipientId,
            kind,
            resourceType: CHAT_ROOM_RESOURCE,
            resourceId: report.roomId,
          },
          select: NOTIFICATION_ROW_SELECT,
        });
        await this.announce(created);
        return { id: created.id };
      }

      const moved = await this.prisma.notification.updateMany({
        where: { id: unread.id, sourceEventId: { not: report.eventId } },
        data: { ...data, createdAt: new Date() },
      });
      if (moved.count === 0) return unread;

      const updated = await this.prisma.notification.findUniqueOrThrow({
        where: { id: unread.id },
        select: NOTIFICATION_ROW_SELECT,
      });
      await this.announce(updated);
      return unread;
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  /** Mutes and "Just mentions", for channels the reporting client cannot see. */
  private async isQuiet(
    userId: string,
    channel: { id: string; workspaceId: string },
    report: ChatMessageReport,
  ): Promise<boolean> {
    const [preference, membership] = await Promise.all([
      this.prisma.notificationPreference.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: channel.workspaceId },
        },
        select: { mutedChannelIds: true, mentionsOnly: true },
      }),
      this.prisma.channelMember.findFirst({
        where: { channelId: channel.id, userId },
        select: { isMuted: true, mentionsOnly: true },
      }),
    ]);

    if (membership?.isMuted || preference?.mutedChannelIds.includes(channel.id)) {
      return true;
    }
    return (
      !report.isMention &&
      !!(preference?.mentionsOnly || membership?.mentionsOnly)
    );
  }

  private chatDeepLink(report: ChatMessageReport, channelSlug?: string): string {
    const base = channelSlug
      ? `channels/${channelSlug}`
      : report.senderId && !report.isGroup
        ? `dms/${report.senderId}`
        : `dms?room=${encodeURIComponent(report.roomId)}`;
    if (!report.threadRootId) return base;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}thread=${encodeURIComponent(report.threadRootId)}`;
  }

  /** A DM belongs to no workspace, so it files under one both people share. */
  private async sharedWorkspaceId(
    recipientId: string,
    senderId?: string | null,
  ): Promise<string | null> {
    const row = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: recipientId,
        status: 'ACTIVE',
        ...(senderId
          ? { workspace: { members: { some: { userId: senderId } } } }
          : {}),
      },
      orderBy: { joinedAt: 'asc' },
      select: { workspaceId: true },
    });
    return row?.workspaceId ?? null;
  }

  /** Opening a conversation clears its rows, or the bell would never empty. */
  async markChatRoomRead(
    userId: string,
    roomId: string,
  ): Promise<{ count: number }> {
    const where = {
      recipientId: userId,
      resourceType: CHAT_ROOM_RESOURCE,
      resourceId: roomId,
      readAt: null,
    };
    const rows = await this.prisma.notification.findMany({
      where,
      select: { workspaceId: true },
      distinct: ['workspaceId'],
    });
    if (rows.length === 0) return { count: 0 };

    const result = await this.prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    for (const { workspaceId } of rows) {
      const unreadCount = await this.unreadCount(workspaceId, userId);
      this.events.emit('notification.read', {
        recipientId: userId,
        workspaceId,
        unreadCount,
      });
    }

    return { count: result.count };
  }

  async list(
    workspaceId: string,
    userId: string,
    query: CursorQuery & { unreadOnly?: boolean },
  ): Promise<Paginated<NotificationView>> {
    const page = normalisePagination(query);

    const rows = await this.prisma.notification.findMany({
      where: {
        workspaceId,
        recipientId: userId,
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
      take: page.take,
      ...(page.cursor ? { cursor: page.cursor, skip: page.skip } : {}),
    });

    const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, displayName: true, avatarUrl: true },
        })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));

    return toPage(
      rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspaceId,
        kind: row.kind,
        title: row.title,
        body: row.body,
        deepLink: row.deepLink,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
        actor: row.actorId ? (actorById.get(row.actorId) ?? null) : null,
        workspace: row.workspace
          ? {
              id: row.workspace.id,
              name: row.workspace.name,
              slug: row.workspace.slug,
              avatarUrl: row.workspace.avatarUrl,
              icon: row.workspace.icon,
              iconColor: row.workspace.iconColor,
            }
          : null,
        workspaceName: row.workspace?.name ?? null,
        workspaceIcon: row.workspace?.icon ?? row.workspace?.avatarUrl ?? null,
      })),
      page.limit,
    );
  }

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { workspaceId, recipientId: userId, readAt: null },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
      select: { id: true, workspaceId: true, readAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    if (!existing.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
      const unreadCount = await this.unreadCount(existing.workspaceId, userId);
      this.events.emit('notification.read', {
        recipientId: userId,
        workspaceId: existing.workspaceId,
        notificationId,
        unreadCount,
      });
    }
  }

  async markAllRead(workspaceId: string, userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { workspaceId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    this.events.emit('notification.read', {
      recipientId: userId,
      workspaceId,
      unreadCount: 0,
    });

    return { count: result.count };
  }

  async dismiss(userId: string, notificationId: string): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
      select: { id: true, workspaceId: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    const unreadCount = await this.unreadCount(existing.workspaceId, userId);
    this.events.emit('notification.read', {
      recipientId: userId,
      workspaceId: existing.workspaceId,
      notificationId,
      unreadCount,
    });
  }
}

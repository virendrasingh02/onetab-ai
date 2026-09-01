import { Injectable, NotFoundException } from '@nestjs/common';
import { normalisePagination, toPage, type CursorQuery } from '@org/api-common';
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
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.notification.create({
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
      select: { id: true },
    });
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
    const result = await this.prisma.notification.updateMany({
      // `recipientId` in the predicate is the authorization check: you can only
      // mark your own notifications read.
      where: { id: notificationId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      // Either it doesn't exist, isn't theirs, or was already read — a repeat
      // click is fine, a missing row is not.
      const exists = await this.prisma.notification.findFirst({
        where: { id: notificationId, recipientId: userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found.');
    }
  }

  async markAllRead(workspaceId: string, userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { workspaceId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }

  async dismiss(userId: string, notificationId: string): Promise<void> {
    const result = await this.prisma.notification.deleteMany({
      where: { id: notificationId, recipientId: userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found.');
    }
  }
}

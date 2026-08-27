import { Injectable, NotFoundException } from '@nestjs/common';
import { PUBLIC_USER_SELECT } from '@org/api-common';
import { PrismaService } from '@org/database';

export interface NotificationPreferenceInput {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  mentionsOnly?: boolean;
  mutedChannelIds?: string[];
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export interface PushRegistrationInput {
  pushKey: string;
  appId: string;
  deviceDisplayName?: string;
}

/**
 * A feed row as the client receives it.
 *
 * Declared rather than inferred: the Prisma row's `kind` is a generated enum
 * that does not cross the package boundary, and the wire contract is a string
 * either way.
 */
export interface ActivityFeedItem {
  id: string;
  kind: string;
  occurredAt: string;
  /** True when this row named the *calling* user — never anyone else. */
  isMention: boolean;
  /** Pre-rendered one-liner for non-chat rows ("created task WEB-42"). Null
   *  for chat rows, which the client renders from the channel. */
  summary: string | null;
  /** The subject, so the client can deep-link the row. */
  resourceType: string | null;
  resourceId: string | null;
  /** For chat rows: the Matrix event id, so a click can jump to the message
   *  (`c/<slug>?msg=<id>`). Null for non-chat rows. */
  messageEventId: string | null;
  channel: { id: string; name: string; slug: string } | null;
  user: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- preferences ----------------------------------------------------------

  /**
   * The caller's preferences for one workspace.
   *
   * Defaults are returned rather than created on read: a user who never opened
   * the settings screen should not accumulate rows, and the schema defaults are
   * already the intended behaviour.
   */
  async getPreferences(workspaceId: string, userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    return (
      existing ?? {
        id: null,
        userId,
        workspaceId,
        pushEnabled: true,
        emailEnabled: false,
        mentionsOnly: false,
        mutedChannelIds: [] as string[],
        quietHoursStart: null,
        quietHoursEnd: null,
      }
    );
  }

  async updatePreferences(
    workspaceId: string,
    userId: string,
    input: NotificationPreferenceInput,
  ) {
    // Muting a channel from another workspace would be meaningless, and lets a
    // caller probe for ids that are not theirs.
    if (input.mutedChannelIds?.length) {
      const valid = await this.prisma.channel.findMany({
        where: { id: { in: input.mutedChannelIds }, workspaceId },
        select: { id: true },
      });
      input = { ...input, mutedChannelIds: valid.map((row) => row.id) };
    }

    const data = {
      ...(input.pushEnabled !== undefined
        ? { pushEnabled: input.pushEnabled }
        : {}),
      ...(input.emailEnabled !== undefined
        ? { emailEnabled: input.emailEnabled }
        : {}),
      ...(input.mentionsOnly !== undefined
        ? { mentionsOnly: input.mentionsOnly }
        : {}),
      ...(input.mutedChannelIds !== undefined
        ? { mutedChannelIds: input.mutedChannelIds }
        : {}),
      ...(input.quietHoursStart !== undefined
        ? { quietHoursStart: input.quietHoursStart }
        : {}),
      ...(input.quietHoursEnd !== undefined
        ? { quietHoursEnd: input.quietHoursEnd }
        : {}),
    };

    return this.prisma.notificationPreference.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      create: { userId, workspaceId, ...data },
      update: data,
    });
  }

  // --- push registrations ---------------------------------------------------

  /** The caller's own devices. Never anyone else's. */
  async listDevices(userId: string) {
    return this.prisma.pushRegistration.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        appId: true,
        deviceDisplayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registers a device for push.
   *
   * `pushKey` is globally unique: the same browser re-registering must move the
   * key to the current user rather than collide, or signing in on a shared
   * device would silently fail to deliver.
   */
  async registerDevice(userId: string, input: PushRegistrationInput) {
    const row = await this.prisma.pushRegistration.upsert({
      where: { pushKey: input.pushKey },
      create: {
        userId,
        pushKey: input.pushKey,
        appId: input.appId,
        deviceDisplayName: input.deviceDisplayName,
      },
      update: {
        userId,
        appId: input.appId,
        deviceDisplayName: input.deviceDisplayName,
        revokedAt: null,
      },
    });

    // The key itself is a delivery credential and never goes back over the wire.
    return {
      id: row.id,
      appId: row.appId,
      deviceDisplayName: row.deviceDisplayName,
      createdAt: row.createdAt,
    };
  }

  async revokeDevice(userId: string, registrationId: string): Promise<void> {
    const row = await this.prisma.pushRegistration.findFirst({
      where: { id: registrationId, userId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Device not found.');

    await this.prisma.pushRegistration.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
  }

  // --- activity feed --------------------------------------------------------

  /**
   * The workspace's recent activity — what the Inbox lists.
   *
   * Muted channels are dropped here rather than in the client so a muted
   * channel cannot be inferred from what the API returned.
   */
  async feed(
    workspaceId: string,
    userId: string,
    take = 50,
  ): Promise<ActivityFeedItem[]> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { mutedChannelIds: true },
    });
    const muted = preference?.mutedChannelIds ?? [];

    const rows = await this.prisma.recentActivity.findMany({
      where: {
        workspaceId,
        ...(muted.length ? { NOT: { channelId: { in: muted } } } : {}),
        // A private channel's activity — its name, who is talking and how
        // often — is only for its members. Without this predicate the Inbox
        // returned every workspace row filtered only by the caller's *muted*
        // list, leaking private channels to non-members (audit S2).
        OR: [
          { channelId: null },
          { channel: { visibility: 'PUBLIC' } },
          { channel: { members: { some: { userId } } } },
        ],
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        channel: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take,
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      occurredAt: row.occurredAt.toISOString(),
      /*
       * Resolved per caller rather than shipped as a list: who else a message
       * named is not this user's business, and the client only ever needs the
       * boolean to pick a dot colour.
       */
      isMention: row.mentionedUserIds.includes(userId),
      summary: row.summary,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      messageEventId: row.matrixEventId ?? null,
      channel: row.channel,
      user: row.user
        ? {
            id: row.user.id,
            name: row.user.name,
            displayName: row.user.displayName,
            avatarUrl: row.user.avatarUrl,
          }
        : null,
    }));
  }
}

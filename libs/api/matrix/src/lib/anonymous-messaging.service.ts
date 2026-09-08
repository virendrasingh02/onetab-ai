import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  ANON_DISPLAY_NAME,
  ROLE_PERMISSIONS,
  WorkspacePermission,
  type AnonymousModerationEventView,
  type AnonymousModerationRow,
  type AnonymousRevealResult,
  type ChannelAnonymousSettingsView,
  type WorkspaceRole,
} from '@org/types';
import type {
  PostAnonymousMessageInput,
  UpdateChannelAnonymousSettingsInput,
} from '@org/validation';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixBotMessagingService } from './matrix-bot-messaging.service.js';

/**
 * Anonymous messaging (brief §2).
 *
 * The security-critical piece: human messages normally go browser → Synapse
 * with the sender's Matrix id baked in, so a genuinely anonymous post has to go
 * through the server, which posts it into the room as a shared "Anonymous
 * Participant" identity (`@anon-<channelId>`) and records the real author in
 * `AnonymousMessage`. That row is only ever read through
 * {@link revealAuthor} / {@link listAudit}, both `MODERATE_ANONYMOUS`-gated,
 * and every reveal/removal writes an append-only `AnonymousModerationEvent`.
 */
@Injectable()
export class AnonymousMessagingService {
  private readonly logger = new Logger(AnonymousMessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly bot: MatrixBotMessagingService,
  ) {}

  private moderates(role: WorkspaceRole): boolean {
    return ROLE_PERMISSIONS[role].includes(
      WorkspacePermission.MODERATE_ANONYMOUS,
    );
  }

  private async assertChannel(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { id: true, matrixRoomId: true },
    });
    if (!channel) throw new NotFoundException('Channel not found.');
    return channel;
  }

  private async loadSetting(workspaceId: string, channelId: string) {
    return (
      (await this.prisma.channelAnonymousSetting.findUnique({
        where: { channelId },
      })) ?? {
        id: '',
        channelId,
        workspaceId,
        isEnabled: false,
        allowedRoles: [] as WorkspaceRole[],
        allowReplies: true,
        matrixUserId: null as string | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  async getSettings(
    workspaceId: string,
    channelId: string,
    userId: string,
    callerRole: WorkspaceRole,
  ): Promise<ChannelAnonymousSettingsView> {
    await this.assertChannel(workspaceId, channelId);
    const setting = await this.loadSetting(workspaceId, channelId);
    const isMember = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { id: true },
    });

    const roleAllowed =
      setting.allowedRoles.length === 0 ||
      setting.allowedRoles.includes(callerRole);

    return {
      channelId,
      isEnabled: setting.isEnabled,
      allowedRoles: setting.allowedRoles,
      allowReplies: setting.allowReplies,
      canPostAnonymously:
        setting.isEnabled && !!isMember && roleAllowed,
      canModerate: this.moderates(callerRole),
    };
  }

  async updateSettings(
    workspaceId: string,
    channelId: string,
    input: UpdateChannelAnonymousSettingsInput,
  ): Promise<ChannelAnonymousSettingsView> {
    await this.assertChannel(workspaceId, channelId);

    await this.prisma.channelAnonymousSetting.upsert({
      where: { channelId },
      create: {
        channelId,
        workspaceId,
        isEnabled: input.isEnabled ?? false,
        allowedRoles: input.allowedRoles ?? [],
        allowReplies: input.allowReplies ?? true,
      },
      update: {
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.allowedRoles !== undefined
          ? { allowedRoles: input.allowedRoles }
          : {}),
        ...(input.allowReplies !== undefined
          ? { allowReplies: input.allowReplies }
          : {}),
      },
    });

    // Callers that hit this route hold MANAGE_SETTINGS ⇒ they also moderate.
    return this.getSettings(workspaceId, channelId, '', 'ADMIN' as WorkspaceRole);
  }

  async postMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    callerRole: WorkspaceRole,
    input: PostAnonymousMessageInput,
  ): Promise<{ eventId: string }> {
    const channel = await this.assertChannel(workspaceId, channelId);
    const setting = await this.loadSetting(workspaceId, channelId);

    if (!setting.isEnabled) {
      throw new ForbiddenException(
        'Anonymous messages are not enabled in this channel.',
      );
    }
    const isMember = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { id: true },
    });
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this channel.');
    }
    if (
      setting.allowedRoles.length > 0 &&
      !setting.allowedRoles.includes(callerRole)
    ) {
      throw new ForbiddenException(
        'Your role may not post anonymously here.',
      );
    }
    if (input.threadRootId && !setting.allowReplies) {
      throw new ForbiddenException(
        'Anonymous replies are turned off in this channel.',
      );
    }
    if (!channel.matrixRoomId) {
      throw new ConflictException(
        'Open the channel conversation once before posting anonymously.',
      );
    }
    if (!this.admin.isEnabled) {
      throw new ConflictException('Chat is not configured.');
    }

    // Provision + join the shared anonymous identity, lazily.
    let anonMatrixId = setting.matrixUserId;
    if (!anonMatrixId) {
      const { matrixUserId } = await this.admin.provisionUser({
        userId: `anon-${channelId}`,
        displayName: ANON_DISPLAY_NAME,
      });
      anonMatrixId = matrixUserId;
      await this.prisma.channelAnonymousSetting.update({
        where: { channelId },
        data: { matrixUserId: anonMatrixId },
      });
    }
    await this.admin
      .joinRoomAs(anonMatrixId, channel.matrixRoomId)
      .catch((error) =>
        this.logger.warn(`anon join failed: ${String(error)}`),
      );

    const eventId = await this.bot.sendText(
      channel.matrixRoomId,
      anonMatrixId,
      input.text,
      input.threadRootId
        ? { threadRootId: input.threadRootId, replyToId: input.threadRootId }
        : {},
    );

    await this.prisma.anonymousMessage.create({
      data: {
        channelId,
        workspaceId,
        matrixEventId: eventId,
        authorId: userId,
        isReply: !!input.threadRootId,
      },
    });

    return { eventId };
  }

  async report(
    workspaceId: string,
    channelId: string,
    reporterId: string,
    matrixEventId: string,
    reason: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);
    const message = await this.prisma.anonymousMessage.findFirst({
      where: { matrixEventId, channelId, workspaceId },
      select: { id: true },
    });
    if (!message) throw new NotFoundException('Anonymous message not found.');

    await this.prisma.anonymousModerationEvent.create({
      data: {
        workspaceId,
        anonymousMessageId: message.id,
        actorId: reporterId,
        kind: 'REPORT',
        reason: reason.slice(0, 500),
      },
    });
  }

  async listModeration(
    workspaceId: string,
    channelId: string,
  ): Promise<AnonymousModerationRow[]> {
    await this.assertChannel(workspaceId, channelId);
    const rows = await this.prisma.anonymousMessage.findMany({
      where: { channelId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        matrixEventId: true,
        isReply: true,
        createdAt: true,
        removedAt: true,
        events: {
          where: { kind: 'REPORT' },
          orderBy: { createdAt: 'desc' },
          select: { reason: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      matrixEventId: row.matrixEventId,
      isReply: row.isReply,
      createdAt: row.createdAt.toISOString(),
      removedAt: row.removedAt?.toISOString() ?? null,
      reportCount: row.events.length,
      lastReportReason: row.events[0]?.reason ?? null,
    }));
  }

  async revealAuthor(
    workspaceId: string,
    channelId: string,
    actorId: string,
    anonymousMessageId: string,
  ): Promise<AnonymousRevealResult> {
    await this.assertChannel(workspaceId, channelId);
    const message = await this.prisma.anonymousMessage.findFirst({
      where: { id: anonymousMessageId, channelId, workspaceId },
      select: { id: true, author: { select: PUBLIC_USER_SELECT } },
    });
    if (!message) throw new NotFoundException('Anonymous message not found.');

    await this.prisma.anonymousModerationEvent.create({
      data: {
        workspaceId,
        anonymousMessageId: message.id,
        actorId,
        kind: 'REVEAL_AUTHOR',
      },
    });

    return {
      anonymousMessageId: message.id,
      author: toPublicUser(message.author),
    };
  }

  async removeMessage(
    workspaceId: string,
    channelId: string,
    actorId: string,
    anonymousMessageId: string,
    reason?: string,
  ): Promise<void> {
    const channel = await this.assertChannel(workspaceId, channelId);
    const message = await this.prisma.anonymousMessage.findFirst({
      where: { id: anonymousMessageId, channelId, workspaceId },
      select: { id: true, matrixEventId: true, removedAt: true },
    });
    if (!message) throw new NotFoundException('Anonymous message not found.');

    const setting = await this.loadSetting(workspaceId, channelId);
    if (channel.matrixRoomId && setting.matrixUserId && this.admin.isEnabled) {
      await this.admin
        .redactEventAs(
          channel.matrixRoomId,
          setting.matrixUserId,
          message.matrixEventId,
          reason,
        )
        .catch((error) =>
          this.logger.warn(`anon redact failed: ${String(error)}`),
        );
    }

    await this.prisma.anonymousMessage.update({
      where: { id: message.id },
      data: { removedAt: new Date(), removedById: actorId },
    });
    await this.prisma.anonymousModerationEvent.create({
      data: {
        workspaceId,
        anonymousMessageId: message.id,
        actorId,
        kind: 'REMOVE_MESSAGE',
        reason: reason?.slice(0, 500) ?? null,
      },
    });
  }

  async listAudit(
    workspaceId: string,
    channelId: string,
  ): Promise<AnonymousModerationEventView[]> {
    await this.assertChannel(workspaceId, channelId);
    const rows = await this.prisma.anonymousModerationEvent.findMany({
      where: { workspaceId, anonymousMessage: { channelId } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        kind: true,
        anonymousMessageId: true,
        reason: true,
        createdAt: true,
        actor: { select: PUBLIC_USER_SELECT },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      actor: toPublicUser(row.actor),
      anonymousMessageId: row.anonymousMessageId,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

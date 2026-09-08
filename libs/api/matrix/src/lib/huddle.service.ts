import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { HuddleConfig, HuddleView } from '@org/types';
import type { StartHuddleInput } from '@org/validation';
import { MatrixAuthService } from './matrix-auth.service.js';
import { MatrixAdminService } from './matrix-admin.service.js';

const huddleInclude = {
  startedBy: { select: PUBLIC_USER_SELECT },
  participants: {
    orderBy: { joinedAt: 'asc' as const },
    include: { user: { select: PUBLIC_USER_SELECT } },
  },
};

/**
 * Huddles (brief §6 / §7).
 *
 * Our side owns the huddle record, its participants and the "you joined at"
 * marker; the media surface is Element Call (MatrixRTC) embedded client-side in
 * the huddle's Matrix room when `ELEMENT_CALL_URL` is set, otherwise the huddle
 * is presence-only. That room is the channel's (or the DM's) room — so a late
 * joiner's conversation history *is* that room, and authorization is exactly
 * the room's own membership.
 */
@Injectable()
export class HuddleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly admin: MatrixAdminService,
    private readonly auth: MatrixAuthService,
    private readonly events: EventEmitter2,
  ) {}

  config(): HuddleConfig {
    return {
      elementCallUrl:
        this.configService.get<string>('ELEMENT_CALL_URL') ?? null,
    };
  }

  private toView(
    huddle: {
      id: string;
      channelId: string | null;
      matrixRoomId: string;
      status: string;
      startedAt: Date;
      endedAt: Date | null;
      startedBy: Parameters<typeof toPublicUser>[0];
      participants: {
        joinedAt: Date;
        leftAt: Date | null;
        userId: string;
        user: Parameters<typeof toPublicUser>[0];
      }[];
    },
    viewerId: string,
  ): HuddleView {
    return {
      id: huddle.id,
      channelId: huddle.channelId,
      matrixRoomId: huddle.matrixRoomId,
      status: huddle.status as HuddleView['status'],
      startedAt: huddle.startedAt.toISOString(),
      endedAt: huddle.endedAt?.toISOString() ?? null,
      startedBy: toPublicUser(huddle.startedBy),
      participants: huddle.participants.map((p) => ({
        user: toPublicUser(p.user),
        joinedAt: p.joinedAt.toISOString(),
        leftAt: p.leftAt?.toISOString() ?? null,
      })),
      viewerJoinedAt:
        huddle.participants
          .find((p) => p.userId === viewerId && !p.leftAt)
          ?.joinedAt.toISOString() ?? null,
    };
  }

  /** Resolves + membership-checks the Matrix room for a huddle request. */
  private async resolveRoom(
    workspaceId: string,
    userId: string,
    input: { channelId?: string; matrixRoomId?: string },
  ): Promise<{ matrixRoomId: string; channelId: string | null }> {
    if (input.channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: input.channelId, workspaceId },
        select: { matrixRoomId: true },
      });
      if (!channel) throw new NotFoundException('Channel not found.');
      const member = await this.prisma.channelMember.findUnique({
        where: {
          channelId_userId: { channelId: input.channelId, userId },
        },
        select: { id: true },
      });
      if (!member) {
        throw new ForbiddenException('Join the channel to start a huddle.');
      }
      if (!channel.matrixRoomId) {
        throw new ConflictException(
          'Open the channel conversation once before starting a huddle.',
        );
      }
      return { matrixRoomId: channel.matrixRoomId, channelId: input.channelId };
    }

    // DM / group-DM: verify the caller is actually in that Matrix room.
    const roomId = input.matrixRoomId as string;
    if (this.admin.isEnabled) {
      const matrixId = await this.auth.ensureIdentity(userId);
      const members = await this.admin
        .getRoomMembers(roomId)
        .catch((): string[] => []);
      if (matrixId && members.length > 0 && !members.includes(matrixId)) {
        throw new ForbiddenException('You are not in that conversation.');
      }
    }
    return { matrixRoomId: roomId, channelId: null };
  }

  private emit(
    workspaceId: string,
    actorId: string,
    huddle: { id: string; matrixRoomId: string; channelId: string | null },
    action: 'started' | 'joined' | 'left' | 'ended',
  ) {
    this.events.emit(AppEvent.HuddleUpdated, {
      workspaceId,
      actorId,
      huddleId: huddle.id,
      matrixRoomId: huddle.matrixRoomId,
      channelId: huddle.channelId,
      action,
    });
  }

  async start(
    workspaceId: string,
    userId: string,
    input: StartHuddleInput,
  ): Promise<HuddleView> {
    const { matrixRoomId, channelId } = await this.resolveRoom(
      workspaceId,
      userId,
      input,
    );

    const existing = await this.prisma.huddle.findFirst({
      where: { matrixRoomId, status: 'ACTIVE' },
      include: huddleInclude,
    });

    if (existing) {
      await this.prisma.huddleParticipant.upsert({
        where: { huddleId_userId: { huddleId: existing.id, userId } },
        create: { huddleId: existing.id, userId },
        update: { leftAt: null },
      });
      const refreshed = await this.prisma.huddle.findUniqueOrThrow({
        where: { id: existing.id },
        include: huddleInclude,
      });
      this.emit(workspaceId, userId, refreshed, 'joined');
      return this.toView(refreshed, userId);
    }

    const created = await this.prisma.huddle.create({
      data: {
        workspaceId,
        channelId,
        matrixRoomId,
        startedById: userId,
        participants: { create: { userId } },
      },
      include: huddleInclude,
    });
    this.emit(workspaceId, userId, created, 'started');
    return this.toView(created, userId);
  }

  async forRoom(
    workspaceId: string,
    userId: string,
    matrixRoomId: string,
  ): Promise<HuddleView | null> {
    const huddle = await this.prisma.huddle.findFirst({
      where: { matrixRoomId, workspaceId, status: 'ACTIVE' },
      include: huddleInclude,
    });
    return huddle ? this.toView(huddle, userId) : null;
  }

  async join(
    workspaceId: string,
    userId: string,
    huddleId: string,
  ): Promise<HuddleView> {
    const huddle = await this.assertHuddle(workspaceId, huddleId);
    if (huddle.status !== 'ACTIVE') {
      throw new ConflictException('This huddle has ended.');
    }
    await this.prisma.huddleParticipant.upsert({
      where: { huddleId_userId: { huddleId, userId } },
      create: { huddleId, userId },
      update: { leftAt: null, joinedAt: new Date() },
    });
    const refreshed = await this.prisma.huddle.findUniqueOrThrow({
      where: { id: huddleId },
      include: huddleInclude,
    });
    this.emit(workspaceId, userId, refreshed, 'joined');
    return this.toView(refreshed, userId);
  }

  async leave(
    workspaceId: string,
    userId: string,
    huddleId: string,
  ): Promise<void> {
    const huddle = await this.assertHuddle(workspaceId, huddleId);
    await this.prisma.huddleParticipant.updateMany({
      where: { huddleId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    const remaining = await this.prisma.huddleParticipant.count({
      where: { huddleId, leftAt: null },
    });
    if (remaining === 0 && huddle.status === 'ACTIVE') {
      await this.prisma.huddle.update({
        where: { id: huddleId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      this.emit(workspaceId, userId, huddle, 'ended');
    } else {
      this.emit(workspaceId, userId, huddle, 'left');
    }
  }

  async end(
    workspaceId: string,
    userId: string,
    huddleId: string,
  ): Promise<void> {
    const huddle = await this.assertHuddle(workspaceId, huddleId);
    if (huddle.startedById !== userId) {
      // A channel admin may also end it.
      const isChannelAdmin =
        huddle.channelId &&
        (await this.prisma.channelMember.findFirst({
          where: { channelId: huddle.channelId, userId, role: 'ADMIN' },
          select: { id: true },
        }));
      if (!isChannelAdmin) {
        throw new ForbiddenException('Only the host can end this huddle.');
      }
    }
    if (huddle.status === 'ACTIVE') {
      await this.prisma.huddle.update({
        where: { id: huddleId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      await this.prisma.huddleParticipant.updateMany({
        where: { huddleId, leftAt: null },
        data: { leftAt: new Date() },
      });
      this.emit(workspaceId, userId, huddle, 'ended');
    }
  }

  private async assertHuddle(workspaceId: string, huddleId: string) {
    const huddle = await this.prisma.huddle.findFirst({
      where: { id: huddleId, workspaceId },
      select: {
        id: true,
        status: true,
        startedById: true,
        channelId: true,
        matrixRoomId: true,
      },
    });
    if (!huddle) throw new NotFoundException('Huddle not found.');
    return huddle;
  }
}

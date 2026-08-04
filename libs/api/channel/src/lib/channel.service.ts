import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PUBLIC_USER_SELECT,
  toChannel,
  toChannelMember,
  toChannelPin,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  ApiErrorCode,
  ChannelRole,
  ChannelVisibility,
  WorkspaceRole,
  hasWorkspaceRole,
  type Channel,
  type ChannelMember,
  type ChannelPin,
  type ChannelSummary,
} from '@org/types';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  CreateChannelInput,
  CreatePinInput,
  UpdateChannelInput,
} from '@org/validation';

@Injectable()
export class ChannelService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Channels visible to the caller: every public channel in the workspace plus
   * the private ones they belong to.
   */
  async list(
    workspaceId: string,
    userId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<ChannelSummary[]> {
    const channels = await this.prisma.channel.findMany({
      where: {
        workspaceId,
        ...(options.includeArchived ? {} : { isArchived: false }),
        OR: [
          { visibility: ChannelVisibility.PUBLIC },
          { members: { some: { userId } } },
        ],
      },
      orderBy: [{ name: 'asc' }],
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: {
            role: true,
            isFavorite: true,
            isMuted: true,
            lastReadAt: true,
          },
        },
      },
    });

    return channels.map((channel) => ({
      ...toChannel(channel),
      memberCount: channel._count.members,
      membership: channel.members[0]
        ? {
            role: channel.members[0].role as ChannelRole,
            isFavorite: channel.members[0].isFavorite,
            isMuted: channel.members[0].isMuted,
            lastReadAt: channel.members[0].lastReadAt?.toISOString() ?? null,
          }
        : null,
    }));
  }

  async findBySlug(
    workspaceId: string,
    slug: string,
    userId: string,
  ): Promise<ChannelSummary> {
    const channel = await this.prisma.channel.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: {
            role: true,
            isFavorite: true,
            isMuted: true,
            lastReadAt: true,
          },
        },
      },
    });

    if (!channel) throw new NotFoundException('Channel not found.');

    // A private channel is invisible to non-members.
    if (
      channel.visibility === ChannelVisibility.PRIVATE &&
      channel.members.length === 0
    ) {
      throw new NotFoundException('Channel not found.');
    }

    return {
      ...toChannel(channel),
      memberCount: channel._count.members,
      membership: channel.members[0]
        ? {
            role: channel.members[0].role as ChannelRole,
            isFavorite: channel.members[0].isFavorite,
            isMuted: channel.members[0].isMuted,
            lastReadAt: channel.members[0].lastReadAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateChannelInput,
  ): Promise<Channel> {
    const existing = await this.prisma.channel.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: input.name } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `A channel named #${input.name} already exists.`,
        errors: { name: [`A channel named #${input.name} already exists.`] },
      });
    }

    // Seed members must already belong to the workspace.
    const seedIds = input.memberIds?.length
      ? (
          await this.prisma.workspaceMember.findMany({
            where: { workspaceId, userId: { in: input.memberIds } },
            select: { userId: true },
          })
        ).map((row) => row.userId)
      : [];

    const memberIds = Array.from(new Set([userId, ...seedIds]));

    const channel = await this.prisma.channel.create({
      data: {
        workspaceId,
        name: input.name,
        slug: input.name,
        topic: input.topic || null,
        description: input.description || null,
        visibility: input.visibility,
        createdById: userId,
        members: {
          create: memberIds.map((id) => ({
            userId: id,
            role: id === userId ? ChannelRole.ADMIN : ChannelRole.MEMBER,
          })),
        },
      },
    });

    return toChannel(channel);
  }

  async update(
    workspaceId: string,
    channelId: string,
    userId: string,
    input: UpdateChannelInput,
  ): Promise<Channel> {
    await this.assertCanManage(workspaceId, channelId, userId);

    const channel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(input.name !== undefined ? { name: input.name, slug: input.name } : {}),
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      },
    });
    return toChannel(channel);
  }

  async setArchived(
    workspaceId: string,
    channelId: string,
    userId: string,
    archived: boolean,
  ): Promise<Channel> {
    await this.assertCanManage(workspaceId, channelId, userId);

    const channel = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { slug: true },
    });
    if (channel.slug === 'general' && archived) {
      throw new ConflictException('The #general channel cannot be archived.');
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
      },
    });
    return toChannel(updated);
  }

  /**
   * Converts a public channel to private.
   *
   * The reverse is deliberately unsupported: making a private channel public
   * would retroactively expose its history to people who never had access.
   */
  async makePrivate(
    workspaceId: string,
    channelId: string,
    userId: string,
  ): Promise<Channel> {
    await this.assertCanManage(workspaceId, channelId, userId);

    const channel = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { visibility: true },
    });
    if (channel.visibility === ChannelVisibility.PRIVATE) {
      throw new ConflictException('This channel is already private.');
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: { visibility: ChannelVisibility.PRIVATE },
    });
    return toChannel(updated);
  }

  // --- membership ---------------------------------------------------------

  async listMembers(channelId: string): Promise<ChannelMember[]> {
    const members = await this.prisma.channelMember.findMany({
      where: { channelId },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: PUBLIC_USER_SELECT } },
    });
    return members.map(toChannelMember);
  }

  async addMembers(
    workspaceId: string,
    channelId: string,
    userId: string,
    input: AddChannelMembersInput,
  ): Promise<ChannelMember[]> {
    await this.assertCanManage(workspaceId, channelId, userId);

    const eligible = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: input.userIds } },
      select: { userId: true },
    });

    await this.prisma.channelMember.createMany({
      data: eligible.map((row) => ({
        channelId,
        userId: row.userId,
        role: input.role,
      })),
      // Re-adding an existing member is a no-op rather than an error.
      skipDuplicates: true,
    });

    return this.listMembers(channelId);
  }

  async removeMember(
    workspaceId: string,
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorId !== targetUserId) {
      await this.assertCanManage(workspaceId, channelId, actorId);
    }

    await this.prisma.channelMember.deleteMany({
      where: { channelId, userId: targetUserId },
    });
  }

  async join(channelId: string, userId: string): Promise<void> {
    const channel = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { visibility: true, isArchived: true },
    });

    if (channel.visibility === ChannelVisibility.PRIVATE) {
      throw new ForbiddenException('This channel is invite-only.');
    }
    if (channel.isArchived) {
      throw new ConflictException('This channel is archived.');
    }

    await this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId, role: ChannelRole.MEMBER },
      update: {},
    });
  }

  /** Per-user star / mute. Never affects other members. */
  async setPreferences(
    channelId: string,
    userId: string,
    input: ChannelPreferencesInput,
  ): Promise<void> {
    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('You are not a member of this channel.');
    }

    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: {
        ...(input.isFavorite !== undefined
          ? { isFavorite: input.isFavorite }
          : {}),
        ...(input.isMuted !== undefined ? { isMuted: input.isMuted } : {}),
      },
    });
  }

  async markRead(channelId: string, userId: string): Promise<void> {
    await this.prisma.channelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  // --- pins ---------------------------------------------------------------

  async listPins(channelId: string): Promise<ChannelPin[]> {
    const pins = await this.prisma.channelPin.findMany({
      where: { channelId },
      orderBy: { pinnedAt: 'desc' },
    });
    return pins.map(toChannelPin);
  }

  async createPin(
    channelId: string,
    userId: string,
    input: CreatePinInput,
  ): Promise<ChannelPin> {
    const pin = await this.prisma.channelPin.create({
      data: {
        channelId,
        title: input.title,
        url: input.url || null,
        note: input.note || null,
        pinnedById: userId,
      },
    });
    return toChannelPin(pin);
  }

  async removePin(channelId: string, pinId: string): Promise<void> {
    await this.prisma.channelPin.deleteMany({ where: { id: pinId, channelId } });
  }

  /** Files shared in a channel — the channel "Files"/"Media" tabs. */
  async listUploads(channelId: string) {
    return this.prisma.upload.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });
  }

  /**
   * A channel may be managed by its own channel-admins, or by anyone with
   * workspace ADMIN and above.
   */
  private async assertCanManage(
    workspaceId: string,
    channelId: string,
    userId: string,
  ): Promise<void> {
    const [channelMembership, workspaceMembership] = await Promise.all([
      this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { role: true },
      }),
      this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      }),
    ]);

    const isChannelAdmin = channelMembership?.role === ChannelRole.ADMIN;
    const isWorkspaceAdmin =
      !!workspaceMembership &&
      hasWorkspaceRole(
        workspaceMembership.role as WorkspaceRole,
        WorkspaceRole.ADMIN,
      );

    if (!isChannelAdmin && !isWorkspaceAdmin) {
      throw new ForbiddenException(
        'You do not have permission to manage this channel.',
      );
    }
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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

    this.events.emit(AppEvent.ChannelCreated, {
      workspaceId,
      actorId: userId,
      channelId: channel.id,
      name: channel.name,
      slug: channel.slug,
      visibility: channel.visibility,
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

  async listMembers(
    workspaceId: string,
    channelId: string,
  ): Promise<ChannelMember[]> {
    await this.assertChannel(workspaceId, channelId);

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

    return this.listMembers(workspaceId, channelId);
  }

  async removeMember(
    workspaceId: string,
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorId !== targetUserId) {
      await this.assertCanManage(workspaceId, channelId, actorId);
    } else {
      // Leaving needs no role, but still needs the channel to be one of this
      // workspace's — otherwise the route accepts any channel id in the world.
      await this.assertChannel(workspaceId, channelId);
    }

    await this.prisma.channelMember.deleteMany({
      where: { channelId, userId: targetUserId },
    });
  }

  async join(
    workspaceId: string,
    channelId: string,
    userId: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);

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
    workspaceId: string,
    channelId: string,
    userId: string,
    input: ChannelPreferencesInput,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);

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

  async markRead(
    workspaceId: string,
    channelId: string,
    userId: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);

    await this.prisma.channelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  // --- pins ---------------------------------------------------------------

  async listPins(
    workspaceId: string,
    channelId: string,
  ): Promise<ChannelPin[]> {
    await this.assertChannel(workspaceId, channelId);

    const pins = await this.prisma.channelPin.findMany({
      where: { channelId },
      orderBy: { pinnedAt: 'desc' },
    });
    return pins.map(toChannelPin);
  }

  async createPin(
    workspaceId: string,
    channelId: string,
    userId: string,
    input: CreatePinInput,
  ): Promise<ChannelPin> {
    await this.assertChannel(workspaceId, channelId);

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

  async removePin(
    workspaceId: string,
    channelId: string,
    pinId: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);
    await this.prisma.channelPin.deleteMany({ where: { id: pinId, channelId } });
  }

  /** Files shared in a channel — the channel "Files"/"Media" tabs. */
  async listUploads(workspaceId: string, channelId: string) {
    await this.assertChannel(workspaceId, channelId);

    return this.prisma.upload.findMany({
      // Both, not just the channel: an upload row carries its own workspace,
      // so scoping on it too keeps a mis-filed row from crossing the boundary.
      where: { channelId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });
  }

  /**
   * Binds a channel id from the URL to the workspace the guard resolved.
   *
   * `WorkspaceRoleGuard` only proves the caller belongs to the workspace named
   * in the path — it says nothing about the channel. Without this check a
   * member could pass *their own* workspace id together with a channel id from
   * somebody else's and the guard would wave it through, so every route that
   * accepts a `:channelId` has to bind the two together here.
   *
   * Reports a mismatch as 404, matching how a non-member is told a workspace
   * does not exist: confirming that a channel id is real is itself a
   * disclosure.
   */
  private async assertChannel(
    workspaceId: string,
    channelId: string,
  ): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { id: true },
    });
    if (!channel) throw new NotFoundException('Channel not found.');
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
    // Before any role is weighed: a workspace admin is an admin of *their*
    // channels, and without this the role check would happily authorise them
    // against a channel belonging to another workspace entirely.
    await this.assertChannel(workspaceId, channelId);

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

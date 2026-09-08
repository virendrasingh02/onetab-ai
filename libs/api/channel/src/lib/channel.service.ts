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
  toUpload,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  ApiErrorCode,
  ChannelMembershipType,
  ChannelRole,
  ChannelVisibility,
  WorkspaceRole,
  canPostInChannel,
  clampTempMembershipHours,
  extendedTemporaryExpiry,
  hasWorkspaceRole,
  temporaryExpiryFrom,
  type Channel,
  type ChannelMember,
  type ChannelPin,
  type ChannelSummary,
  type Upload,
} from '@org/types';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  CreateChannelInput,
  CreatePinInput,
  ExtendMembershipInput,
  JoinChannelInput,
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
    const [channels, workspaceRole] = await Promise.all([
      this.prisma.channel.findMany({
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
              membershipType: true,
              expiresAt: true,
            },
          },
        },
      }),
      this.callerWorkspaceRole(workspaceId, userId),
    ]);

    return channels.map((channel) =>
      this.toSummary(channel, userId, workspaceRole),
    );
  }

  async findBySlug(
    workspaceId: string,
    slug: string,
    userId: string,
  ): Promise<ChannelSummary> {
    const [channel, workspaceRole] = await Promise.all([
      this.prisma.channel.findUnique({
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
              membershipType: true,
              expiresAt: true,
            },
          },
        },
      }),
      this.callerWorkspaceRole(workspaceId, userId),
    ]);

    if (!channel) throw new NotFoundException('Channel not found.');

    // A private channel is invisible to non-members.
    if (
      channel.visibility === ChannelVisibility.PRIVATE &&
      channel.members.length === 0
    ) {
      throw new NotFoundException('Channel not found.');
    }

    return this.toSummary(channel, userId, workspaceRole);
  }

  private async callerWorkspaceRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | null> {
    const row = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    return (row?.role as WorkspaceRole | undefined) ?? null;
  }

  /** Folds membership state and the derived `canPost` flag onto a channel row. */
  private toSummary(
    channel: Parameters<typeof toChannel>[0] & {
      _count: { members: number };
      members: {
        role: string;
        isFavorite: boolean;
        isMuted: boolean;
        lastReadAt: Date | null;
        membershipType: string;
        expiresAt: Date | null;
      }[];
    },
    userId: string,
    workspaceRole: WorkspaceRole | null,
  ): ChannelSummary {
    const base = toChannel(channel);
    const membershipRow = channel.members[0];
    const channelRole = (membershipRow?.role as ChannelRole | undefined) ?? null;

    return {
      ...base,
      memberCount: channel._count.members,
      membership: membershipRow
        ? {
            role: membershipRow.role as ChannelRole,
            isFavorite: membershipRow.isFavorite,
            isMuted: membershipRow.isMuted,
            lastReadAt: membershipRow.lastReadAt?.toISOString() ?? null,
            membershipType:
              membershipRow.membershipType as ChannelMembershipType,
            expiresAt: membershipRow.expiresAt?.toISOString() ?? null,
          }
        : null,
      canPost: canPostInChannel(
        {
          mode: base.mode,
          createdById: base.createdById,
          announcementPosterIds: base.announcementPosterIds,
        },
        { userId, channelRole, workspaceRole },
      ),
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

    const postingChanged =
      input.mode !== undefined ||
      input.allowReactions !== undefined ||
      input.allowReplies !== undefined ||
      input.allowFileUploads !== undefined ||
      input.announcementPosterIds !== undefined;

    // Named posters must be members of this workspace, so a stale or foreign id
    // can never be handed a posting power level in the room.
    let posterIds: string[] | undefined;
    if (input.announcementPosterIds !== undefined) {
      const eligible = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, userId: { in: input.announcementPosterIds } },
        select: { userId: true },
      });
      posterIds = eligible.map((row) => row.userId);
    }

    const channel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(input.name !== undefined ? { name: input.name, slug: input.name } : {}),
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.allowReactions !== undefined
          ? { allowReactions: input.allowReactions }
          : {}),
        ...(input.allowReplies !== undefined
          ? { allowReplies: input.allowReplies }
          : {}),
        ...(input.allowFileUploads !== undefined
          ? { allowFileUploads: input.allowFileUploads }
          : {}),
        ...(posterIds !== undefined
          ? { announcementPosterIds: posterIds }
          : {}),
      },
    });

    const result = toChannel(channel);

    this.events.emit(AppEvent.ChannelUpdated, {
      workspaceId,
      actorId: userId,
      channelId,
      name: result.name,
      slug: result.slug,
      ...(postingChanged
        ? {
            posting: {
              mode: result.mode,
              allowReactions: result.allowReactions,
              allowReplies: result.allowReplies,
              allowFileUploads: result.allowFileUploads,
            },
          }
        : {}),
    });

    return result;
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

    // Mirror into the channel's Matrix room. Emitting for every eligible id
    // (not just the genuinely new ones) is safe — the bridge's invite is
    // idempotent — and `createMany` does not report which rows it skipped.
    for (const row of eligible) {
      this.events.emit(AppEvent.ChannelMembershipChanged, {
        workspaceId,
        actorId: userId,
        channelId,
        userId: row.userId,
        action: 'join',
        role: input.role,
      });
    }

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

    this.events.emit(AppEvent.ChannelMembershipChanged, {
      workspaceId,
      actorId,
      channelId,
      userId: targetUserId,
      action: 'leave',
      role: null,
    });
  }

  async join(
    workspaceId: string,
    channelId: string,
    userId: string,
    input: JoinChannelInput = {},
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

    // A positive `durationHours` makes this a temporary membership (brief §8);
    // the sweep removes it once `expiresAt` passes.
    const hours = input.durationHours
      ? clampTempMembershipHours(input.durationHours)
      : null;

    const existing = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { membershipType: true, expiresAt: true },
    });

    if (!existing) {
      await this.prisma.channelMember.create({
        data: {
          channelId,
          userId,
          role: ChannelRole.MEMBER,
          ...(hours
            ? {
                membershipType: ChannelMembershipType.TEMPORARY,
                expiresAt: temporaryExpiryFrom(hours),
              }
            : {}),
        },
      });
    } else if (existing.membershipType === ChannelMembershipType.TEMPORARY) {
      // A temp member who joins again: with a window, guarantee at least that
      // much time from now (never shorten); with the plain button, promote to
      // permanent.
      if (hours) {
        const requested = temporaryExpiryFrom(hours);
        await this.prisma.channelMember.update({
          where: { channelId_userId: { channelId, userId } },
          data: {
            expiresAt:
              existing.expiresAt && existing.expiresAt > requested
                ? existing.expiresAt
                : requested,
          },
        });
      } else {
        await this.prisma.channelMember.update({
          where: { channelId_userId: { channelId, userId } },
          data: {
            membershipType: ChannelMembershipType.PERMANENT,
            expiresAt: null,
          },
        });
      }
    }
    // An existing PERMANENT member: nothing to do — never downgrade access.

    this.events.emit(AppEvent.ChannelMembershipChanged, {
      workspaceId,
      actorId: userId,
      channelId,
      userId,
      action: 'join',
      role: ChannelRole.MEMBER,
    });
  }

  /**
   * Pushes a temporary membership's expiry out by `durationHours`, from
   * whichever is later — now or the current expiry (brief §8).
   */
  async extendMembership(
    workspaceId: string,
    channelId: string,
    userId: string,
    input: ExtendMembershipInput,
  ): Promise<ChannelMember[]> {
    await this.assertChannel(workspaceId, channelId);

    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { membershipType: true, expiresAt: true },
    });
    if (!membership) {
      throw new NotFoundException('You are not a member of this channel.');
    }
    if (membership.membershipType !== ChannelMembershipType.TEMPORARY) {
      throw new ConflictException(
        'This membership is permanent — there is nothing to extend.',
      );
    }

    const hours = clampTempMembershipHours(input.durationHours);
    if (!hours) {
      throw new ConflictException('Enter a valid duration.');
    }

    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { expiresAt: extendedTemporaryExpiry(membership.expiresAt, hours) },
    });

    return this.listMembers(workspaceId, channelId);
  }

  /**
   * Converts the caller's own temporary membership into a permanent one.
   * Allowed for public channels only — a private channel's membership is
   * granted, not self-claimed.
   */
  async convertToPermanent(
    workspaceId: string,
    channelId: string,
    userId: string,
  ): Promise<ChannelMember[]> {
    await this.assertChannel(workspaceId, channelId);

    const [channel, membership] = await Promise.all([
      this.prisma.channel.findUniqueOrThrow({
        where: { id: channelId },
        select: { visibility: true },
      }),
      this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { membershipType: true },
      }),
    ]);

    if (!membership) {
      throw new NotFoundException('You are not a member of this channel.');
    }
    if (membership.membershipType === ChannelMembershipType.PERMANENT) {
      return this.listMembers(workspaceId, channelId);
    }
    if (channel.visibility === ChannelVisibility.PRIVATE) {
      throw new ForbiddenException(
        'A private channel membership cannot be self-converted.',
      );
    }

    await this.prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: {
        membershipType: ChannelMembershipType.PERMANENT,
        expiresAt: null,
      },
    });

    return this.listMembers(workspaceId, channelId);
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
  async listUploads(workspaceId: string, channelId: string): Promise<Upload[]> {
    await this.assertChannel(workspaceId, channelId);

    const rows = await this.prisma.upload.findMany({
      // Both, not just the channel: an upload row carries its own workspace,
      // so scoping on it too keeps a mis-filed row from crossing the boundary.
      where: { channelId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });
    return rows.map((row) => toUpload(row));
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

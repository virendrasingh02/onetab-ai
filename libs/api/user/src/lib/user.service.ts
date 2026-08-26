import { Injectable } from '@nestjs/common';
import { PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { CurrentUser, PublicUser, UserPreferences } from '@org/types';
import type {
  UpdateProfileInput,
  UpdateStatusInput,
  UpdateUserPreferencesInput,
} from '@org/validation';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    return toPublicUser(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<CurrentUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.statusText !== undefined ? { statusText: input.statusText } : {}),
        ...(input.statusEmoji !== undefined ? { statusEmoji: input.statusEmoji } : {}),
        ...(input.statusExpiresAt !== undefined
          ? {
              statusExpiresAt: input.statusExpiresAt
                ? new Date(input.statusExpiresAt)
                : null,
            }
          : {}),
      },
    });

    const isExpired =
      user.statusExpiresAt && user.statusExpiresAt < new Date();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      coverUrl: input.coverUrl !== undefined ? input.coverUrl : ((user as any).coverUrl ?? null),
      title: input.title !== undefined ? input.title : (user as any).title ?? null,
      jobTitle: input.jobTitle !== undefined ? input.jobTitle : ((user as any).jobTitle ?? null),
      location: input.location !== undefined ? input.location : ((user as any).location ?? null),
      website: input.website !== undefined ? input.website : ((user as any).website ?? null),
      github: input.github !== undefined ? input.github : ((user as any).github ?? null),
      bio: user.bio,
      timezone: user.timezone,
      systemRole: user.systemRole as CurrentUser['systemRole'],
      presence: user.presence as CurrentUser['presence'],
      statusText: isExpired ? null : user.statusText ?? null,
      statusEmoji: isExpired ? null : user.statusEmoji ?? null,
      statusExpiresAt: isExpired
        ? null
        : (user.statusExpiresAt?.toISOString() ?? null),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateStatus(
    userId: string,
    input: UpdateStatusInput,
  ): Promise<CurrentUser> {
    const data: {
      statusText?: string | null;
      statusEmoji?: string | null;
      statusExpiresAt?: Date | null;
      presence?: CurrentUser['presence'];
      lastSeenAt?: Date;
    } = {
      statusText: input.statusText ?? null,
      statusEmoji: input.statusEmoji ?? null,
      statusExpiresAt: input.statusExpiresAt
        ? new Date(input.statusExpiresAt)
        : null,
      lastSeenAt: new Date(),
    };

    if (input.presence) {
      data.presence = input.presence as CurrentUser['presence'];
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const isExpired =
      user.statusExpiresAt && user.statusExpiresAt < new Date();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      timezone: user.timezone,
      systemRole: user.systemRole as CurrentUser['systemRole'],
      presence: user.presence as CurrentUser['presence'],
      statusText: isExpired ? null : user.statusText ?? null,
      statusEmoji: isExpired ? null : user.statusEmoji ?? null,
      statusExpiresAt: isExpired
        ? null
        : (user.statusExpiresAt?.toISOString() ?? null),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async setPresence(
    userId: string,
    presence: CurrentUser['presence'],
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { presence, lastSeenAt: new Date() },
    });
  }

  /**
   * People-picker search, scoped to a workspace.
   *
   * Scoping to the workspace is a privacy boundary, not just a filter: it
   * stops the endpoint from becoming a directory of every user on the platform.
   */
  async searchInWorkspace(
    workspaceId: string,
    query: string,
    limit = 20,
  ): Promise<PublicUser[]> {
    const term = query.trim();

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        ...(term
          ? {
              user: {
                OR: [
                  { name: { contains: term, mode: 'insensitive' } },
                  { displayName: { contains: term, mode: 'insensitive' } },
                  { email: { contains: term, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      take: Math.min(limit, 50),
      orderBy: { joinedAt: 'asc' },
      select: { user: { select: PUBLIC_USER_SELECT } },
    });

    return members.map((row) => toPublicUser(row.user));
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const settings = await this.prisma.chatSettings.findUnique({
      where: { userId },
    });

    const density =
      settings?.density === 'compact' ? 'compact' : 'comfy';
    const readReceipts = settings?.showReadReceipts ?? true;

    return {
      chat: {
        messageDensity: density,
        openPosition: 'last-read',
        readReceipts,
      },
      notifications: {
        showContentPreview: true,
        showDuringCalls: true,
        flashTaskbar: true,
        dismissDuration: 5000,
        position: 'bottom-right',
        size: 'comfy',
      },
    };
  }

  async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);

    const updated: UserPreferences = {
      chat: {
        ...current.chat,
        ...(input.chat ?? {}),
      },
      notifications: {
        ...current.notifications,
        ...(input.notifications ?? {}),
      },
    };

    const densityForDb =
      updated.chat.messageDensity === 'compact' ? 'compact' : 'comfortable';

    await this.prisma.chatSettings.upsert({
      where: { userId },
      create: {
        userId,
        density: densityForDb,
        showReadReceipts: updated.chat.readReceipts,
      },
      update: {
        density: densityForDb,
        showReadReceipts: updated.chat.readReceipts,
      },
    });

    return updated;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import { MatrixAdminService } from '@org/api-matrix';
import { PrismaService } from '@org/database';
import {
  DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
  type CurrentUser,
  type PublicUser,
  type UserPreferences,
} from '@org/types';
import type {
  NavigationPreferenceInput,
  SidebarPreferencesInput,
  ThemeSettingInput,
  UpdateProfileInput,
  UpdateStatusInput,
  UpdateUserPreferencesInput,
} from '@org/validation';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: MatrixAdminService,
  ) {}

  async findPublic(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    return toPublicUser(user);
  }

  /**
   * A public profile, but only if the viewer shares a workspace with the
   * target. 404 (not 403) for everyone else, so the endpoint cannot be used to
   * confirm which account ids exist.
   */
  async findPublicForViewer(
    viewerId: string,
    targetId: string,
  ): Promise<PublicUser> {
    if (viewerId !== targetId) {
      const shared = await this.prisma.workspaceMember.findFirst({
        where: {
          userId: targetId,
          workspace: {
            members: { some: { userId: viewerId, status: 'ACTIVE' } },
          },
        },
        select: { id: true },
      });
      if (!shared) throw new NotFoundException('User not found.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found.');
    return toPublicUser(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<CurrentUser> {
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        displayName: true,
        avatarUrl: true,
        matrixUserId: true,
      },
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.preferredLanguage !== undefined
          ? { preferredLanguage: input.preferredLanguage }
          : {}),
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

    // Keep the user's Matrix profile in step, so their name and photo look the
    // same in chat as everywhere else. Only when something the profile shows
    // actually changed, and only for an already-bridged account — a brand-new
    // one picks up its avatar when its identity is provisioned. Fire-and-forget:
    // a profile save must not wait on (or fail with) the homeserver.
    if (before.matrixUserId) {
      const nameChanged =
        input.name !== before.name ||
        (input.displayName !== undefined &&
          input.displayName !== before.displayName);
      const avatarChanged =
        input.avatarUrl !== undefined && input.avatarUrl !== before.avatarUrl;

      if (nameChanged || avatarChanged) {
        void this.matrix
          .pushUserProfile({
            userId,
            displayName: nameChanged
              ? (user.displayName ?? user.name)
              : undefined,
            avatarUrl: avatarChanged ? user.avatarUrl : undefined,
          })
          .catch(() => undefined);
      }
    }

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
      preferredLanguage: user.preferredLanguage ?? 'en',
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
      scheduledStatusAppliedId?: string | null;
    } = {
      statusText: input.statusText ?? null,
      statusEmoji: input.statusEmoji ?? null,
      statusExpiresAt: input.statusExpiresAt
        ? new Date(input.statusExpiresAt)
        : null,
      lastSeenAt: new Date(),
      // Setting a status by hand takes it out of the scheduler's control — the
      // per-minute applier will not stomp or clear it (brief §9).
      scheduledStatusAppliedId: null,
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
      preferredLanguage: user.preferredLanguage ?? 'en',
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

  // --- sidebar customization -------------------------------------------

  /**
   * The user's persisted sidebar layout. Returns `{}` when they have never
   * customized it — the client falls back to its defaults.
   */
  async getSidebarPreferences(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.sidebarPreference.findUnique({
      where: { userId },
      select: { data: true },
    });
    return (row?.data as Record<string, unknown> | undefined) ?? {};
  }

  async saveSidebarPreferences(
    userId: string,
    data: SidebarPreferencesInput,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.sidebarPreference.upsert({
      where: { userId },
      create: { userId, data: data as object },
      update: { data: data as object },
      select: { data: true },
    });
    return row.data as Record<string, unknown>;
  }

  // --- cross-device navigation memory --------------------------------

  /**
   * The user's persisted navigation memory — `{ lastWorkspaceId,
   * lastWorkspaceSlug, workspacePaths }`. Returns `{}` when they have never
   * navigated a workspace on a synced client; the client falls back to its
   * localStorage copy / defaults.
   */
  async getNavigationPreferences(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.navigationPreference.findUnique({
      where: { userId },
      select: { data: true },
    });
    return (row?.data as Record<string, unknown> | undefined) ?? {};
  }

  /**
   * Deep-merges the incoming partial over the stored blob: top-level scalars
   * (`lastWorkspaceId`, `lastWorkspaceSlug`) overwrite, but `workspacePaths` is
   * merged key-by-key so a client PUTing only the workspace it just left does
   * not drop the route it remembers for every other one.
   */
  async saveNavigationPreferences(
    userId: string,
    data: NavigationPreferenceInput,
  ): Promise<Record<string, unknown>> {
    const current = await this.getNavigationPreferences(userId);
    const currentPaths =
      (current['workspacePaths'] as Record<string, string> | undefined) ?? {};

    const merged: Record<string, unknown> = {
      ...current,
      ...data,
      workspacePaths: { ...currentPaths, ...(data.workspacePaths ?? {}) },
    };

    const row = await this.prisma.navigationPreference.upsert({
      where: { userId },
      create: { userId, data: merged as object },
      update: { data: merged as object },
      select: { data: true },
    });
    return row.data as Record<string, unknown>;
  }

  // --- appearance / theme customization -------------------------------

  /**
   * The user's persisted appearance settings (mode, density, accent, radius,
   * custom-theme config). Returns `{}` when they have never customized it —
   * the client falls back to its localStorage copy / defaults.
   */
  async getThemeSetting(userId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.themeSetting.findUnique({
      where: { userId },
      select: { data: true },
    });
    return (row?.data as Record<string, unknown> | undefined) ?? {};
  }

  /**
   * Shallow-merges the incoming partial over the stored blob, so a client that
   * PUTs only `{ theme: 'dark' }` does not drop the saved `customTheme`.
   */
  async saveThemeSetting(
    userId: string,
    data: ThemeSettingInput,
  ): Promise<Record<string, unknown>> {
    const current = await this.getThemeSetting(userId);
    const merged = { ...current, ...(data as Record<string, unknown>) };
    const row = await this.prisma.themeSetting.upsert({
      where: { userId },
      create: { userId, data: merged as object },
      update: { data: merged as object },
      select: { data: true },
    });
    return row.data as Record<string, unknown>;
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const [settings, user] = await Promise.all([
      this.prisma.chatSettings.findUnique({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredLanguage: true },
      }),
    ]);

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
        sound: DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
      },
      language: user?.preferredLanguage ?? 'en',
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
      language: input.language ?? current.language ?? 'en',
    };

    const densityForDb =
      updated.chat.messageDensity === 'compact' ? 'compact' : 'comfortable';

    const updates: Promise<unknown>[] = [
      this.prisma.chatSettings.upsert({
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
      }),
    ];

    if (input.language) {
      updates.push(
        this.prisma.user.update({
          where: { id: userId },
          data: { preferredLanguage: input.language },
        }),
      );
    }

    await Promise.all(updates);

    return updated;
  }

  async getLanguage(userId: string): Promise<{ language: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { language: user.preferredLanguage ?? 'en' };
  }

  async updateLanguage(
    userId: string,
    language: string,
  ): Promise<{ language: string; user: CurrentUser }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: language },
    });

    const isExpired =
      user.statusExpiresAt && user.statusExpiresAt < new Date();

    const currentUser: CurrentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      timezone: user.timezone,
      preferredLanguage: user.preferredLanguage ?? 'en',
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

    return {
      language: user.preferredLanguage ?? 'en',
      user: currentUser,
    };
  }
}

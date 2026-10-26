import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
  PUBLIC_PROFILE_EXTRAS_SELECT,
  PUBLIC_USER_SELECT,
  toPublicUser,
} from '@org/api-common';
import { MatrixAdminService } from '@org/api-matrix';
import { ImageProcessingService } from '@org/api-media-processing';
import { StorageService } from '@org/api-storage';
import { PrismaService } from '@org/database';
import {
  DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
  type CurrentUser,
  type PublicUser,
  type UserPreferences,
} from '@org/types';
import { normalizeProfileWebsite } from '@org/validation';
import type {
  NavigationPreferenceInput,
  SidebarPreferencesInput,
  ThemeSettingInput,
  UpdateProfileInput,
  UpdateStatusInput,
  UpdateUserPreferencesInput,
} from '@org/validation';

/** One cover per user; replaced in place on every upload. */
function coverStorageKey(userId: string): string {
  return `covers/${userId}/cover.webp`;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: MatrixAdminService,
    private readonly storage: StorageService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly events: EventEmitter2,
  ) {}

  /** Every personal-settings write reaches the user's other open sessions/tabs this way — see `AppEvent.SettingsUpdated`. */
  private emitOwnSettingsUpdated(
    userId: string,
    category: 'chat' | 'sidebar' | 'navigation' | 'appearance',
  ): void {
    this.events.emit(AppEvent.SettingsUpdated, {
      scope: 'user',
      workspaceId: null,
      userId,
      actorId: userId,
      category,
    });
  }

  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Avatar file is empty.');
    }

    // Process avatar into square webp variants (256x256 main, plus 32, 48, 64, 96, 128, 512)
    const { main, variants } = await this.imageProcessing.processAvatar(file.buffer, 256);

    // Save main avatar
    const mainKey = `avatars/${userId}/avatar.webp`;
    await this.storage.put(mainKey, main.buffer);

    // Save all size variants
    await Promise.all(
      Object.entries(variants).map(([size, variant]: [string, any]) =>
        this.storage.put(`avatars/${userId}/avatar_${size}.webp`, variant.buffer),
      ),
    );

    const avatarUrl = `/users/${userId}/avatar?v=${Date.now()}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return { avatarUrl };
  }

  async readAvatar(userId: string, size?: number): Promise<{ content: Buffer; mimeType: string }> {
    const key = size && size !== 256
      ? `avatars/${userId}/avatar_${size}.webp`
      : `avatars/${userId}/avatar.webp`;

    if (await this.storage.exists(key)) {
      return {
        content: await this.storage.get(key),
        mimeType: 'image/webp',
      };
    }

    // Fallback to main avatar
    const mainKey = `avatars/${userId}/avatar.webp`;
    if (await this.storage.exists(mainKey)) {
      return {
        content: await this.storage.get(mainKey),
        mimeType: 'image/webp',
      };
    }

    throw new NotFoundException('Avatar not found.');
  }

  /**
   * Stores a profile cover as one 1920×720 webp (the `coverImage` preset) and
   * points `coverUrl` at the public read route. The `?v=` stamp busts caches,
   * since the storage key is the same on every replace.
   */
  async uploadCover(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ coverUrl: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Cover file is empty.');
    }

    const { coverImage } = await this.imageProcessing
      .generateVariants(file.buffer, ['coverImage'])
      .catch(() => ({}) as Record<string, undefined>);
    if (!coverImage) {
      throw new BadRequestException('Cover must be a PNG, JPEG, WebP or GIF image.');
    }

    await this.storage.put(coverStorageKey(userId), coverImage.buffer);

    const coverUrl = `/users/${userId}/cover?v=${Date.now()}`;
    await this.prisma.user.update({ where: { id: userId }, data: { coverUrl } });
    return { coverUrl };
  }

  async readCover(userId: string): Promise<{ content: Buffer; mimeType: string }> {
    const key = coverStorageKey(userId);
    if (!(await this.storage.exists(key))) {
      throw new NotFoundException('Cover not found.');
    }
    return { content: await this.storage.get(key), mimeType: 'image/webp' };
  }

  async removeCover(userId: string): Promise<{ coverUrl: null }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { coverUrl: null },
    });
    const key = coverStorageKey(userId);
    if (await this.storage.exists(key)) await this.storage.delete(key);
    return { coverUrl: null };
  }

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
      select: { ...PUBLIC_USER_SELECT, ...PUBLIC_PROFILE_EXTRAS_SELECT },
    });
    if (!user) throw new NotFoundException('User not found.');
    return toPublicUser(user);
  }

  /**
   * Stores every name `before` showed that `after` no longer does.
   * Names are matched case-insensitively, as a mention typed in another case
   * should still find its person.
   */
  private async rememberNameAliases(
    userId: string,
    before: { name: string; displayName: string | null },
    after: { name: string; displayName: string | null },
  ): Promise<void> {
    const keyOf = (n: string) => n.trim().toLowerCase();
    const current = new Set(
      [after.name, after.displayName].filter(Boolean).map((n) => keyOf(n as string)),
    );
    const old = [before.displayName, before.name]
      .filter((n): n is string => !!n?.trim())
      .filter((n) => !current.has(keyOf(n)));
    for (const alias of new Set(old)) {
      await this.prisma.userNameAlias.upsert({
        where: { userId_aliasKey: { userId, aliasKey: keyOf(alias) } },
        create: { userId, alias: alias.trim(), aliasKey: keyOf(alias) },
        update: {},
      });
    }
  }

  /**
   * Past names of the workspace's members, for resolving old `@mentions`.
   * A name now used by someone else is dropped so it never points at the wrong
   * person.
   */
  async listNameAliases(
    workspaceId: string,
  ): Promise<{ userId: string; matrixUserId: string | null; alias: string }[]> {
    const rows = await this.prisma.userNameAlias.findMany({
      where: { user: { workspaceMembers: { some: { workspaceId } } } },
      select: {
        alias: true,
        aliasKey: true,
        user: { select: { id: true, matrixUserId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    if (!rows.length) return [];
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true, displayName: true } } },
    });
    const owner = new Map<string, string>();
    for (const { user } of members) {
      for (const n of [user.name, user.displayName]) {
        if (n) owner.set(n.trim().toLowerCase(), user.id);
      }
    }
    return rows
      .filter((r) => {
        const holder = owner.get(r.aliasKey);
        return !holder || holder === r.user.id;
      })
      .map((r) => ({
        userId: r.user.id,
        matrixUserId: r.user.matrixUserId,
        alias: r.alias,
      }));
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
        // `title` is the older spelling of the same field; `jobTitle` wins.
        ...(input.jobTitle !== undefined
          ? { jobTitle: input.jobTitle || null }
          : input.title !== undefined
            ? { jobTitle: input.title || null }
            : {}),
        ...(input.location !== undefined
          ? { location: input.location || null }
          : {}),
        ...(input.website !== undefined
          ? {
              website: input.website
                ? normalizeProfileWebsite(input.website)
                : null,
            }
          : {}),
        ...(input.github !== undefined
          ? { github: input.github ? input.github.replace(/^@/, '') : null }
          : {}),
        ...(input.coverUrl !== undefined
          ? { coverUrl: input.coverUrl || null }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.preferredLanguage !== undefined
          ? { preferredLanguage: input.preferredLanguage }
          : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.workingHoursStart !== undefined
          ? { workingHoursStart: input.workingHoursStart }
          : {}),
        ...(input.workingHoursEnd !== undefined
          ? { workingHoursEnd: input.workingHoursEnd }
          : {}),
        ...(input.workingDays !== undefined
          ? { workingDays: input.workingDays }
          : {}),
        ...(input.timeFormat !== undefined ? { timeFormat: input.timeFormat } : {}),
        ...(input.dateFormat !== undefined ? { dateFormat: input.dateFormat } : {}),
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

    // Remember the names this person stops using, so `@Old Name` in messages
    // written before the rename still resolves to them. Best effort: a profile
    // save must not fail on the history write.
    void this.rememberNameAliases(userId, before, user).catch(() => undefined);

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
      title: user.jobTitle ?? null,
      jobTitle: user.jobTitle ?? null,
      location: user.location ?? null,
      website: user.website ?? null,
      github: user.github ?? null,
      coverUrl: user.coverUrl ?? null,
      bio: user.bio,
      timezone: user.timezone,
      preferredLanguage: user.preferredLanguage ?? 'en',
      workingHoursStart: user.workingHoursStart,
      workingHoursEnd: user.workingHoursEnd,
      workingDays: user.workingDays,
      timeFormat: (user.timeFormat ?? null) as CurrentUser['timeFormat'],
      dateFormat: (user.dateFormat ?? null) as CurrentUser['dateFormat'],
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
      jobTitle: user.jobTitle ?? null,
      title: user.jobTitle ?? null,
      location: user.location ?? null,
      website: user.website ?? null,
      github: user.github ?? null,
      coverUrl: user.coverUrl ?? null,
      timezone: user.timezone,
      preferredLanguage: user.preferredLanguage ?? 'en',
      workingHoursStart: user.workingHoursStart,
      workingHoursEnd: user.workingHoursEnd,
      workingDays: user.workingDays,
      timeFormat: (user.timeFormat ?? null) as CurrentUser['timeFormat'],
      dateFormat: (user.dateFormat ?? null) as CurrentUser['dateFormat'],
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
    this.emitOwnSettingsUpdated(userId, 'sidebar');
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
    this.emitOwnSettingsUpdated(userId, 'navigation');
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
    this.emitOwnSettingsUpdated(userId, 'appearance');
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
    const enterToSend = settings?.enterToSend ?? true;
    const sendTypingNotice = settings?.sendTypingNotice ?? true;
    const showTypingIndicators = settings?.showTypingIndicators ?? true;
    const mentionWarningsEnabled = settings?.mentionWarningsEnabled ?? true;
    const allowDirectMessagesFrom =
      (settings?.allowDirectMessagesFrom as 'everyone' | 'members' | 'admins') ?? 'everyone';
    const linkPreviewsEnabled = settings?.autoloadMedia ?? true;

    const storedNotifications =
      (settings?.notificationDisplayPrefs as
        | UserPreferences['notifications']
        | null
        | undefined) ?? undefined;

    return {
      chat: {
        messageDensity: density,
        openPosition: 'last-read',
        readReceipts,
        enterToSend,
        sendTypingNotice,
        showTypingIndicators,
        mentionWarningsEnabled,
        allowDirectMessagesFrom,
        linkPreviewsEnabled,
      },
      notifications: {
        showContentPreview: true,
        showDuringCalls: true,
        flashTaskbar: true,
        dismissDuration: 5000,
        position: 'bottom-right',
        size: 'comfy',
        sound: DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
        // Shallow-merge the persisted blob over these defaults so a schema
        // change (a newly added field) never leaves an old saved row missing
        // it — the same forward-compatibility rule `ChatSettings` follows.
        ...storedNotifications,
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
          enterToSend: updated.chat.enterToSend ?? true,
          sendTypingNotice: updated.chat.sendTypingNotice ?? true,
          showTypingIndicators: updated.chat.showTypingIndicators ?? true,
          mentionWarningsEnabled: updated.chat.mentionWarningsEnabled ?? true,
          allowDirectMessagesFrom: updated.chat.allowDirectMessagesFrom ?? 'everyone',
          autoloadMedia: updated.chat.linkPreviewsEnabled ?? true,
          notificationDisplayPrefs: updated.notifications as object,
        },
        update: {
          density: densityForDb,
          showReadReceipts: updated.chat.readReceipts,
          enterToSend: updated.chat.enterToSend ?? true,
          sendTypingNotice: updated.chat.sendTypingNotice ?? true,
          showTypingIndicators: updated.chat.showTypingIndicators ?? true,
          mentionWarningsEnabled: updated.chat.mentionWarningsEnabled ?? true,
          allowDirectMessagesFrom: updated.chat.allowDirectMessagesFrom ?? 'everyone',
          autoloadMedia: updated.chat.linkPreviewsEnabled ?? true,
          notificationDisplayPrefs: updated.notifications as object,
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
    this.emitOwnSettingsUpdated(userId, 'chat');

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
      jobTitle: user.jobTitle ?? null,
      title: user.jobTitle ?? null,
      location: user.location ?? null,
      website: user.website ?? null,
      github: user.github ?? null,
      coverUrl: user.coverUrl ?? null,
      timezone: user.timezone,
      preferredLanguage: user.preferredLanguage ?? 'en',
      workingHoursStart: user.workingHoursStart,
      workingHoursEnd: user.workingHoursEnd,
      workingDays: user.workingDays,
      timeFormat: (user.timeFormat ?? null) as CurrentUser['timeFormat'],
      dateFormat: (user.dateFormat ?? null) as CurrentUser['dateFormat'],
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

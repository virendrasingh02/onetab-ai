import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  resolveWorkspaceAppearance,
  resolveWorkspacePolicy,
  roleHasPermission,
  WorkspacePermission,
  type ThemeAppearance,
  type WorkspaceAppearanceResponse,
  type WorkspacePolicy,
  type WorkspaceRole,
} from '@org/types';
import type { ThemeSettingInput } from '@org/validation';
import { WorkspaceAuditService } from './workspace-audit.service.js';

/**
 * Workspace-scoped configuration.
 *
 * Appearance (theme mode, density, accent, corner radius, custom-theme config)
 * is stored per workspace, never globally, so a change in one workspace can
 * never affect another. Two rows feed a member's rendered theme:
 *
 *   * `WorkspaceSettings.theme` — the workspace default / branding, editable
 *     only with `MANAGE_SETTINGS`.
 *   * `WorkspaceThemePreference.data` — the member's own override for *this*
 *     workspace, editable by any member.
 *
 * The legacy user-global `ThemeSetting.data` is read as the bottom fallback so
 * nobody's look changes on upgrade. `resolveWorkspaceAppearance` (in
 * `@org/types`, shared with the web client) collapses the layers.
 */
@Injectable()
export class WorkspaceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: WorkspaceAuditService,
    private readonly events: EventEmitter2,
  ) {}

  private emitSettingsUpdated(params: {
    workspaceId: string;
    userId: string | null;
    category: 'policies' | 'appearance' | 'memberPreferences';
    scope: 'workspace' | 'user';
  }): void {
    this.events.emit(AppEvent.SettingsUpdated, {
      scope: params.scope,
      workspaceId: params.workspaceId,
      userId: params.userId,
      actorId: params.userId,
      category: params.category,
    });
  }

  private asBlob(value: unknown): ThemeAppearance {
    return (value as ThemeAppearance | null | undefined) ?? {};
  }

  /**
   * Every appearance layer for `userId` viewing `workspaceId`, plus the
   * collapsed result the client paints.
   */
  async getAppearance(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceAppearanceResponse> {
    const [settings, override, userGlobal] = await Promise.all([
      this.prisma.workspaceSettings.findUnique({
        where: { workspaceId },
        select: { theme: true },
      }),
      this.prisma.workspaceThemePreference.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { data: true },
      }),
      this.prisma.themeSetting.findUnique({
        where: { userId },
        select: { data: true },
      }),
    ]);

    const workspaceDefault = this.asBlob(settings?.theme);
    const memberOverride = this.asBlob(override?.data);
    const userGlobalBlob = this.asBlob(userGlobal?.data);

    return {
      workspaceId,
      workspaceDefault,
      memberOverride,
      userGlobal: userGlobalBlob,
      resolved: resolveWorkspaceAppearance({
        memberOverride,
        workspaceDefault,
        userGlobal: userGlobalBlob,
      }),
      canManageDefault: roleHasPermission(
        role,
        WorkspacePermission.MANAGE_SETTINGS,
      ),
    };
  }

  /**
   * Shallow-merges `input` over the workspace's stored default, mirroring
   * `UserService.saveThemeSetting` — a client that PUTs only `{ theme: 'dark' }`
   * must not drop a saved `customTheme`. Caller must hold `MANAGE_SETTINGS`
   * (enforced by the guard on the route).
   */
  async saveWorkspaceDefault(
    workspaceId: string,
    input: ThemeSettingInput,
  ): Promise<ThemeAppearance> {
    const current = await this.prisma.workspaceSettings.findUnique({
      where: { workspaceId },
      select: { theme: true },
    });
    const merged = {
      ...this.asBlob(current?.theme),
      ...(input as Record<string, unknown>),
    };
    const row = await this.prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, theme: merged as object },
      update: { theme: merged as object },
      select: { theme: true },
    });
    this.emitSettingsUpdated({
      workspaceId,
      userId: null,
      category: 'appearance',
      scope: 'workspace',
    });
    return this.asBlob(row.theme);
  }

  /** Shallow-merges `input` over the caller's own override for this workspace. */
  async saveMemberOverride(
    workspaceId: string,
    userId: string,
    input: ThemeSettingInput,
  ): Promise<ThemeAppearance> {
    const current = await this.prisma.workspaceThemePreference.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { data: true },
    });
    const merged = {
      ...this.asBlob(current?.data),
      ...(input as Record<string, unknown>),
    };
    const row = await this.prisma.workspaceThemePreference.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, data: merged as object },
      update: { data: merged as object },
      select: { data: true },
    });
    this.emitSettingsUpdated({
      workspaceId,
      userId,
      category: 'appearance',
      scope: 'user',
    });
    return this.asBlob(row.data);
  }

  /** Clears the caller's override so they follow the workspace default again. */
  async resetMemberOverride(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.workspaceThemePreference.deleteMany({
      where: { workspaceId, userId },
    });
  }

  /**
   * The caller's own settings-page preferences for this workspace — the
   * automations/schedule/pulse/documents/files/general-tab fields that used
   * to be `localStorage`-only. An opaque blob: this layer does not know or
   * validate individual field names, exactly like `WorkspacePolicy`'s
   * predecessor before it grew a typed schema — these fields don't have one
   * yet, and inventing one here would duplicate the frontend's definition of
   * what they mean.
   */
  async getMemberPreferences(
    workspaceId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.workspaceMemberPreference.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { data: true },
    });
    return (row?.data as Record<string, unknown> | null) ?? {};
  }

  /** Shallow-merges `input` over the caller's stored preferences for this workspace. */
  async saveMemberPreferences(
    workspaceId: string,
    userId: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const current = await this.getMemberPreferences(workspaceId, userId);
    const merged = { ...current, ...input };
    const row = await this.prisma.workspaceMemberPreference.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, data: merged as object },
      update: { data: merged as object },
      select: { data: true },
    });
    this.emitSettingsUpdated({
      workspaceId,
      userId,
      category: 'memberPreferences',
      scope: 'user',
    });
    return (row.data as Record<string, unknown> | null) ?? {};
  }

  /**
   * Retrieves the workspace authorization policy.
   */
  async getPolicies(workspaceId: string): Promise<WorkspacePolicy> {
    const row = await this.prisma.workspaceSettings.findUnique({
      where: { workspaceId },
      select: { policies: true },
    });
    return resolveWorkspacePolicy(row?.policies);
  }

  /**
   * Updates workspace authorization policies and logs an audit entry.
   */
  async savePolicies(
    workspaceId: string,
    input: Partial<WorkspacePolicy>,
    actorId: string,
  ): Promise<WorkspacePolicy> {
    const current = await this.getPolicies(workspaceId);
    const updated = resolveWorkspacePolicy({ ...current, ...input });

    await this.prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, policies: updated as any },
      update: { policies: updated as any },
    });

    await this.audit.record({
      workspaceId,
      actorId,
      action: 'policy.changed',
      targetType: 'POLICY',
      targetId: workspaceId,
      metadata: { previous: current, updated },
    });

    this.emitSettingsUpdated({
      workspaceId,
      userId: actorId,
      category: 'policies',
      scope: 'workspace',
    });

    return updated;
  }

  /**
   * The channel a new member is auto-added to on joining (Settings →
   * Channels & DMs). A soft reference — `defaultChannelId` carries no DB
   * foreign key, so this validates it against `Channel` itself and reports
   * `null` if the saved id no longer resolves to a real, unarchived channel
   * in this workspace (deleted/archived since it was set).
   */
  async getDefaultChannel(workspaceId: string): Promise<{ channelId: string | null }> {
    const row = await this.prisma.workspaceSettings.findUnique({
      where: { workspaceId },
      select: { defaultChannelId: true },
    });
    if (!row?.defaultChannelId) return { channelId: null };

    const channel = await this.prisma.channel.findFirst({
      where: { id: row.defaultChannelId, workspaceId, isArchived: false },
      select: { id: true },
    });
    return { channelId: channel?.id ?? null };
  }

  /** `channelId: null` clears it — new members are simply not auto-added anywhere. */
  async saveDefaultChannel(
    workspaceId: string,
    channelId: string | null,
    actorId: string,
  ): Promise<{ channelId: string | null }> {
    if (channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: channelId, workspaceId, isArchived: false },
        select: { id: true },
      });
      if (!channel) {
        throw new BadRequestException(
          'That channel does not exist in this workspace, or is archived.',
        );
      }
    }

    await this.prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, defaultChannelId: channelId },
      update: { defaultChannelId: channelId },
    });

    this.emitSettingsUpdated({
      workspaceId,
      userId: actorId,
      category: 'policies',
      scope: 'workspace',
    });

    return { channelId };
  }
}

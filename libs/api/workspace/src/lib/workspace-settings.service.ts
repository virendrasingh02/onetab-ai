import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  resolveWorkspaceAppearance,
  roleHasPermission,
  WorkspacePermission,
  type ThemeAppearance,
  type WorkspaceAppearanceResponse,
  type WorkspaceRole,
} from '@org/types';
import type { ThemeSettingInput } from '@org/validation';

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
  constructor(private readonly prisma: PrismaService) {}

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
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  AllowArchivedWorkspace,
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission, type WorkspaceRole } from '@org/types';
import { themeSettingSchema, type ThemeSettingInput } from '@org/validation';
import { WorkspaceSettingsService } from './workspace-settings.service.js';

/**
 * Workspace-scoped settings. Appearance (theme / accent / density / radius /
 * custom-theme) lives here, per workspace, so changing it in one workspace can
 * never affect another.
 *
 * `WorkspaceRoleGuard` proves the caller belongs to `:workspaceId` before any
 * handler runs; the default (`appearance` read, `appearance/me` write) needs
 * only membership, while `appearance/default` additionally requires
 * `MANAGE_SETTINGS`.
 */
@Controller({ path: 'workspaces/:workspaceId/settings', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class WorkspaceSettingsController {
  constructor(private readonly settings: WorkspaceSettingsService) {}

  /** Every appearance layer for the caller + the collapsed result to paint. */
  @Get('appearance')
  getAppearance(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole,
  ) {
    return this.settings.getAppearance(workspaceId, userId, role);
  }

  /** The workspace default / branding. Admins only. */
  @Put('appearance/default')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  saveWorkspaceDefault(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(themeSettingSchema)) body: ThemeSettingInput,
  ) {
    return this.settings.saveWorkspaceDefault(workspaceId, body);
  }

  /**
   * The caller's personal override for this workspace. Any member; allowed even
   * when the workspace is archived — it is the member's own view preference,
   * not workspace data.
   */
  @Put('appearance/me')
  @AllowArchivedWorkspace()
  saveMemberOverride(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(themeSettingSchema)) body: ThemeSettingInput,
  ) {
    return this.settings.saveMemberOverride(workspaceId, userId, body);
  }

  /** Clears the caller's override so they follow the workspace default again. */
  @Delete('appearance/me')
  @AllowArchivedWorkspace()
  @HttpCode(HttpStatus.NO_CONTENT)
  resetMemberOverride(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.settings.resetMemberOverride(workspaceId, userId);
  }
}

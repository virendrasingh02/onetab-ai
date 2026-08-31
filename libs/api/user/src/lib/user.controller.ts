import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, zodBody } from '@org/api-common';
import {
  sidebarPreferencesSchema,
  themeSettingSchema,
  updateProfileSchema,
  updateStatusSchema,
  updateUserPreferencesSchema,
  type SidebarPreferencesInput,
  type ThemeSettingInput,
  type UpdateProfileInput,
  type UpdateStatusInput,
  type UpdateUserPreferencesInput,
} from '@org/validation';
import { UserService } from './user.service.js';

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('me/preferences')
  getPreferences(@CurrentUser('id') userId: string) {
    return this.users.getPreferences(userId);
  }

  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateUserPreferencesSchema))
    body: UpdateUserPreferencesInput,
  ) {
    return this.users.updatePreferences(userId, body);
  }

  @Get('me/sidebar')
  getSidebarPreferences(@CurrentUser('id') userId: string) {
    return this.users.getSidebarPreferences(userId);
  }

  @Put('me/sidebar')
  saveSidebarPreferences(
    @CurrentUser('id') userId: string,
    @Body(zodBody(sidebarPreferencesSchema)) body: SidebarPreferencesInput,
  ) {
    return this.users.saveSidebarPreferences(userId, body);
  }

  @Get('me/theme')
  getThemeSetting(@CurrentUser('id') userId: string) {
    return this.users.getThemeSetting(userId);
  }

  @Put('me/theme')
  saveThemeSetting(
    @CurrentUser('id') userId: string,
    @Body(zodBody(themeSettingSchema)) body: ThemeSettingInput,
  ) {
    return this.users.saveThemeSetting(userId, body);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.users.updateProfile(userId, body);
  }

  @Patch('me/status')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateStatusSchema)) body: UpdateStatusInput,
  ) {
    return this.users.updateStatus(userId, body);
  }

  @Patch('me/presence')
  async setPresence(
    @CurrentUser('id') userId: string,
    @Body('presence') presence: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE',
  ) {
    await this.users.setPresence(userId, presence);
    return { presence };
  }

  @Get(':userId')
  findOne(
    @CurrentUser('id') callerId: string,
    @Param('userId') userId: string,
  ) {
    // Only people you share a workspace with — this route is otherwise a
    // lookup of any account on the platform by id (audit S9).
    return this.users.findPublicForViewer(callerId, userId);
  }
}

/** People search is workspace-scoped, so it lives behind the workspace guard. */
@Controller({ path: 'workspaces/:workspaceId/users', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class WorkspaceUserController {
  constructor(private readonly users: UserService) {}

  @Get('search')
  search(
    @WorkspaceId() workspaceId: string,
    @Query('q') query = '',
    @Query('limit') limit?: string,
  ) {
    return this.users.searchInWorkspace(
      workspaceId,
      query,
      limit ? Number(limit) : undefined,
    );
  }
}

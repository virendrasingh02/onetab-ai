import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, zodBody } from '@org/api-common';
import {
  createScheduledStatusSchema,
  navigationPreferenceSchema,
  sidebarPreferencesSchema,
  themeSettingSchema,
  updateLanguageSchema,
  updateProfileSchema,
  updateScheduledStatusSchema,
  updateStatusSchema,
  updateUserPreferencesSchema,
  type CreateScheduledStatusInput,
  type NavigationPreferenceInput,
  type SidebarPreferencesInput,
  type ThemeSettingInput,
  type UpdateLanguageInput,
  type UpdateProfileInput,
  type UpdateScheduledStatusInput,
  type UpdateStatusInput,
  type UpdateUserPreferencesInput,
} from '@org/validation';
import { ScheduledStatusService } from './scheduled-status.service.js';
import { UserService } from './user.service.js';

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly scheduledStatuses: ScheduledStatusService,
  ) {}

  @Get('me/language')
  getLanguage(@CurrentUser('id') userId: string) {
    return this.users.getLanguage(userId);
  }

  @Patch('me/language')
  updateLanguage(
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateLanguageSchema)) body: UpdateLanguageInput,
  ) {
    return this.users.updateLanguage(userId, body.language);
  }

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

  @Get('me/navigation')
  getNavigationPreferences(@CurrentUser('id') userId: string) {
    return this.users.getNavigationPreferences(userId);
  }

  @Put('me/navigation')
  saveNavigationPreferences(
    @CurrentUser('id') userId: string,
    @Body(zodBody(navigationPreferenceSchema)) body: NavigationPreferenceInput,
  ) {
    return this.users.saveNavigationPreferences(userId, body);
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

  // --- scheduled status multi-queue (brief §9) --------------------------

  @Get('me/scheduled-statuses')
  listScheduledStatuses(@CurrentUser('id') userId: string) {
    return this.scheduledStatuses.list(userId);
  }

  @Post('me/scheduled-statuses')
  createScheduledStatus(
    @CurrentUser('id') userId: string,
    @Body(zodBody(createScheduledStatusSchema))
    body: CreateScheduledStatusInput,
  ) {
    return this.scheduledStatuses.create(userId, body);
  }

  @Patch('me/scheduled-statuses/:id')
  updateScheduledStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(zodBody(updateScheduledStatusSchema))
    body: UpdateScheduledStatusInput,
  ) {
    return this.scheduledStatuses.update(userId, id, body);
  }

  @Delete('me/scheduled-statuses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteScheduledStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.scheduledStatuses.remove(userId, id);
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

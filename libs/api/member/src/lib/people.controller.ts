import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission, type WorkspaceRole } from '@org/types';
import {
  celebrationsQuerySchema,
  employeeDirectoryQuerySchema,
  updateCelebrationPrefsSchema,
  updateEmployeePrivacySchema,
  updateEmployeeProfileSchema,
  updateEmploymentSchema,
  type CelebrationsQuery,
  type EmployeeDirectoryQuery,
  type UpdateCelebrationPrefsInput,
  type UpdateEmployeePrivacyInput,
  type UpdateEmployeeProfileInput,
  type UpdateEmploymentInput,
} from '@org/validation';
import { PeopleService } from './people.service.js';

/**
 * Employee profiles, directory and celebrations. Every route is scoped to the
 * `:workspaceId` the guard has verified the caller belongs to; privacy is
 * applied in `PeopleService`, not here.
 */
@Controller({ path: 'workspaces/:workspaceId/people', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('directory')
  directory(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole,
    @Query(zodBody(employeeDirectoryQuerySchema)) query: EmployeeDirectoryQuery,
  ) {
    return this.people.directory(workspaceId, { userId, role }, query);
  }

  @Get('celebrations')
  celebrations(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole,
    @Query(zodBody(celebrationsQuerySchema)) query: CelebrationsQuery,
  ) {
    return this.people.celebrations(workspaceId, { userId, role }, query);
  }

  @Get(':userId')
  profile(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole,
    @Param('userId') targetId: string,
  ) {
    return this.people.getProfile(
      workspaceId,
      { userId, role },
      targetId === 'me' ? userId : targetId,
    );
  }

  /** Employee-editable fields — always the caller's own row. */
  @Patch('me/profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateOwn(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateEmployeeProfileSchema))
    body: UpdateEmployeeProfileInput,
  ) {
    return this.people.updateOwn(workspaceId, userId, body);
  }

  @Patch('me/privacy')
  updatePrivacy(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateEmployeePrivacySchema))
    body: UpdateEmployeePrivacyInput,
  ) {
    return this.people.updatePrivacy(workspaceId, userId, body);
  }

  @Patch('me/celebrations')
  updateCelebrationPrefs(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateCelebrationPrefsSchema))
    body: UpdateCelebrationPrefsInput,
  ) {
    return this.people.updateCelebrationPrefs(workspaceId, userId, body);
  }

  /** HR-managed employment info: department, team, joining/leaving dates. */
  @Patch(':userId/employment')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateEmployment(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') actorId: string,
    @Param('userId') targetId: string,
    @Body(zodBody(updateEmploymentSchema)) body: UpdateEmploymentInput,
  ) {
    return this.people.updateEmployment(workspaceId, actorId, targetId, body);
  }
}

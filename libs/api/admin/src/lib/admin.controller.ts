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
  Query,
  UseGuards,
} from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { CurrentUser, SystemRoles } from '@org/api-common';
import { SystemRole } from '@org/types';
import { AdminService } from './admin.service.js';

/** `?page=` / `?pageSize=` arrive as strings; undefined means "use the default". */
function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The operator console's API.
 *
 * Guarded once, at the class: every route here reads or writes across tenants,
 * so there is no such thing as a safely ungated handler on this controller.
 * `SystemRoleGuard` answers 404 rather than 403, so a non-operator cannot even
 * confirm the console exists.
 */
@Controller({ path: 'admin', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- overview -------------------------------------------------------------

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  // --- users ----------------------------------------------------------------

  @Get('users')
  listUsers(
    @Query('q') query?: string,
    @Query('role') role?: SystemRole,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listUsers({
      query,
      role,
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }

  @Get('users/:userId')
  getUser(@Param('userId') userId: string) {
    return this.admin.getUser(userId);
  }

  @Patch('users/:userId/role')
  setUserRole(
    @CurrentUser('id') actorId: string,
    @Param('userId') userId: string,
    @Body() body: { role: SystemRole },
  ) {
    return this.admin.setUserRole(actorId, userId, body.role);
  }

  @Delete('users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(
    @CurrentUser('id') actorId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.admin.deleteUser(actorId, userId);
  }

  // --- workspaces -----------------------------------------------------------

  @Get('workspaces')
  listWorkspaces(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listWorkspaces({
      query,
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }

  @Get('workspaces/:workspaceId')
  getWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.admin.getWorkspace(workspaceId);
  }

  @Delete('workspaces/:workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWorkspace(
    @Param('workspaceId') workspaceId: string,
  ): Promise<void> {
    return this.admin.deleteWorkspace(workspaceId);
  }

  // --- organisations --------------------------------------------------------

  @Get('organizations')
  listOrganizations() {
    return this.admin.listOrganizations();
  }

  @Post('organizations/:organizationId/departments')
  createDepartment(
    @Param('organizationId') organizationId: string,
    @Body() body: { name: string; code?: string },
  ) {
    return this.admin.createDepartment(organizationId, body);
  }

  @Delete('organizations/:organizationId/departments/:departmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDepartment(
    @Param('organizationId') organizationId: string,
    @Param('departmentId') departmentId: string,
  ): Promise<void> {
    return this.admin.deleteDepartment(organizationId, departmentId);
  }

  // --- audit ----------------------------------------------------------------

  @Get('audit-logs')
  auditLogs(
    @Query('organizationId') organizationId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.auditLogs({
      organizationId,
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }
}

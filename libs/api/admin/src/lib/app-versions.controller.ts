import {
  Body,
  Controller,
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
import {
  AppOperatingSystem,
  AppPlatform,
  AppReleaseChannel,
  AppReleaseStatus,
  SystemRole,
} from '@org/database';
import type {
  CreateAppReleaseInput,
  RolloutAppReleaseInput,
  ScheduleAppReleaseInput,
  UpdateAppReleaseInput,
} from '@org/types';
import { AppVersionsService } from './app-versions.service.js';

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

@Controller({ path: 'admin/app-versions', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN, SystemRole.SUPPORT)
export class AdminAppVersionsController {
  constructor(private readonly appVersions: AppVersionsService) {}

  // --- Overview -------------------------------------------------------------

  @Get('overview')
  overview() {
    return this.appVersions.getOverview();
  }

  // --- Audit Logs -----------------------------------------------------------

  @Get('audit-logs')
  auditLogs(
    @Query('platform') platform?: AppPlatform,
    @Query('releaseId') releaseId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.appVersions.getAuditLogs({
      platform,
      releaseId,
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }

  // --- Releases CRUD & Filtering --------------------------------------------

  @Get()
  listReleases(
    @Query('platform') platform?: AppPlatform,
    @Query('operatingSystem') operatingSystem?: AppOperatingSystem,
    @Query('releaseChannel') releaseChannel?: AppReleaseChannel,
    @Query('status') status?: AppReleaseStatus,
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.appVersions.listReleases({
      platform,
      operatingSystem,
      releaseChannel,
      status,
      query,
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }

  @Get(':id')
  getRelease(@Param('id') id: string) {
    return this.appVersions.getRelease(id);
  }

  @Post()
  createRelease(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Body() body: CreateAppReleaseInput,
  ) {
    return this.appVersions.createRelease(actorId, actorEmail, body);
  }

  @Patch(':id')
  updateRelease(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body() body: UpdateAppReleaseInput,
  ) {
    return this.appVersions.updateRelease(actorId, actorEmail, id, body);
  }

  // --- Actions & Lifecycle --------------------------------------------------

  @Post(':id/release')
  releaseNow(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.appVersions.releaseNow(actorId, actorEmail, id, body?.reason);
  }

  @Post(':id/schedule')
  scheduleRelease(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body() body: ScheduleAppReleaseInput,
  ) {
    return this.appVersions.scheduleRelease(actorId, actorEmail, id, body);
  }

  @Post(':id/rollout')
  updateRollout(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body() body: RolloutAppReleaseInput,
  ) {
    return this.appVersions.updateRollout(actorId, actorEmail, id, body);
  }

  @Post(':id/deprecate')
  deprecateRelease(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.appVersions.deprecateRelease(actorId, actorEmail, id, body?.reason);
  }

  @Post(':id/disable')
  disableRelease(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.appVersions.disableRelease(actorId, actorEmail, id, body?.reason);
  }

  @Post(':id/rollback')
  rollbackRelease(
    @CurrentUser('id') actorId: string,
    @CurrentUser('email') actorEmail: string,
    @Param('id') targetReleaseId: string,
    @Body() body: { reason: string },
  ) {
    return this.appVersions.rollbackRelease(
      actorId,
      actorEmail,
      targetReleaseId,
      body.reason,
    );
  }
}

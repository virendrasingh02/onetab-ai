import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, WorkspaceRoles } from '@org/api-common';
import {
  WorkspaceRole,
  type MigrationConflictResolutionInput,
  type MigrationScope,
} from '@org/types';
import { MigrationEngineService } from './migration-engine.service.js';

@Controller({ version: '1' })
@UseGuards(WorkspaceRoleGuard)
@WorkspaceRoles(WorkspaceRole.ADMIN)
export class MigrationController {
  constructor(private readonly engine: MigrationEngineService) {}

  @Post('workspaces/:workspaceId/migrations')
  createMigrationSession(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { provider?: string },
  ) {
    return this.engine.createSession(workspaceId, userId, body.provider ?? 'SLACK_API');
  }

  @Get('workspaces/:workspaceId/migrations')
  listMigrations(@WorkspaceId() workspaceId: string) {
    return this.engine.listSessions(workspaceId);
  }

  @Get('workspaces/:workspaceId/migrations/capabilities')
  checkCapabilities(
    @WorkspaceId() workspaceId: string,
    @Query('integrationId') integrationId?: string,
  ) {
    return this.engine.checkCapabilities(workspaceId, integrationId);
  }

  @Get('workspaces/:workspaceId/migrations/:id')
  getMigrationDetail(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.getSession(migrationId);
  }

  @Get('workspaces/:workspaceId/migrations/:id/readiness')
  getReadinessReport(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.getReadinessReport(migrationId);
  }

  @Patch('workspaces/:workspaceId/migrations/:id/scope')
  updateScope(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
    @Body() scope: MigrationScope,
  ) {
    return this.engine.updateScope(migrationId, scope);
  }

  @Get('workspaces/:workspaceId/migrations/:id/preview')
  getMappingPreview(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.getMappingPreview(migrationId);
  }

  @Post('workspaces/:workspaceId/migrations/:id/conflicts')
  resolveConflicts(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
    @Body() body: MigrationConflictResolutionInput,
  ) {
    return this.engine.resolveConflicts(migrationId, body);
  }

  @Post('workspaces/:workspaceId/migrations/:id/start')
  startMigration(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.startMigration(migrationId);
  }

  @Post('workspaces/:workspaceId/migrations/:id/pause')
  pauseMigration(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.pauseMigration(migrationId);
  }

  @Post('workspaces/:workspaceId/migrations/:id/resume')
  resumeMigration(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.resumeMigration(migrationId);
  }

  @Post('workspaces/:workspaceId/migrations/:id/retry')
  retryFailed(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.retryFailedItems(migrationId);
  }

  @Post('workspaces/:workspaceId/migrations/:id/cancel')
  cancelMigration(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.cancelMigration(migrationId);
  }

  @Get('workspaces/:workspaceId/migrations/:id/progress')
  getLiveProgress(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.getLiveProgress(migrationId);
  }

  @Get('workspaces/:workspaceId/migrations/:id/report')
  getFinalReport(
    @WorkspaceId() _workspaceId: string,
    @Param('id') migrationId: string,
  ) {
    return this.engine.getFinalReport(migrationId);
  }

  @Post('workspaces/:workspaceId/migrations/:id/recommendations/:recId/apply')
  applyRecommendation(
    @WorkspaceId() workspaceId: string,
    @Param('id') migrationId: string,
    @Param('recId') recId: string,
    @Body() body: { actionType: string; payload?: Record<string, unknown> },
  ) {
    return this.engine.applyAiRecommendation(
      workspaceId,
      migrationId,
      recId,
      body.actionType,
      body.payload,
    );
  }
}

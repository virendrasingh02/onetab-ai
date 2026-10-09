import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, zodBody } from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import {
  createWidgetDefinitionSchema,
  executeWidgetSchema,
  publishWidgetSchema,
  rollbackWidgetSchema,
  updateWidgetDefinitionSchema,
  widgetQuerySchema,
  type CreateWidgetDefinitionInput,
  type ExecuteWidgetInput,
  type PublishWidgetInput,
  type RollbackWidgetInput,
  type UpdateWidgetDefinitionInput,
  type WidgetQueryInput,
} from '@org/validation';
import { WidgetStudioService } from './widget-studio.service.js';

@Controller({ path: 'workspaces/:workspaceId/agent-studio/widgets', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class WidgetStudioController {
  constructor(private readonly widgetService: WidgetStudioService) {}

  /**
   * List and search widgets.
   */
  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query() query: WidgetQueryInput,
  ) {
    return this.widgetService.list(workspaceId, userId, query);
  }

  /**
   * Reusable Widget Templates Gallery.
   */
  @Get('templates')
  templates() {
    return this.widgetService.getTemplates();
  }

  /**
   * Create a new widget.
   */
  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createWidgetDefinitionSchema)) body: CreateWidgetDefinitionInput,
  ) {
    return this.widgetService.create(workspaceId, userId, body);
  }

  /**
   * Get single widget definition.
   */
  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
  ) {
    return this.widgetService.get(workspaceId, widgetId, userId);
  }

  /**
   * Update widget definition.
   */
  @Put(':id')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  update(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
    @Body(zodBody(updateWidgetDefinitionSchema)) body: UpdateWidgetDefinitionInput,
  ) {
    return this.widgetService.update(workspaceId, widgetId, userId, body);
  }

  /**
   * Duplicate widget.
   */
  @Post(':id/duplicate')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  duplicate(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
  ) {
    return this.widgetService.duplicate(workspaceId, widgetId, userId);
  }

  /**
   * Archive widget.
   */
  @Post(':id/archive')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  archive(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
  ) {
    return this.widgetService.setStatus(workspaceId, widgetId, userId, 'ARCHIVED');
  }

  /**
   * Restore widget.
   */
  @Post(':id/restore')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  restore(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
  ) {
    return this.widgetService.setStatus(workspaceId, widgetId, userId, 'READY');
  }

  /**
   * Publish widget version.
   */
  @Post(':id/publish')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  publish(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
    @Body(zodBody(publishWidgetSchema)) body: PublishWidgetInput,
  ) {
    return this.widgetService.publish(workspaceId, widgetId, userId, body.changeSummary);
  }

  /**
   * Rollback widget to previous version.
   */
  @Post(':id/rollback')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  rollback(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
    @Body(zodBody(rollbackWidgetSchema)) body: RollbackWidgetInput,
  ) {
    return this.widgetService.rollback(workspaceId, widgetId, userId, body.versionNumber);
  }

  /**
   * Preview widget.
   */
  @Post(':id/preview')
  preview(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
    @Body() body: { sampleData?: Record<string, unknown> },
  ) {
    return this.widgetService.preview(workspaceId, widgetId, userId, body.sampleData);
  }

  /**
   * Execute widget operation (Data Fetch or Action).
   */
  @Post(':id/execute')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  execute(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
    @Body(zodBody(executeWidgetSchema)) body: ExecuteWidgetInput,
  ) {
    return this.widgetService.execute(workspaceId, widgetId, userId, body);
  }

  /**
   * Versions history.
   */
  @Get(':id/versions')
  versions(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
  ) {
    return this.widgetService.getVersions(workspaceId, widgetId, userId);
  }

  /**
   * Executions history.
   */
  @Get(':id/executions')
  executions(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') widgetId: string,
  ) {
    return this.widgetService.getExecutions(workspaceId, widgetId, userId);
  }
}

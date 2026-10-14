import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import type { ConnectorGroupInput } from '@org/types';
import { ConnectorGroupsService } from './connector-groups.service.js';

/** Connector groups: sets of connected apps an agent can be given in one step. */
@Controller({ version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class ConnectorGroupsController {
  constructor(private readonly groups: ConnectorGroupsService) {}

  @Get('workspaces/:workspaceId/connector-groups')
  list(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.groups.list(workspaceId, userId);
  }

  @Post('workspaces/:workspaceId/connector-groups')
  create(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string, @Body() body: ConnectorGroupInput) {
    return this.groups.create(workspaceId, userId, body);
  }

  @Put('workspaces/:workspaceId/connector-groups/:id')
  update(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: ConnectorGroupInput,
  ) {
    return this.groups.update(workspaceId, userId, id, body);
  }

  @Post('workspaces/:workspaceId/connector-groups/:id/duplicate')
  duplicate(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.groups.duplicate(workspaceId, userId, id);
  }

  @Delete('workspaces/:workspaceId/connector-groups/:id')
  remove(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.groups.remove(workspaceId, userId, id);
  }
}

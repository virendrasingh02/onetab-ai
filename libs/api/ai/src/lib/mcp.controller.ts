import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { CreateMCPConnectionInput } from '@org/types';
import { createMCPConnectionSchema } from '@org/validation';
import { MCPService } from './mcp.service.js';

@Controller({ path: 'workspaces/:workspaceId/mcp-connections', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class MCPController {
  constructor(private readonly mcpService: MCPService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.mcpService.listConnections(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createMCPConnectionSchema)) body: CreateMCPConnectionInput,
  ) {
    return this.mcpService.createConnection(workspaceId, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  delete(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.mcpService.deleteConnection(workspaceId, id);
  }

  @Post(':id/sync')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  sync(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.mcpService.syncTools(workspaceId, id);
  }
}

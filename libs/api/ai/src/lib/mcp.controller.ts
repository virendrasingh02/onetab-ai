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
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type {
  CreateMCPConnectionInput,
  UpdateMCPConnectionInput,
} from '@org/types';
import {
  createMCPConnectionSchema,
  testMcpToolSchema,
  updateMCPConnectionSchema,
} from '@org/validation';
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
  delete(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.mcpService.deleteConnection(workspaceId, id);
  }

  @Patch(':id')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(updateMCPConnectionSchema)) body: UpdateMCPConnectionInput,
  ) {
    return this.mcpService.updateConnection(workspaceId, id, body);
  }

  @Post(':id/tools/test')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  testTool(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(testMcpToolSchema))
    body: { toolName: string; params: Record<string, unknown> },
  ) {
    return this.mcpService.testTool(
      workspaceId,
      id,
      body.toolName,
      body.params,
    );
  }

  @Post(':id/sync')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  sync(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.mcpService.syncTools(workspaceId, id);
  }
}

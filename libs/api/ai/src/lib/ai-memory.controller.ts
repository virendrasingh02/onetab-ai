import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { RequireWorkspacePermissions, WorkspaceId } from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { AIMemoryService, type AIMemoryUpsertInput } from './ai-memory.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai/memory', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIMemoryController {
  constructor(private readonly memoryService: AIMemoryService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query('search') search?: string,
    @Query('scope') scope?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.memoryService.list(workspaceId, { search, scope, agentId });
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  set(
    @WorkspaceId() workspaceId: string,
    @Body() body: AIMemoryUpsertInput,
  ) {
    return this.memoryService.set(workspaceId, body);
  }

  @Delete('agents/:agentId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  forgetAgent(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.memoryService.forgetAgentMemories(workspaceId, agentId);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  delete(@WorkspaceId() workspaceId: string, @Param('key') key: string) {
    return this.memoryService.delete(workspaceId, key);
  }
}

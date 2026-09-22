import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { RequireWorkspacePermissions, WorkspaceId } from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { AIMemoryService } from './ai-memory.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai/memory', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIMemoryController {
  constructor(private readonly memoryService: AIMemoryService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.memoryService.list(workspaceId);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  delete(@WorkspaceId() workspaceId: string, @Param('key') key: string) {
    return this.memoryService.delete(workspaceId, key);
  }
}

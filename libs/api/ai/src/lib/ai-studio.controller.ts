import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { AIStudioService } from './ai-studio.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai-studio', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIStudioController {
  constructor(private readonly studioService: AIStudioService) {}

  @Get('overview')
  getOverview(@WorkspaceId() workspaceId: string) {
    return this.studioService.getOverview(workspaceId);
  }

  @Post('quick-create')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  quickCreate(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { name: string; type: string; description?: string },
  ) {
    return this.studioService.quickCreate(workspaceId, userId, body);
  }
}

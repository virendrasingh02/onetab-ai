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
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { CreateAISecretInput } from '@org/types';
import { AISecretsService } from './ai-secrets.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai-secrets', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AISecretsController {
  constructor(private readonly secretsService: AISecretsService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.secretsService.listSecrets(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: CreateAISecretInput,
  ) {
    return this.secretsService.createSecret(workspaceId, userId, body);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  delete(
    @WorkspaceId() workspaceId: string,
    @Param('key') key: string,
  ) {
    return this.secretsService.deleteSecret(workspaceId, key);
  }
}

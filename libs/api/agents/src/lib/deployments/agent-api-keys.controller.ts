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
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { createAgentApiKeySchema, type CreateAgentApiKeyInput } from '@org/validation';
import { AgentDeploymentService } from './agent-deployment.service.js';

/**
 * The workspace's agent API keys (`ot_live_…`): bearer credentials for running
 * published agents from a server. A key belongs to the workspace, not to one
 * agent, so it is managed here rather than under an agent's deployments.
 */
@Controller({ path: 'workspaces/:workspaceId/agent-api-keys', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AgentApiKeysController {
  constructor(private readonly deploymentService: AgentDeploymentService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.deploymentService.listApiKeys(workspaceId);
  }

  /** The only response that ever carries the key itself. */
  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  create(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(createAgentApiKeySchema)) body: CreateAgentApiKeyInput,
  ) {
    return this.deploymentService.createApiKey(workspaceId, body);
  }

  @Delete(':keyId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@WorkspaceId() workspaceId: string, @Param('keyId') keyId: string) {
    return this.deploymentService.revokeApiKey(workspaceId, keyId);
  }
}

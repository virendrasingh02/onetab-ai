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
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import {
  createAgentDeploymentSchema,
  updateAgentDeploymentSchema,
  createAgentDeploymentWebhookSchema,
  rollbackDeploymentSchema,
  type CreateAgentDeploymentInput,
  type UpdateAgentDeploymentInput,
  type CreateAgentDeploymentWebhookInput,
  type RollbackDeploymentInput,
} from '@org/validation';
import { AgentDeploymentService } from './agent-deployment.service.js';
import { AgentDeploymentWebhookService } from './agent-webhook.service.js';

@Controller({
  path: 'workspaces/:workspaceId/agents/:agentId/deployments',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class AgentDeploymentController {
  constructor(
    private readonly deploymentService: AgentDeploymentService,
    private readonly webhookService: AgentDeploymentWebhookService,
  ) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.deploymentService.listDeployments(workspaceId, agentId);
  }

  @Get('default')
  getDefault(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.deploymentService.ensureDefaultDeployment(workspaceId, agentId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  create(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(createAgentDeploymentSchema)) body: CreateAgentDeploymentInput,
  ) {
    return this.deploymentService.createDeployment(workspaceId, agentId, body);
  }

  @Get(':deploymentId')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.deploymentService.getDeployment(workspaceId, deploymentId);
  }

  @Patch(':deploymentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
    @Body(zodBody(updateAgentDeploymentSchema)) body: UpdateAgentDeploymentInput,
  ) {
    return this.deploymentService.updateDeployment(workspaceId, deploymentId, body);
  }

  @Delete(':deploymentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.deploymentService.deleteDeployment(workspaceId, deploymentId);
  }

  @Post(':deploymentId/publish')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  publish(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
    @Body('versionNumber') versionNumber: number,
  ) {
    return this.deploymentService.publishVersion(workspaceId, deploymentId, versionNumber);
  }

  @Post(':deploymentId/rollback')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  rollback(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
    @Body(zodBody(rollbackDeploymentSchema)) body: RollbackDeploymentInput,
  ) {
    return this.deploymentService.rollbackDeployment(
      workspaceId,
      deploymentId,
      body.targetVersion,
      body.summary,
    );
  }

  @Post(':deploymentId/suspend')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  suspend(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
    @Body('status') status: 'ACTIVE' | 'SUSPENDED',
  ) {
    return this.deploymentService.setDeploymentStatus(
      workspaceId,
      deploymentId,
      status || 'SUSPENDED',
    );
  }

  @Get(':deploymentId/analytics')
  analytics(
    @WorkspaceId() workspaceId: string,
    @Param('deploymentId') deploymentId: string,
    @Query('period') period?: string,
  ) {
    return this.deploymentService.getDeploymentAnalytics(workspaceId, deploymentId, period);
  }

  // --- Webhooks ---

  @Get(':deploymentId/webhooks')
  async listWebhooks(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    await this.deploymentService.assertDeployment(workspaceId, agentId, deploymentId);
    return this.webhookService.listWebhooks(deploymentId);
  }

  @Post(':deploymentId/webhooks')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  async createWebhook(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('deploymentId') deploymentId: string,
    @Body(zodBody(createAgentDeploymentWebhookSchema)) body: CreateAgentDeploymentWebhookInput,
  ) {
    await this.deploymentService.assertDeployment(workspaceId, agentId, deploymentId);
    return this.webhookService.createWebhook(deploymentId, body);
  }

  @Delete(':deploymentId/webhooks/:webhookId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('deploymentId') deploymentId: string,
    @Param('webhookId') webhookId: string,
  ) {
    await this.deploymentService.assertDeployment(workspaceId, agentId, deploymentId);
    await this.webhookService.deleteWebhook(webhookId, deploymentId);
  }

  @Post(':deploymentId/webhooks/:webhookId/test')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  async testWebhook(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('deploymentId') deploymentId: string,
    @Param('webhookId') webhookId: string,
  ) {
    await this.deploymentService.assertDeployment(workspaceId, agentId, deploymentId);
    return this.webhookService.testWebhook(webhookId, deploymentId);
  }

  @Get(':deploymentId/webhooks/:webhookId/deliveries')
  async getDeliveries(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Param('deploymentId') deploymentId: string,
    @Param('webhookId') webhookId: string,
  ) {
    await this.deploymentService.assertDeployment(workspaceId, agentId, deploymentId);
    return this.webhookService.getDeliveries(webhookId, deploymentId);
  }
}

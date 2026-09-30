import {
  Body,
  Controller,
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
import type {
  AgentPlan,
  AgentSpec,
  IntentClassification,
} from '@org/types';
import { AgentStudioAiModeService } from './agent-studio-ai-mode.service.js';

@Controller({
  path: 'workspaces/:workspaceId/ai-studio/ai-mode',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class AgentStudioAiModeController {
  constructor(private readonly aiModeService: AgentStudioAiModeService) {}

  @Post('classify-intent')
  @RequireWorkspacePermissions(WorkspacePermission.VIEW)
  classifyIntent(@Body('prompt') prompt: string) {
    return this.aiModeService.classifyIntent(prompt || '');
  }

  @Post('requirements')
  @RequireWorkspacePermissions(WorkspacePermission.VIEW)
  generateRequirements(
    @Body('prompt') prompt: string,
    @Body('classification') classification: IntentClassification,
  ) {
    return this.aiModeService.generateRequirements(prompt, classification);
  }

  @Post('plan')
  @RequireWorkspacePermissions(WorkspacePermission.VIEW)
  generatePlan(
    @Body('prompt') prompt: string,
    @Body('classification') classification: IntentClassification,
    @Body('answers') answers: Record<string, unknown>,
  ) {
    return this.aiModeService.generatePlan(prompt, classification, answers || {});
  }

  @Post('compile-spec')
  @RequireWorkspacePermissions(WorkspacePermission.VIEW)
  compileSpec(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body('prompt') prompt: string,
    @Body('classification') classification: IntentClassification,
    @Body('answers') answers: Record<string, unknown>,
    @Body('plan') plan: AgentPlan,
  ) {
    return this.aiModeService.compileAgentSpec(
      workspaceId,
      userId,
      classification,
      answers || {},
      plan,
    );
  }

  @Post('execute-step')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  executeStep(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body('stepId') stepId: string,
    @Body('plan') plan: AgentPlan,
    @Body('agentSpec') agentSpec: AgentSpec,
  ) {
    return this.aiModeService.executePlanStep(
      workspaceId,
      userId,
      stepId,
      plan,
      agentSpec,
    );
  }

  @Post('publish')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  publish(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body('agentSpec') agentSpec: AgentSpec,
  ) {
    return this.aiModeService.publishAgent(workspaceId, userId, agentSpec);
  }

  @Post('iterate')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  iterate(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body('agentId') agentId: string,
    @Body('instruction') instruction: string,
  ) {
    return this.aiModeService.iterateAgent(
      workspaceId,
      userId,
      agentId,
      instruction,
    );
  }
}

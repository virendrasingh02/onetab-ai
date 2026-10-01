import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CanManageWorkflow } from '@org/api-agents';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, zodBody } from '@org/api-common';
import { WorkspacePermission, type AgentBlueprint } from '@org/types';
import {
  createStudioAgentSchema,
  planAgentSchema,
  runStudioAgentSchema,
  setAgentStateSchema,
  updateStudioAgentSchema,
  type CreateStudioAgentInput,
  type PlanAgentInput,
  type RunStudioAgentInput,
  type SetAgentStateInput,
  type UpdateStudioAgentInput,
} from '@org/validation';
import { AgentPlannerService } from './agent-planner.service.js';
import { AgentStudioService } from './agent-studio.service.js';

/**
 * AI Agent Studio — plan an agent from a sentence, save and edit its plan,
 * switch it on, run it (live or as a test), and the Home summary. An agent is
 * a workflow with a blueprint, so runs, approvals and versions use the same
 * routes as every workflow (`ai-executions`, `approvals`,
 * `automations/workflows/:id/versions`).
 */
@Controller({ path: 'workspaces/:workspaceId/agent-studio', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AgentStudioController {
  constructor(
    private readonly planner: AgentPlannerService,
    private readonly studio: AgentStudioService,
  ) {}

  @Get('home')
  home(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.studio.home(workspaceId, userId);
  }

  /** Tools, connected apps and events a plan can use. */
  @Get('catalog')
  catalog(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.planner.catalog(workspaceId, userId);
  }

  /** "Build me an agent that…" → a plan to review. Nothing is saved. */
  @Post('plan')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  plan(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(planAgentSchema)) body: PlanAgentInput,
  ) {
    return this.planner.plan(workspaceId, userId, body);
  }

  @Get('agents')
  list(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.studio.list(workspaceId, userId);
  }

  @Post('agents')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createStudioAgentSchema)) body: CreateStudioAgentInput,
  ) {
    return this.studio.create(workspaceId, userId, body.blueprint as AgentBlueprint, body.activate);
  }

  @Get('agents/:workflowId')
  get(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.studio.get(workspaceId, workflowId, userId);
  }

  @Put('agents/:workflowId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  update(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(updateStudioAgentSchema)) body: UpdateStudioAgentInput,
  ) {
    return this.studio.update(workspaceId, workflowId, userId, body.blueprint as AgentBlueprint, body.overwriteCanvasEdits);
  }

  /** Switch on (publishes a version), pause, archive, or unarchive. */
  @Post('agents/:workflowId/state')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  setState(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(setAgentStateSchema)) body: SetAgentStateInput,
  ) {
    return this.studio.setState(workspaceId, workflowId, body.state);
  }

  @Post('agents/:workflowId/duplicate')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  duplicate(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.studio.duplicate(workspaceId, workflowId, userId);
  }

  /** Starts a run (live, or a test that changes nothing) and returns its id at once. */
  @Post('agents/:workflowId/run')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  run(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(runStudioAgentSchema)) body: RunStudioAgentInput,
  ) {
    return this.studio.run(workspaceId, workflowId, userId, body);
  }

  /** One version in full — the plan and graph as they were — for compare and preview. */
  @Get('agents/:workflowId/versions/:version')
  version(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.studio.version(workspaceId, workflowId, version);
  }
}

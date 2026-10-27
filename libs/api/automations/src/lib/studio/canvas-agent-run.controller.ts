import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, WorkspacePermissions, zodBody } from '@org/api-common';
import { PrismaService } from '@org/database';
import { canManageOwnedAIResource, WorkspacePermission } from '@org/types';
import { runCanvasAgentSchema, setCanvasActivationSchema, validateAgentGraphSchema, type RunCanvasAgentInput } from '@org/validation';
import { CanvasAgentRunService } from './canvas-agent-run.service.js';

/**
 * Running agents drawn on the Studio canvas, and reading what happened —
 * steps, the agent team's tasks and messages, approvals. Pause, resume,
 * cancel, retry and restart use the shared run routes (`ai-executions`).
 */
@Controller({ path: 'workspaces/:workspaceId/agent-graphs', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class CanvasAgentRunController {
  constructor(
    private readonly runs: CanvasAgentRunService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':agentId/validate')
  validate(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @Body(zodBody(validateAgentGraphSchema)) body: { graphJson?: string },
  ) {
    return this.runs.validate(workspaceId, agentId, body.graphJson);
  }

  /**
   * Starts a run. A test run reads for real and changes nothing, so any
   * member may start one. A live run acts with the agent owner's access, so
   * only someone who may manage the agent (its owner or an admin) may start it.
   */
  @Post(':agentId/run')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async run(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(runCanvasAgentSchema)) body: RunCanvasAgentInput,
  ) {
    if (body.mode === 'live') {
      const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, workspaceId }, select: { creatorId: true } });
      if (agent && !canManageOwnedAIResource(agent.creatorId, { userId, permissions: permissions ?? [] })) {
        throw new ForbiddenException('Only the agent’s owner or a workspace admin can run it live. You can run a test instead.');
      }
    }
    return this.runs.run(workspaceId, agentId, userId, body);
  }

  /** Whether the agent runs by itself, and what starts it. */
  @Get(':agentId/activation')
  async activation(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
  ) {
    return this.runs.activation(workspaceId, agentId, { canManage: await this.canManage(workspaceId, agentId, userId, permissions) });
  }

  /** A new webhook secret for a switched-on webhook agent (owner or admin). */
  @Post(':agentId/webhook-secret')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  async rotateWebhookSecret(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
  ) {
    if (!(await this.canManage(workspaceId, agentId, userId, permissions))) {
      throw new ForbiddenException('Only the agent’s owner or a workspace admin can change its webhook secret.');
    }
    return this.runs.rotateWebhookSecret(workspaceId, agentId);
  }

  // POST :agentId/webhook (called from outside the app) lives in
  // AutomationWebhooksController, out from under this member-only guard.

  /**
   * Switches scheduled runs on or off. Scheduled runs are live and act with
   * the owner's access, so only the owner or an admin may switch them.
   */
  @Post(':agentId/activation')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  async setActivation(
    @WorkspaceId() workspaceId: string,
    @Param('agentId') agentId: string,
    @CurrentUser('id') userId: string,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Body(zodBody(setCanvasActivationSchema)) body: { active: boolean },
  ) {
    if (!(await this.canManage(workspaceId, agentId, userId, permissions))) {
      throw new ForbiddenException('Only the agent’s owner or a workspace admin can switch its scheduled runs on or off.');
    }
    return this.runs.setActive(workspaceId, agentId, body.active);
  }

  /** The owner or an admin; a missing agent passes here and 404s in the service. */
  private async canManage(
    workspaceId: string,
    agentId: string,
    userId: string,
    permissions: readonly WorkspacePermission[] | undefined,
  ): Promise<boolean> {
    const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, workspaceId }, select: { creatorId: true } });
    return !agent || canManageOwnedAIResource(agent.creatorId, { userId, permissions: permissions ?? [] });
  }

  @Get(':agentId/runs')
  listRuns(@WorkspaceId() workspaceId: string, @Param('agentId') agentId: string) {
    return this.runs.listRuns(workspaceId, agentId);
  }

  @Get('runs/:runId')
  getRun(@WorkspaceId() workspaceId: string, @Param('runId') runId: string) {
    return this.runs.getRun(workspaceId, runId);
  }
}

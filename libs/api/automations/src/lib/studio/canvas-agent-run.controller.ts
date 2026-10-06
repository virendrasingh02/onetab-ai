import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, WorkspacePermissions, zodBody } from '@org/api-common';
import { PrismaService } from '@org/database';
import { canManageOwnedAIResource, WorkspacePermission } from '@org/types';
import { runCanvasAgentSchema, validateAgentGraphSchema, type RunCanvasAgentInput } from '@org/validation';
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

  @Get(':agentId/runs')
  listRuns(@WorkspaceId() workspaceId: string, @Param('agentId') agentId: string) {
    return this.runs.listRuns(workspaceId, agentId);
  }

  @Get('runs/:runId')
  getRun(@WorkspaceId() workspaceId: string, @Param('runId') runId: string) {
    return this.runs.getRun(workspaceId, runId);
  }
}

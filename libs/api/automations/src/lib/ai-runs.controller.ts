import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AIRuntimeService } from '@org/api-agents';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, RequireWorkspacePermissions, WorkspaceId, zodBody } from '@org/api-common';
import { PrismaService } from '@org/database';
import { WorkspacePermission } from '@org/types';
import { restartRunSchema, type RestartRunInput } from '@org/validation';
import { ENGINE_CONTEXT_KEYS, WorkflowEngineService } from './workflow-engine.service.js';

/**
 * Run controls that need the workflow engine or the agent runtime — retry,
 * pause, resume and restart-from-step. The run records themselves (list,
 * get, cancel) live beside them in `@org/api-ai`, which sits below both.
 */
@Controller({ path: 'workspaces/:workspaceId/ai-executions', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIRunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
    private readonly runtime: AIRuntimeService,
  ) {}

  /**
   * Re-runs a recorded AI run with the input it started from — a workflow
   * through the engine, an agent or coworker through the runtime. The retry
   * is a new run with its own record.
   */
  @Post(':id/retry')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async retry(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const run = await this.prisma.aIExecution.findFirst({ where: { id, workspaceId } });
    if (!run) throw new NotFoundException('Run not found.');
    const state = (run.stateJson ?? {}) as Record<string, unknown>;

    if (run.entityType === 'WORKFLOW') {
      const input = Object.fromEntries(
        Object.entries(state).filter(([key]) => !ENGINE_CONTEXT_KEYS.includes(key) && !key.startsWith('__')),
      );
      const started = await this.engine.startWorkflow(run.entityId, { ...input, retryOf: run.id }, {
        mode: state['__mode'] === 'test' ? 'test' : 'live',
        startedBy: 'retry',
        userId,
      });
      return { entityType: run.entityType, status: started.status, executionId: started.runId };
    }

    if (run.entityType === 'AGENT' || run.entityType === 'COWORKER') {
      const prompt = typeof state['prompt'] === 'string' ? (state['prompt'] as string) : '';
      if (!prompt) throw new BadRequestException("This run didn't record its prompt, so it can't be retried.");
      const result = await this.runtime.executeTurn(workspaceId, run.entityId, prompt, {
        ...(typeof state['channelId'] === 'string' ? { channelId: state['channelId'] as string } : {}),
        ...(typeof state['projectId'] === 'string' ? { projectId: state['projectId'] as string } : {}),
      });
      return { entityType: run.entityType, status: 'COMPLETED', executionId: result.executionId ?? null };
    }

    throw new BadRequestException(`${run.entityType} runs can't be retried from here.`);
  }

  /** Stops a running agent or workflow after the step in progress; resumable. */
  @Post(':id/pause')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  pause(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.engine.pauseRun(workspaceId, id);
  }

  @Post(':id/resume')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  resume(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.engine.resumeRun(workspaceId, id);
  }

  /** A new run that starts at `stepId`, reusing what earlier steps produced. */
  @Post(':id/restart')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  restart(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(restartRunSchema)) body: RestartRunInput,
  ) {
    return this.engine.restartFromStep(workspaceId, id, body.stepId, userId);
  }
}

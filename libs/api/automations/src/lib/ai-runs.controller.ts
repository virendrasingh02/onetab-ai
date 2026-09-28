import {
  BadRequestException,
  Controller,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AIRuntimeService } from '@org/api-agents';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { RequireWorkspacePermissions, WorkspaceId } from '@org/api-common';
import { PrismaService } from '@org/database';
import { WorkspacePermission } from '@org/types';
import { WorkflowEngineService } from './workflow-engine.service.js';

/** Keys the engine adds to a workflow run's context; not part of the input. */
const ENGINE_CONTEXT_KEYS = ['workspaceId', 'workflowId', 'executionId', '__workflowRunId'];

/**
 * Re-runs a recorded AI run with the input it started from — a workflow
 * through the engine, an agent or coworker through the runtime. The retry is
 * a new run with its own record.
 *
 * This used to live beside the run records (`@org/api-ai`) and only inserted a
 * new row marked RUNNING that nothing ever executed. It sits here because this
 * is the library that can reach both the engine and the runtime.
 */
@Controller({ path: 'workspaces/:workspaceId/ai-executions', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIRunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
    private readonly runtime: AIRuntimeService,
  ) {}

  @Post(':id/retry')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async retry(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    const run = await this.prisma.aIExecution.findFirst({ where: { id, workspaceId } });
    if (!run) throw new NotFoundException('Run not found.');
    const state = (run.stateJson ?? {}) as Record<string, unknown>;

    if (run.entityType === 'WORKFLOW') {
      const input = Object.fromEntries(
        Object.entries(state).filter(([key]) => !ENGINE_CONTEXT_KEYS.includes(key)),
      );
      const result = await this.engine.executeWorkflow(run.entityId, { ...input, retryOf: run.id });
      return { entityType: run.entityType, status: result.status };
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
}

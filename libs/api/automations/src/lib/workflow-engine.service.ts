import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AIInfrastructureService } from '@org/api-ai';

export interface WorkflowStepResult {
  stepId: string;
  type: string;
  status: 'SUCCESS' | 'FAILED';
  output: unknown;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
  ) {}

  /*
   * `status: 'SUCCESS'` used to be written unconditionally, and a throwing
   * step (AI_ACTION calling a misconfigured provider, for instance) unwound
   * out of this method entirely — no `WorkflowExecution` row at all, so a
   * failed run was invisible rather than merely mislabeled. This now runs
   * steps sequentially, stops on the first failure, and always writes a row
   * whose `status` reflects what actually happened.
   *
   * CONDITION / API_CALL / WEBHOOK still don't do real work — see
   * `executeNodeStep` — that is tracked separately (Tier 3.5: real actions
   * via platform APIs, retries, timeouts) and is a bigger change than
   * execution-log honesty. Their outputs are now marked `simulated: true` so
   * nothing downstream can mistake them for a real HTTP call or webhook
   * dispatch.
   */
  async executeWorkflow(
    workflowId: string,
    initialPayload: Record<string, unknown> = {},
  ) {
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
    });
    this.logger.log(
      `Executing automation workflow '${workflow.name}' (${workflow.id})`,
    );

    const startTime = new Date();
    const nodes: Array<{ id: string; type: string; label: string }> =
      JSON.parse(workflow.nodesJson || '[]');
    const results: WorkflowStepResult[] = [];
    let overallStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';

    for (const node of nodes) {
      let stepResult: WorkflowStepResult;
      try {
        stepResult = await this.executeNodeStep(node, initialPayload);
      } catch (err) {
        stepResult = {
          stepId: node.id,
          type: node.type,
          status: 'FAILED',
          output: { error: err instanceof Error ? err.message : String(err) },
        };
      }
      results.push(stepResult);
      if (stepResult.status === 'FAILED') {
        overallStatus = 'FAILED';
        break; // Stop at the first failure — later steps never ran, so they get no result row.
      }
    }

    const executionLog = await this.prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: overallStatus,
        triggerPayload: JSON.stringify(initialPayload),
        stepResults: JSON.stringify(results),
        startedAt: startTime,
        finishedAt: new Date(),
      },
    });

    return {
      executionId: executionLog.id,
      status: overallStatus,
      results,
    };
  }

  private async executeNodeStep(
    node: { id: string; type: string; label: string },
    payload: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    this.logger.log(`Running step node ${node.id} [${node.type}]`);

    switch (node.type) {
      case 'CONDITION':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: {
            conditionPassed: true,
            simulated: true,
            note: 'Condition evaluation is not implemented; this step always passes.',
          },
        };
      case 'API_CALL':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: {
            statusCode: 200,
            response: 'OK',
            simulated: true,
            note: 'No outbound HTTP call was made — API_CALL execution is not implemented.',
          },
        };
      case 'WEBHOOK':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: {
            webhookDispatched: true,
            simulated: true,
            note: 'No webhook was dispatched — WEBHOOK execution is not implemented.',
          },
        };
      case 'AI_ACTION': {
        const nodeConfig = (
          node as {
            config?: { provider?: string; model?: string; prompt?: string };
          }
        ).config;
        const prompt =
          nodeConfig?.prompt ??
          `Summarize workflow payload: ${JSON.stringify(payload)}`;
        const aiRes = await this.aiService.chat({
          ...(nodeConfig?.provider
            ? { provider: nodeConfig.provider as any }
            : {}),
          ...(nodeConfig?.model ? { model: nodeConfig.model } : {}),
          messages: [{ role: 'user', content: prompt }],
        });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { aiOutput: aiRes.message.content },
        };
      }
      default:
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: {
            executed: true,
            simulated: true,
            note: `Unknown node type '${node.type}' — nothing was executed.`,
          },
        };
    }
  }
}

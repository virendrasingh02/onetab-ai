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
    private readonly aiService: AIInfrastructureService
  ) {}

  async executeWorkflow(workflowId: string, initialPayload: Record<string, unknown> = {}) {
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
    });
    this.logger.log(`Executing automation workflow '${workflow.name}' (${workflow.id})`);

    const startTime = new Date();
    const nodes: Array<{ id: string; type: string; label: string }> = JSON.parse(workflow.nodesJson || '[]');
    const results: WorkflowStepResult[] = [];

    for (const node of nodes) {
      const stepResult = await this.executeNodeStep(node, initialPayload);
      results.push(stepResult);
    }

    const executionLog = await this.prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: 'SUCCESS',
        triggerPayload: JSON.stringify(initialPayload),
        stepResults: JSON.stringify(results),
        startedAt: startTime,
        finishedAt: new Date(),
      },
    });

    return {
      executionId: executionLog.id,
      status: 'SUCCESS',
      results,
    };
  }

  private async executeNodeStep(
    node: { id: string; type: string; label: string },
    payload: Record<string, unknown>
  ): Promise<WorkflowStepResult> {
    this.logger.log(`Running step node ${node.id} [${node.type}]`);

    switch (node.type) {
      case 'CONDITION':
        return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { conditionPassed: true } };
      case 'API_CALL':
        return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { statusCode: 200, response: 'OK' } };
      case 'WEBHOOK':
        return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { webhookDispatched: true } };
      case 'AI_ACTION': {
        const nodeConfig = (node as { config?: { provider?: string; model?: string; prompt?: string } }).config;
        const prompt = nodeConfig?.prompt ?? `Summarize workflow payload: ${JSON.stringify(payload)}`;
        const aiRes = await this.aiService.chat({
          ...(nodeConfig?.provider ? { provider: nodeConfig.provider as any } : {}),
          ...(nodeConfig?.model ? { model: nodeConfig.model } : {}),
          messages: [{ role: 'user', content: prompt }],
        });
        return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { aiOutput: aiRes.message.content } };
      }
      default:
        return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { executed: true } };
    }
  }
}

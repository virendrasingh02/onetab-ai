import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppEvent, isCronDue, type WorkflowApprovalDecidedEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { WorkflowEngineService } from './workflow-engine.service.js';
import { normalizeWorkflowNodes } from './workflow-graph.js';

/** The cron expression on a workflow's trigger node, if it has one. */
export function workflowCronExpression(nodesJson: string): string | null {
  let raw: unknown;
  try {
    raw = JSON.parse(nodesJson);
  } catch {
    return null;
  }
  const trigger = normalizeWorkflowNodes(raw).find((n) => n.type === 'TRIGGER' || n.type === 'START');
  const cron = trigger?.config['cron'] ?? trigger?.config['cronExpression'] ?? trigger?.config['expression'];
  return typeof cron === 'string' && cron.trim() ? cron.trim() : null;
}

/**
 * The two ways a workflow runs without someone pressing Run:
 *  - a CRON trigger — a workflow saved with `triggerType: 'CRON'` fires when
 *    its trigger node's expression matches the current minute. The builder
 *    offered CRON triggers before, but nothing ever ran them;
 *  - resuming after a human-approval step is decided (`resumeAfterApproval`).
 */
@Injectable()
export class WorkflowScheduleListener {
  private readonly logger = new Logger(WorkflowScheduleListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'workflow-cron-sweep' })
  async sweep(): Promise<void> {
    const now = new Date();
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { isActive: true, triggerType: 'CRON' },
      select: { id: true, name: true, nodesJson: true },
    });
    const due = workflows.filter((w) => {
      const cron = workflowCronExpression(w.nodesJson);
      return !!cron && isCronDue(cron, now);
    });
    for (const workflow of due) {
      this.engine
        .executeWorkflow(workflow.id, { trigger: 'CRON', firedAt: now.toISOString() })
        .catch((error) =>
          this.logger.warn(`Scheduled workflow '${workflow.name}' (${workflow.id}) failed: ${String(error)}`),
        );
    }
    if (due.length) this.logger.log(`Fired ${due.length} scheduled workflow run(s).`);
  }

  @OnEvent(AppEvent.WorkflowApprovalDecided)
  async onApprovalDecided(event: WorkflowApprovalDecidedEvent): Promise<void> {
    try {
      const outcome = await this.engine.resumeAfterApproval(event);
      if (outcome) {
        this.logger.log(
          `Workflow ${event.workflowId} run ${event.executionId} ${event.decision.toLowerCase()} → ${outcome.status}`,
        );
      }
    } catch (error) {
      this.logger.error(`Resuming workflow ${event.workflowId} after approval failed: ${String(error)}`);
    }
  }
}

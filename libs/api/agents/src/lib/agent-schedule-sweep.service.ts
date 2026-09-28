import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronDue } from '@org/api-common';
import { PrismaService } from '@org/database';
import { AgentOutputDeliveryService } from './agent-output-delivery.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';

/**
 * Fires an Agent/Coworker's turn when one of its `AgentSchedule` rows'
 * cron expression matches the current minute — the previously-dead
 * `AgentSchedule` model (created via `AIEntitiesController`'s schedule
 * endpoints, never before consumed anywhere) now actually drives runs.
 * Follows the same fixed-cadence-sweep shape as
 * `ChannelAutoArchiveService`/`ChannelMembershipExpiryService` rather than
 * introducing a job queue.
 */
@Injectable()
export class AgentScheduleSweepService {
  private readonly logger = new Logger(AgentScheduleSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AIRuntimeService,
    private readonly delivery: AgentOutputDeliveryService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'agent-schedule-sweep' })
  async sweep(): Promise<void> {
    const now = new Date();
    const schedules = await this.prisma.agentSchedule.findMany({
      where: { isActive: true, agent: { isActive: true } },
      select: {
        id: true,
        cronExpression: true,
        description: true,
        agent: {
          select: {
            id: true,
            type: true,
            workspaceId: true,
            name: true,
            creatorId: true,
            matrixUserId: true,
            configuration: true,
          },
        },
      },
    });

    const due = schedules.filter((s) => isCronDue(s.cronExpression, now));
    if (due.length === 0) return;

    for (const schedule of due) {
      const promptText = schedule.description?.trim()
        ? `Perform your scheduled task: ${schedule.description}`
        : 'Perform your scheduled check-in.';

      const task = schedule.description?.trim() || 'Scheduled check-in';
      this.runtime
        .executeTurn(schedule.agent.workspaceId, schedule.agent.id, promptText)
        // Where the builder said a scheduled result goes (channel, task,
        // webhook) — without this a scheduled run's answer went nowhere.
        .then((run) => this.delivery.deliver(schedule.agent, run, task))
        .then((notes) => {
          if (notes.length) {
            this.logger.log(`Delivered scheduled run of '${schedule.agent.name}': ${notes.join('; ')}`);
          }
        })
        .catch((error) => {
          this.logger.error(
            `Scheduled run failed for agent '${schedule.agent.name}' (${schedule.agent.id}, schedule ${schedule.id}): ${String(error)}`,
          );
        });
    }

    this.logger.log(`Fired ${due.length} scheduled agent run(s).`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';
import { AIRuntimeService } from './ai-runtime.service.js';

/** Matches one 5-field cron subexpression — a wildcard, a comma list, a
 *  range, a step (every N units), or a combination — against a single
 *  calendar value. No external cron-parsing dependency — the field grammar
 *  this supports covers every expression the Agent Builder's schedule
 *  picker can produce. */
function matchesCronField(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step <= 0) return false;

    if (range === '*') {
      return value % step === 0;
    }
    if (range.includes('-')) {
      const [startRaw, endRaw] = range.split('-');
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    return Number(range) === value;
  });
}

function isCronDue(expression: string, at: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  return (
    matchesCronField(minute, at.getMinutes()) &&
    matchesCronField(hour, at.getHours()) &&
    matchesCronField(dayOfMonth, at.getDate()) &&
    matchesCronField(month, at.getMonth() + 1) &&
    matchesCronField(dayOfWeek, at.getDay())
  );
}

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
        agent: { select: { id: true, workspaceId: true, name: true } },
      },
    });

    const due = schedules.filter((s) => isCronDue(s.cronExpression, now));
    if (due.length === 0) return;

    for (const schedule of due) {
      const promptText = schedule.description?.trim()
        ? `Perform your scheduled task: ${schedule.description}`
        : 'Perform your scheduled check-in.';

      this.runtime
        .executeTurn(schedule.agent.workspaceId, schedule.agent.id, promptText)
        .catch((error) => {
          this.logger.error(
            `Scheduled run failed for agent '${schedule.agent.name}' (${schedule.agent.id}, schedule ${schedule.id}): ${String(error)}`,
          );
        });
    }

    this.logger.log(`Fired ${due.length} scheduled agent run(s).`);
  }
}

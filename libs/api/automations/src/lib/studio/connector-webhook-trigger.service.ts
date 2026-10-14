import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type ConnectorEventReceivedEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { WorkflowEngineService } from '../workflow-engine.service.js';
import { CanvasAgentRunService } from './canvas-agent-run.service.js';
import { fireBudget } from './connector-trigger-poller.service.js';

/**
 * Starts switched-on canvas agents when a connected app pushes an event
 * (`ConnectorWebhookService` has already verified and de-duplicated it).
 *
 * An agent reacts only to events from a connection it may use — one in its
 * workspace, or its owner's own personal one — and shares the poller's hourly
 * cap, so an agent that triggers its own event cannot loop.
 */
@Injectable()
export class ConnectorWebhookTriggerService {
  private readonly logger = new Logger(ConnectorWebhookTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
    private readonly canvasAgents: CanvasAgentRunService,
  ) {}

  @OnEvent(AppEvent.ConnectorEventReceived, { async: true })
  async onEvent(event: ConnectorEventReceivedEvent): Promise<number> {
    try {
      return await this.start(event, new Date());
    } catch (error) {
      this.logger.warn(`Starting agents for a ${event.provider} ${event.triggerId} event failed: ${String(error)}`);
      return 0;
    }
  }

  async start(event: ConnectorEventReceivedEvent, now: Date): Promise<number> {
    const agents = await this.canvasAgents.activeAppTriggers();
    let started = 0;
    for (const entry of agents) {
      if (entry.trigger.provider !== event.provider || entry.trigger.triggerId !== event.triggerId) continue;
      const mayUse = event.ownerUserId ? entry.agent.creatorId === event.ownerUserId : entry.workspaceId === event.workspaceId;
      if (!mayUse) continue;

      const state = await this.prisma.connectorTriggerState.findUnique({ where: { workflowId: entry.workflowId } });
      const budget = fireBudget(state, now);
      if (budget.allowed < 1) {
        await this.record(entry, event, budget, 0, now, 'Skipped an event: this agent may start at most 30 runs an hour.');
        continue;
      }
      await this.canvasAgents.sync(entry.agent, entry.compiled);
      try {
        await this.engine.startWorkflow(
          entry.workflowId,
          {
            trigger: 'APP_EVENT',
            connector: { provider: event.provider, triggerId: event.triggerId },
            event: event.item,
            message: `${event.provider} ${event.triggerId.replace(/_/g, ' ')}`,
          },
          { startedBy: 'event', limits: entry.compiled.limits },
        );
        started += 1;
        await this.record(entry, event, budget, 1, now, null);
      } catch (error) {
        this.logger.warn(`Starting '${entry.agent.name}' for a ${event.provider} event failed: ${String(error)}`);
        await this.record(entry, event, budget, 0, now, `Starting the agent failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return started;
  }

  private async record(
    entry: Awaited<ReturnType<CanvasAgentRunService['activeAppTriggers']>>[number],
    event: ConnectorEventReceivedEvent,
    budget: ReturnType<typeof fireBudget>,
    fired: number,
    now: Date,
    lastError: string | null,
  ) {
    const data = {
      workflowId: entry.workflowId,
      workspaceId: entry.workspaceId,
      provider: event.provider,
      triggerId: event.triggerId,
      configKey: `${event.provider}:${event.triggerId}:webhook`,
      lastError,
      windowStartAt: budget.windowStartAt,
      firedInWindow: budget.firedInWindow + fired,
      ...(fired ? { lastFiredAt: now } : {}),
    };
    await this.prisma.connectorTriggerState.upsert({ where: { workflowId: entry.workflowId }, create: data, update: data });
  }
}

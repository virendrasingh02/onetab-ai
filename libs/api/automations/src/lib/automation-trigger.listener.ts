import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AppEvent,
  MAX_AGENT_TRIGGER_DEPTH,
  currentAgentRun,
  type AppEventName,
  type ChannelMessagePostedEvent,
  type TaskOverdueEvent,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import { WorkflowEngineService } from './workflow-engine.service.js';
import { normalizeWorkflowNodes } from './workflow-graph.js';

/** How often overdue tasks are looked for; each sweep covers the window since the last. */
const OVERDUE_SWEEP_MS = 60 * 60_000;

/** What the trigger node narrows an event to (a channel, a project). */
export function triggerFilter(nodesJson: string): { channelId?: string; projectId?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(nodesJson);
  } catch {
    return {};
  }
  const trigger = normalizeWorkflowNodes(raw).find((n) => n.type === 'TRIGGER' || n.type === 'START');
  const filter = trigger?.config['filter'];
  if (!filter || typeof filter !== 'object') return {};
  const { channelId, projectId } = filter as Record<string, unknown>;
  return {
    ...(typeof channelId === 'string' && channelId ? { channelId } : {}),
    ...(typeof projectId === 'string' && projectId ? { projectId } : {}),
  };
}

/**
 * Runs workflows — and Studio agents, which are workflows — off the app event
 * bus.
 *
 * A workflow's `triggerType` is matched against the domain event name
 * (`task.created`, `meeting.ended`, `channel.message`, …). Runs are started
 * best-effort and never block the request that emitted the event.
 *
 * Two guards keep agents from feeding themselves: an event raised inside an
 * agent run never re-triggers that same workflow, and chains of agents
 * triggering agents stop at {@link MAX_AGENT_TRIGGER_DEPTH}. A channel-message
 * trigger only fires for the channel it names, and only when the agent's
 * owner is a member of it — an agent cannot read a channel its owner cannot.
 */
@Injectable()
export class AutomationTriggerListener {
  private readonly logger = new Logger(AutomationTriggerListener.name);
  private lastOverdueSweep = new Date(Date.now() - OVERDUE_SWEEP_MS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
  ) {}

  @OnEvent(AppEvent.TaskCreated)
  onTaskCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.TaskCreated, e);
  }

  @OnEvent(AppEvent.TaskAssigned)
  onTaskAssigned(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.TaskAssigned, e);
  }

  @OnEvent(AppEvent.TaskCompleted)
  onTaskCompleted(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.TaskCompleted, e);
  }

  @OnEvent(AppEvent.TaskOverdue)
  onTaskOverdue(e: TaskOverdueEvent) {
    void this.dispatch(AppEvent.TaskOverdue, e as unknown as Record<string, unknown> & { workspaceId: string });
  }

  @OnEvent(AppEvent.ProjectCreated)
  onProjectCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.ProjectCreated, e);
  }

  @OnEvent(AppEvent.ProjectUpdated)
  onProjectUpdated(e: Record<string, unknown> & { workspaceId: string }) {
    // "When a project changes status" — a rename is not a status change.
    if (e['statusChanged'] !== true) return;
    void this.dispatch(AppEvent.ProjectUpdated, e);
  }

  @OnEvent(AppEvent.DocumentCreated)
  onDocumentCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.DocumentCreated, e);
  }

  @OnEvent(AppEvent.DocumentUpdated)
  onDocumentUpdated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.DocumentUpdated, e);
  }

  @OnEvent(AppEvent.ChannelCreated)
  onChannelCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.ChannelCreated, e);
  }

  @OnEvent(AppEvent.MeetingEnded)
  onMeetingEnded(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.MeetingEnded, e);
  }

  /**
   * Coworker outcomes, so a process can continue from one coworker's result
   * (Tracker finds overdue work → a workflow follows up). Test runs never
   * reach here — `dispatch` drops events raised inside a test run.
   */
  @OnEvent(AppEvent.CoworkerCompleted)
  onCoworkerCompleted(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.CoworkerCompleted, e);
  }

  @OnEvent(AppEvent.CoworkerFailed)
  onCoworkerFailed(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.CoworkerFailed, e);
  }

  @OnEvent(AppEvent.CoworkerMonitorTriggered)
  onCoworkerMonitorTriggered(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.CoworkerMonitorTriggered, e);
  }

  @OnEvent(AppEvent.ChannelMessagePosted)
  onChannelMessage(e: ChannelMessagePostedEvent) {
    void this.dispatch(AppEvent.ChannelMessagePosted, e as unknown as Record<string, unknown> & { workspaceId: string });
  }

  /**
   * Emits `task.overdue` for open tasks whose due date passed since the last
   * sweep — once per task, with no state to keep: each sweep only looks at
   * the window since the previous one.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'task-overdue-sweep' })
  async sweepOverdue(): Promise<void> {
    const since = this.lastOverdueSweep;
    const until = new Date();
    this.lastOverdueSweep = until;
    // Only worth the query when something listens for it.
    const listening = await this.prisma.automationWorkflow.count({
      where: { isActive: true, archivedAt: null, triggerType: AppEvent.TaskOverdue },
    });
    if (listening === 0) return;
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        dueDate: { gte: since, lt: until },
      },
      select: { id: true, workspaceId: true, title: true, identifier: true, projectId: true, dueDate: true, assigneeIds: true },
      take: 500,
    });
    for (const task of tasks) {
      const event: TaskOverdueEvent = {
        workspaceId: task.workspaceId,
        actorId: null,
        taskId: task.id,
        title: task.title,
        identifier: task.identifier,
        projectId: task.projectId,
        dueDate: task.dueDate!.toISOString(),
        assigneeIds: task.assigneeIds,
      };
      void this.dispatch(AppEvent.TaskOverdue, event as unknown as Record<string, unknown> & { workspaceId: string });
    }
  }

  private async dispatch(
    trigger: AppEventName,
    payload: Record<string, unknown> & { workspaceId: string },
  ): Promise<void> {
    const origin = currentAgentRun();
    const depth = origin ? origin.depth + 1 : 0;
    if (origin?.test) return;
    if (depth > MAX_AGENT_TRIGGER_DEPTH) {
      this.logger.warn(`Not starting agents for '${trigger}': ${depth} agents deep already (from run ${origin?.runId}).`);
      return;
    }

    let workflows: Array<{ id: string; name: string; nodesJson: string; creatorId: string | null }>;
    try {
      workflows = await this.prisma.automationWorkflow.findMany({
        where: {
          workspaceId: payload.workspaceId,
          isActive: true,
          archivedAt: null,
          triggerType: trigger,
          // An agent's own actions never start it again.
          ...(origin ? { id: { not: origin.workflowId } } : {}),
        },
        select: { id: true, name: true, nodesJson: true, creatorId: true },
      });
    } catch (err) {
      this.logger.warn(
        `Trigger lookup failed for '${trigger}': ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    for (const workflow of workflows) {
      try {
        if (!(await this.matchesFilter(trigger, workflow, payload))) continue;
        await this.engine.executeWorkflow(
          workflow.id,
          // `event` is the whole payload under one name for Studio agents
          // (`{{event.title}}`); the root spread keeps canvas workflows'
          // `{{title}}` references working.
          { trigger, ...payload, event: payload },
          { startedBy: 'event', depth },
        );
        this.logger.log(
          `Ran workflow '${workflow.name}' (${workflow.id}) for '${trigger}'`,
        );
      } catch (err) {
        // The engine already writes a FAILED execution row; this is just noise
        // suppression so one bad workflow does not take down the listener.
        this.logger.warn(
          `Workflow '${workflow.id}' errored on '${trigger}': ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private async matchesFilter(
    trigger: AppEventName,
    workflow: { nodesJson: string; creatorId: string | null },
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const filter = triggerFilter(workflow.nodesJson);
    if (trigger === AppEvent.ChannelMessagePosted) {
      // A message trigger must name its channel, and the agent's owner must
      // be in it — otherwise it would read messages its owner cannot.
      if (!filter.channelId || filter.channelId !== payload['channelId'] || !workflow.creatorId) return false;
      // Messages from bots (agents, system events) come back through Matrix
      // outside any run scope; ignoring them is what stops an agent that
      // posts to a channel from triggering itself on its own message.
      if (!payload['senderId']) return false;
      const member = await this.prisma.channelMember.findFirst({
        where: { channelId: filter.channelId, userId: workflow.creatorId },
        select: { id: true },
      });
      return !!member;
    }
    if (filter.projectId && filter.projectId !== payload['projectId']) return false;
    if (filter.channelId && filter.channelId !== payload['channelId']) return false;
    return true;
  }
}

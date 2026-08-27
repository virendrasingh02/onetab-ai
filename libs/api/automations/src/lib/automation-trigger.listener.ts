import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type AppEventName } from '@org/api-common';
import { PrismaService } from '@org/database';
import { WorkflowEngineService } from './workflow-engine.service.js';

/**
 * Runs workflows off the app event bus.
 *
 * A workflow's `triggerType` is matched against the domain event name
 * (`task.created`, `project.created`, …). Before this, the only way to run a
 * workflow was a manual `POST .../trigger` — `triggerType` was stored and never
 * consulted (audit §16). Runs are fired best-effort and never block the request
 * that emitted the event.
 */
@Injectable()
export class AutomationTriggerListener {
  private readonly logger = new Logger(AutomationTriggerListener.name);

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

  @OnEvent(AppEvent.ProjectCreated)
  onProjectCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.ProjectCreated, e);
  }

  @OnEvent(AppEvent.DocumentCreated)
  onDocumentCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.DocumentCreated, e);
  }

  @OnEvent(AppEvent.ChannelCreated)
  onChannelCreated(e: Record<string, unknown> & { workspaceId: string }) {
    void this.dispatch(AppEvent.ChannelCreated, e);
  }

  private async dispatch(
    trigger: AppEventName,
    payload: Record<string, unknown> & { workspaceId: string },
  ): Promise<void> {
    let workflows: Array<{ id: string; name: string }>;
    try {
      workflows = await this.prisma.automationWorkflow.findMany({
        where: {
          workspaceId: payload.workspaceId,
          isActive: true,
          triggerType: trigger,
        },
        select: { id: true, name: true },
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
        await this.engine.executeWorkflow(workflow.id, { trigger, ...payload });
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
}

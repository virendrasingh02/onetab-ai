import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  CANVAS_AGENT_TRIGGER,
  type AutomationCatalogItem,
  type AutomationErrorGroup,
  type AutomationOverviewData,
  type AutomationScheduleItem,
} from '@org/types';
import { nextCronRun } from '@org/utils';
import { WorkflowEngineService } from './workflow-engine.service.js';
import { normalizeWorkflowNodes } from './workflow-graph.js';
import { workflowSchedule } from './workflow-schedule.listener.js';
import { classifyStepError } from './run-support.js';

/** What a graph's trigger node says starts it: MANUAL, CRON or an event name. */
export function triggerTypeFromNodes(nodesJson: string): string | null {
  let raw: unknown;
  try {
    raw = JSON.parse(nodesJson);
  } catch {
    return null;
  }
  const trigger = normalizeWorkflowNodes(raw).find((n) => n.type === 'TRIGGER' || n.type === 'START');
  if (!trigger) return null;
  const kind = String(trigger.config['triggerKind'] ?? '').toUpperCase();
  if (kind === 'CRON') return 'CRON';
  if (kind === 'EVENT' && typeof trigger.config['event'] === 'string') return trigger.config['event'] as string;
  if (kind === 'MANUAL') return 'MANUAL';
  return null;
}

/**
 * Workflows belong to a workspace, so every lookup is filtered by it — a
 * workflow id supplied by the caller is not proof they may run it.
 */
@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService
  ) {}

  async getWorkflows(workspaceId: string) {
    return this.prisma.automationWorkflow.findMany({
      where: { workspaceId, triggerType: { not: CANVAS_AGENT_TRIGGER } },
      include: { _count: { select: { executions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createWorkflow(
    workspaceId: string,
    creatorId: string,
    data: {
      name: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.automationWorkflow.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType ?? 'WEBHOOK',
        nodesJson: data.nodesJson ?? '[]',
        edgesJson: data.edgesJson ?? '[]',
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async updateWorkflow(
    workspaceId: string,
    workflowId: string,
    data: {
      name?: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
      isActive?: boolean;
    },
  ) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.triggerType !== undefined
          ? { triggerType: data.triggerType }
          : {}),
        ...(data.nodesJson !== undefined ? { nodesJson: data.nodesJson } : {}),
        ...(data.edgesJson !== undefined ? { edgesJson: data.edgesJson } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteWorkflow(workspaceId: string, workflowId: string): Promise<void> {
    await this.assertWorkflow(workspaceId, workflowId);
    await this.prisma.automationWorkflow.delete({ where: { id: workflowId } });
  }

  async triggerWorkflow(
    workspaceId: string,
    workflowId: string,
    payload: Record<string, unknown> = {},
  ) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.workflowEngine.executeWorkflow(workflowId, payload);
  }

  async getExecutions(workspaceId: string, workflowId: string) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Recent executions across every workflow in the workspace.
   *
   * Scoped by the parent workflow's workspace — the logs screen is
   * workspace-wide, so there is no workflow id to check against.
   */
  async getWorkspaceExecutions(workspaceId: string, take = 50) {
    return this.prisma.workflowExecution.findMany({
      where: { workflow: { workspaceId } },
      include: {
        workflow: { select: { id: true, name: true, triggerType: true } },
      },
      orderBy: { startedAt: 'desc' },
      take,
    });
  }

  async getWorkflow(workspaceId: string, workflowId: string) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: { _count: { select: { executions: true } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found.');
    return workflow;
  }

  async listVersions(workspaceId: string, workflowId: string) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.prisma.aIWorkflowVersion.findMany({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        name: true,
        changeSummary: true,
        isPublished: true,
        createdAt: true,
      },
    });
  }

  /**
   * An immutable copy of the workflow's current graph. Publishing is a
   * snapshot marked published that also switches the workflow on, so what
   * triggers run is always a version someone can roll back to.
   */
  async snapshot(
    workspaceId: string,
    workflowId: string,
    options: { summary?: string; publish?: boolean } = {},
  ) {
    const workflow = await this.getWorkflow(workspaceId, workflowId);
    const latest = await this.prisma.aIWorkflowVersion.findFirst({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const version = await this.prisma.aIWorkflowVersion.create({
      data: {
        workflowId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        name: workflow.name,
        description: workflow.description,
        nodesJson: workflow.nodesJson,
        edgesJson: workflow.edgesJson,
        // The plan and its granted permissions roll back with the graph.
        ...(workflow.agentProfile ? { agentProfile: workflow.agentProfile as object } : {}),
        changeSummary: options.summary?.trim() || (options.publish ? 'Published' : 'Snapshot'),
        isPublished: !!options.publish,
      },
    });
    if (options.publish && !workflow.isActive) {
      await this.prisma.automationWorkflow.update({
        where: { id: workflowId },
        data: { isActive: true },
      });
    }
    return version;
  }

  async restoreVersion(workspaceId: string, workflowId: string, versionNumber: number) {
    await this.assertWorkflow(workspaceId, workflowId);
    const version = await this.prisma.aIWorkflowVersion.findUnique({
      where: { workflowId_versionNumber: { workflowId, versionNumber } },
    });
    if (!version) throw new NotFoundException(`Version ${versionNumber} not found.`);
    return this.prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: {
        nodesJson: version.nodesJson,
        edgesJson: version.edgesJson,
        // The trigger lives in the graph; keep the column that schedules and
        // event dispatch read in step with the version being restored.
        triggerType: triggerTypeFromNodes(version.nodesJson) ?? undefined,
        ...(version.agentProfile ? { agentProfile: version.agentProfile as object } : {}),
      },
    });
  }

  async getAutomationOverview(workspaceId: string): Promise<AutomationOverviewData> {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { workspaceId, triggerType: { not: CANVAS_AGENT_TRIGGER } },
      select: {
        id: true,
        name: true,
        triggerType: true,
        isActive: true,
        archivedAt: true,
        nodesJson: true,
        updatedAt: true,
      },
    });

    const totalWorkflows = workflows.length;
    const activeWorkflows = workflows.filter((w) => w.isActive && !w.archivedAt).length;
    const pausedWorkflows = workflows.filter((w) => !w.isActive && !w.archivedAt).length;

    const executions = await this.prisma.workflowExecution.findMany({
      where: { workflow: { workspaceId } },
      include: {
        workflow: { select: { id: true, name: true, triggerType: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 1000,
    });

    const runningExecutions = await this.prisma.aIExecution.count({
      where: { workspaceId, status: 'RUNNING' },
    });

    const pendingApprovalsCount = await this.prisma.approvalRequest.count({
      where: { workspaceId, state: 'PENDING' },
    });

    const successfulExecutions = executions.filter((e) => e.status === 'SUCCESS').length;
    const failedExecutions = executions.filter((e) => e.status === 'FAILED').length;
    const totalExecutions = executions.length;
    const successRate = totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 1000) / 10
      : 100;

    const durations = executions
      .map((e) => Math.max(0, new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime()))
      .sort((a, b) => a - b);
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((acc, d) => acc + d, 0) / durations.length)
      : 0;
    const p50DurationMs = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] ?? 0 : 0;
    const p95DurationMs = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] ?? 0 : 0;

    // Daily volume for the last 14 days
    const now = new Date();
    const dayMap = new Map<string, { success: number; failed: number; total: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { success: 0, failed: 0, total: 0 });
    }
    for (const e of executions) {
      const key = new Date(e.startedAt).toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) {
        entry.total += 1;
        if (e.status === 'SUCCESS') entry.success += 1;
        else if (e.status === 'FAILED') entry.failed += 1;
      }
    }
    const volumeByDay = Array.from(dayMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // Workflow metrics aggregation
    const wfMap = new Map<string, {
      id: string;
      name: string;
      triggerType: string;
      total: number;
      failed: number;
      durations: number[];
      lastExecutedAt: Date | null;
      lastError: string | null;
      lastFailedAt: Date | null;
    }>();

    for (const wf of workflows) {
      wfMap.set(wf.id, {
        id: wf.id,
        name: wf.name,
        triggerType: wf.triggerType,
        total: 0,
        failed: 0,
        durations: [],
        lastExecutedAt: null,
        lastError: null,
        lastFailedAt: null,
      });
    }

    for (const e of executions) {
      let wfData = wfMap.get(e.workflowId);
      if (!wfData) {
        wfData = {
          id: e.workflow.id,
          name: e.workflow.name,
          triggerType: e.workflow.triggerType,
          total: 0,
          failed: 0,
          durations: [],
          lastExecutedAt: null,
          lastError: null,
          lastFailedAt: null,
        };
        wfMap.set(e.workflowId, wfData);
      }
      wfData.total += 1;
      const dur = Math.max(0, new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime());
      wfData.durations.push(dur);
      const started = new Date(e.startedAt);
      if (!wfData.lastExecutedAt || started > wfData.lastExecutedAt) {
        wfData.lastExecutedAt = started;
      }
      if (e.status === 'FAILED') {
        wfData.failed += 1;
        if (!wfData.lastFailedAt || started > wfData.lastFailedAt) {
          wfData.lastFailedAt = started;
          try {
            const steps = JSON.parse(e.stepResults);
            const failedStep = Array.isArray(steps) ? steps.find((s) => s.status === 'FAILED') : null;
            if (failedStep?.output && typeof failedStep.output === 'object') {
              wfData.lastError = String((failedStep.output as Record<string, unknown>)['error'] || 'Execution failed');
            }
          } catch {
            wfData.lastError = 'Execution failed';
          }
        }
      }
    }

    const allWfMetrics = Array.from(wfMap.values()).map((w) => ({
      id: w.id,
      name: w.name,
      triggerType: w.triggerType,
      executionsCount: w.total,
      failureRate: w.total > 0 ? Math.round((w.failed / w.total) * 1000) / 10 : 0,
      avgDurationMs: w.durations.length > 0 ? Math.round(w.durations.reduce((a, b) => a + b, 0) / w.durations.length) : 0,
      lastExecutedAt: w.lastExecutedAt ? w.lastExecutedAt.toISOString() : null,
    }));

    const topWorkflows = [...allWfMetrics]
      .sort((a, b) => b.executionsCount - a.executionsCount)
      .slice(0, 5);

    const failingWorkflows = Array.from(wfMap.values())
      .filter((w) => w.failed > 0)
      .map((w) => ({
        id: w.id,
        name: w.name,
        failCount: w.failed,
        failureRate: w.total > 0 ? Math.round((w.failed / w.total) * 1000) / 10 : 0,
        lastError: w.lastError,
        lastFailedAt: w.lastFailedAt ? w.lastFailedAt.toISOString() : null,
      }))
      .sort((a, b) => b.failureRate - a.failureRate || b.failCount - a.failCount)
      .slice(0, 5);

    // Upcoming scheduled runs
    const upcomingScheduled: AutomationScheduleItem[] = [];
    for (const w of workflows) {
      if (!w.isActive || w.archivedAt) continue;
      const sched = workflowSchedule(w.nodesJson);
      if (sched?.cron) {
        const next = nextCronRun(sched.cron, now, sched.timezone);
        upcomingScheduled.push({
          workflowId: w.id,
          name: w.name,
          triggerType: 'CRON',
          cron: sched.cron,
          timezone: sched.timezone,
          isActive: true,
          lastRunAt: wfMap.get(w.id)?.lastExecutedAt?.toISOString() ?? null,
          nextRunAt: next ? next.toISOString() : null,
          humanSchedule: humanizeCron(sched.cron),
        });
      }
    }
    upcomingScheduled.sort((a, b) => {
      if (!a.nextRunAt) return 1;
      if (!b.nextRunAt) return -1;
      return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
    });

    // Connector health
    const integrations = await this.prisma.externalIntegration.findMany({
      where: { workspaceId },
      select: { provider: true, status: true },
    });
    const connectorMap = new Map<string, { status: string; count: number }>();
    for (const intg of integrations) {
      const existing = connectorMap.get(intg.provider);
      if (existing) {
        existing.count += 1;
        if (intg.status === 'CONNECTED') existing.status = 'CONNECTED';
      } else {
        connectorMap.set(intg.provider, { status: intg.status, count: 1 });
      }
    }
    const connectorHealth = Array.from(connectorMap.entries()).map(([provider, info]) => ({
      provider,
      name: provider.charAt(0) + provider.slice(1).toLowerCase().replace(/_/g, ' '),
      status: info.status,
      connectedCount: info.count,
      totalTriggers: 2,
      totalActions: 4,
    }));

    const estimatedTimeSavedHours = Math.round(successfulExecutions * 0.15 * 10) / 10;

    return {
      totalWorkflows,
      activeWorkflows,
      pausedWorkflows,
      runningExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      avgDurationMs,
      p50DurationMs,
      p95DurationMs,
      estimatedTimeSavedHours,
      volumeByDay,
      topWorkflows,
      failingWorkflows,
      upcomingScheduled: upcomingScheduled.slice(0, 5),
      pendingApprovalsCount,
      connectorHealth,
      recentExecutions: executions.slice(0, 10).map((e) => ({
        id: e.id,
        workflowId: e.workflowId,
        status: e.status,
        triggerPayload: e.triggerPayload,
        stepResults: e.stepResults,
        startedAt: e.startedAt.toISOString(),
        finishedAt: e.finishedAt.toISOString(),
        workflow: {
          id: e.workflow.id,
          name: e.workflow.name,
          triggerType: e.workflow.triggerType,
        },
      })),
    };
  }

  async getSchedules(workspaceId: string): Promise<AutomationScheduleItem[]> {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { workspaceId, archivedAt: null, triggerType: { not: CANVAS_AGENT_TRIGGER } },
      select: { id: true, name: true, triggerType: true, isActive: true, nodesJson: true },
    });

    const now = new Date();
    const schedules: AutomationScheduleItem[] = [];

    for (const w of workflows) {
      const sched = workflowSchedule(w.nodesJson);
      if (!sched?.cron && w.triggerType !== 'CRON') continue;
      const cron = sched?.cron ?? '0 9 * * 1-5';
      const timezone = sched?.timezone ?? null;
      const next = w.isActive ? nextCronRun(cron, now, timezone) : null;

      const lastExecution = await this.prisma.workflowExecution.findFirst({
        where: { workflowId: w.id },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });

      schedules.push({
        workflowId: w.id,
        name: w.name,
        triggerType: 'CRON',
        cron,
        timezone,
        isActive: w.isActive,
        lastRunAt: lastExecution ? lastExecution.startedAt.toISOString() : null,
        nextRunAt: next ? next.toISOString() : null,
        humanSchedule: humanizeCron(cron),
      });
    }

    return schedules.sort((a, b) => {
      if (!a.nextRunAt) return 1;
      if (!b.nextRunAt) return -1;
      return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
    });
  }

  async triggerWebhook(
    workspaceId: string,
    workflowId: string,
    payload: Record<string, unknown> = {},
    secretHeader?: string,
  ) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found.');
    if (workflow.archivedAt) throw new BadRequestException('Archived workflows cannot be triggered.');
    if (!workflow.isActive) throw new BadRequestException('This workflow is currently paused.');

    let raw: unknown;
    try {
      raw = JSON.parse(workflow.nodesJson);
    } catch {
      raw = [];
    }
    const trigger = normalizeWorkflowNodes(raw).find((n) => n.type === 'TRIGGER' || n.type === 'START');
    const configuredSecret = trigger?.config['secret'] ?? trigger?.config['webhookSecret'];
    if (typeof configuredSecret === 'string' && configuredSecret.trim()) {
      if (!secretHeader || secretHeader.trim() !== configuredSecret.trim()) {
        throw new UnauthorizedException('Invalid or missing webhook secret header.');
      }
    }

    const result = await this.workflowEngine.executeWorkflow(
      workflowId,
      {
        ...payload,
        source: 'webhook',
        triggeredAt: new Date().toISOString(),
      },
      { startedBy: 'webhook' },
    );

    return {
      executionId: result.runId ?? (result as any).executionId ?? '',
      status: result.status,
      triggeredAt: new Date().toISOString(),
    };
  }

  async getErrorMonitoring(workspaceId: string, take = 50): Promise<AutomationErrorGroup[]> {
    const failed = await this.prisma.workflowExecution.findMany({
      where: { workflow: { workspaceId }, status: 'FAILED' },
      include: { workflow: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take,
    });

    const groupMap = new Map<string, {
      count: number;
      latestError: string;
      latestOccurredAt: Date;
      workflows: Map<string, string>;
    }>();

    for (const e of failed) {
      let errMsg = 'Workflow execution failed';
      try {
        const steps = JSON.parse(e.stepResults);
        if (Array.isArray(steps)) {
          const failedStep = steps.find((s) => s.status === 'FAILED');
          if (failedStep) {
            const stepErr =
              failedStep.error ||
              (failedStep.output && typeof failedStep.output === 'object'
                ? (failedStep.output as Record<string, unknown>)['error']
                : null);
            if (stepErr) errMsg = String(stepErr);
          }
        }
      } catch {
        // fallback
      }

      const classified = classifyStepError(errMsg);
      const code = classified.code;
      const started = e.startedAt
        ? new Date(e.startedAt)
        : e.finishedAt
          ? new Date(e.finishedAt)
          : new Date();

      let group = groupMap.get(code);
      if (!group) {
        group = {
          count: 0,
          latestError: errMsg,
          latestOccurredAt: started,
          workflows: new Map(),
        };
        groupMap.set(code, group);
      }
      group.count += 1;
      if (started > group.latestOccurredAt) {
        group.latestOccurredAt = started;
        group.latestError = errMsg;
      }
      group.workflows.set(e.workflow.id, e.workflow.name);
    }

    return Array.from(groupMap.entries()).map(([code, g]) => ({
      classification: code,
      count: g.count,
      latestError: g.latestError,
      latestOccurredAt: !isNaN(g.latestOccurredAt.getTime())
        ? g.latestOccurredAt.toISOString()
        : new Date().toISOString(),
      affectedWorkflows: Array.from(g.workflows.entries()).map(([id, name]) => ({ id, name })),
    })).sort((a, b) => b.count - a.count);
  }

  async getCatalog(workspaceId: string): Promise<AutomationCatalogItem[]> {
    const triggers: AutomationCatalogItem[] = [
      { id: 'trigger_manual', name: 'On Request', category: 'trigger', description: 'Manual run via button or API call.' },
      { id: 'trigger_cron', name: 'Schedule (Cron)', category: 'trigger', description: 'Time-based recurrence in any timezone.' },
      { id: 'trigger_webhook', name: 'Inbound Webhook', category: 'trigger', description: 'Receives HTTP POST payloads with optional secret.' },
      { id: 'trigger_task_created', name: 'Task Created', category: 'trigger', description: 'Fires when a new task is created.' },
      { id: 'trigger_task_completed', name: 'Task Completed', category: 'trigger', description: 'Fires when a task status flips to completed.' },
      { id: 'trigger_task_overdue', name: 'Task Overdue', category: 'trigger', description: 'Hourly sweep detecting overdue work.' },
      { id: 'trigger_message', name: 'Channel Message', category: 'trigger', description: 'Fires when a message is posted to a channel.' },
      { id: 'trigger_member_joined', name: 'Member Joined', category: 'trigger', description: 'Fires when a new member joins the workspace.' },
      { id: 'trigger_doc_created', name: 'Document Created', category: 'trigger', description: 'Fires when a new document or wiki is created.' },
      { id: 'trigger_meeting_ended', name: 'Meeting Ended', category: 'trigger', description: 'Fires when a meeting call finishes.' },
    ];

    const actions: AutomationCatalogItem[] = [
      { id: 'action_task_create', name: 'Create Task', category: 'action', description: 'Creates a task on a Kanban board or project.' },
      { id: 'action_message_post', name: 'Post Message', category: 'action', description: 'Sends a notification message to a channel.' },
      { id: 'action_email_send', name: 'Send Email', category: 'action', description: 'Sends an email via Gmail or workspace mail.' },
      { id: 'action_http_request', name: 'HTTP Request', category: 'action', description: 'Calls any external HTTPS REST API.' },
      { id: 'action_code_runner', name: 'Sandboxed Code', category: 'action', description: 'Executes isolated JavaScript logic.' },
      { id: 'action_run_workflow', name: 'Run Workflow', category: 'action', description: 'Invokes another workflow with parameters.' },
      { id: 'action_approval', name: 'Human Approval', category: 'action', description: 'Pauses workflow until an approver confirms.' },
      { id: 'action_ai_generate', name: 'AI Generation', category: 'ai', description: 'Generates text, summaries, or structured content.' },
      { id: 'action_ai_agent', name: 'Delegate to Agent', category: 'ai', description: 'Runs an AI Agent with its tools and skills.' },
      { id: 'action_ai_classify', name: 'AI Classification', category: 'ai', description: 'Classifies text into categories and routes branches.' },
      { id: 'action_ai_extract', name: 'Extract Structured Data', category: 'ai', description: 'Extracts JSON fields from unstructured text.' },
      { id: 'action_knowledge_search', name: 'Knowledge Retrieval', category: 'ai', description: 'Searches workspace knowledge bases.' },
    ];

    return [...triggers, ...actions];
  }

  private async assertWorkflow(workspaceId: string, workflowId: string) {
    const found = await this.prisma.automationWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Workflow not found.');
  }
}

export function humanizeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hr, dom, mon, dow] = parts;
  if (min === '*' && hr === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every minute';
  if (min?.startsWith('*/') && hr === '*' && dom === '*' && mon === '*' && dow === '*') return `Every ${min.slice(2)} minutes`;
  if (min === '0' && hr === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every hour';
  if (dom === '*' && mon === '*' && dow === '*' && hr && min) return `Daily at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dow === '1-5' && hr && min) return `Weekdays at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if ((dow === '0,6' || dow === '6,0') && hr && min) return `Weekends at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dom === '1' && mon === '*' && dow === '*' && hr && min) return `Monthly on the 1st at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return `Schedule (${cron})`;
}

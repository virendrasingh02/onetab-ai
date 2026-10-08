import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConnectorRegistryService, IntegrationsService } from '@org/api-integrations';
import { PrismaService } from '@org/database';
import { diffPolledItems } from '@org/types';
import { WorkflowEngineService } from '../workflow-engine.service.js';
import { CanvasAgentRunService } from './canvas-agent-run.service.js';

/** How often an app is checked when all is well. */
export const POLL_INTERVAL_MS = 2 * 60_000;
/** Back-off ceiling after repeated failures. */
export const MAX_POLL_INTERVAL_MS = 30 * 60_000;
/** Runs one check may start; the rest are skipped, never queued forever. */
export const MAX_RUNS_PER_POLL = 10;
/** Runs per agent per hour — stops an agent that reacts to its own output looping. */
export const MAX_RUNS_PER_HOUR = 30;

interface PollState {
  lastPolledAt: Date | null;
  failures: number;
  windowStartAt: Date | null;
  firedInWindow: number;
}

/** Whether a trigger is due a check: every two minutes, backing off after failures. */
export function isPollDue(state: Pick<PollState, 'lastPolledAt' | 'failures'> | null, now: Date): boolean {
  if (!state?.lastPolledAt) return true;
  const interval = Math.min(POLL_INTERVAL_MS * 2 ** Math.min(state.failures, 4), MAX_POLL_INTERVAL_MS);
  return now.getTime() - state.lastPolledAt.getTime() >= interval;
}

/** How many runs may start now under the hourly cap, and the window to record. */
export function fireBudget(
  state: Pick<PollState, 'windowStartAt' | 'firedInWindow'> | null,
  now: Date,
): { allowed: number; windowStartAt: Date; firedInWindow: number } {
  const fresh = !state?.windowStartAt || now.getTime() - state.windowStartAt.getTime() >= 60 * 60_000;
  const windowStartAt = fresh ? now : (state!.windowStartAt as Date);
  const firedInWindow = fresh ? 0 : (state?.firedInWindow ?? 0);
  return { allowed: Math.max(0, Math.min(MAX_RUNS_PER_POLL, MAX_RUNS_PER_HOUR - firedInWindow)), windowStartAt, firedInWindow };
}

/** Key order doesn't change what a trigger watches. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Starts switched-on canvas agents on app events ("New email", "New issue"…).
 *
 * Every connector trigger watches one of that connector's own read actions:
 * the poller runs it as the agent's owner, compares the items with the ones
 * it has seen (`ConnectorTriggerState`) and starts one run per new item, with
 * the item as `{{event}}`. The first check after switching on (or after the
 * trigger is changed) only records what is already there.
 *
 * Failures are recorded on the trigger and shown on the agent; checks back off
 * while an app keeps failing. An hourly cap per agent stops an agent that
 * reacts to its own output from looping.
 */
@Injectable()
export class ConnectorTriggerPollerService {
  private readonly logger = new Logger(ConnectorTriggerPollerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
    private readonly canvasAgents: CanvasAgentRunService,
    private readonly connectors: ConnectorRegistryService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'connector-trigger-poll' })
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pollDue(new Date());
    } catch (error) {
      this.logger.warn(`Checking app triggers failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async pollDue(now: Date): Promise<number> {
    const agents = await this.canvasAgents.activeAppTriggers();
    let started = 0;
    for (const entry of agents) {
      const state = await this.prisma.connectorTriggerState.findUnique({ where: { workflowId: entry.workflowId } });
      if (!isPollDue(state, now)) continue;
      try {
        started += await this.pollOne(entry, state, now);
      } catch (error) {
        this.logger.warn(`App trigger for '${entry.agent.name}' (${entry.agent.id}) failed: ${String(error)}`);
      }
    }
    return started;
  }

  private async pollOne(
    entry: Awaited<ReturnType<CanvasAgentRunService['activeAppTriggers']>>[number],
    state: Awaited<ReturnType<PrismaService['connectorTriggerState']['findUnique']>>,
    now: Date,
  ): Promise<number> {
    const { provider, triggerId } = entry.trigger;
    const base = { workflowId: entry.workflowId, workspaceId: entry.workspaceId, provider, triggerId };
    const fail = async (message: string, configKey: string) => {
      await this.prisma.connectorTriggerState.upsert({
        where: { workflowId: entry.workflowId },
        create: { ...base, configKey, lastPolledAt: now, lastError: message, failures: 1 },
        update: { ...base, configKey, lastPolledAt: now, lastError: message, failures: { increment: 1 } },
      });
      return 0;
    };

    let definition: ReturnType<ConnectorRegistryService['trigger']>;
    let appName = provider;
    try {
      definition = this.connectors.trigger(provider, triggerId);
      appName = this.connectors.manifest(provider).name;
    } catch {
      definition = null;
    }
    const input = { ...(definition?.defaultInput ?? {}), ...entry.trigger.input };
    const configKey = `${provider}:${triggerId}:${stableJson(input)}`;
    if (!definition) return fail(`${appName} has no “${triggerId}” event any more. Pick another event on the trigger.`, configKey);

    const owner = entry.agent.creatorId;
    if (!owner) return fail('This agent has no owner, so it can’t act in connected apps.', configKey);
    const integration = await this.prisma.externalIntegration.findFirst({
      where: {
        provider,
        OR: [
          { workspaceId: entry.workspaceId, scopeType: { not: 'USER' } },
          { scopeType: 'USER', userId: owner },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, status: true },
    });
    if (!integration) return fail(`${appName} isn’t connected. The agent’s owner needs to connect it in App Connectors.`, configKey);
    if (integration.status !== 'CONNECTED') {
      return fail(`The ${appName} connection is ${integration.status.toLowerCase()}. Reconnect it in App Connectors.`, configKey);
    }

    let data: unknown;
    try {
      const result = await this.integrations.pollAction(integration.id, definition.pollActionId, input, owner, entry.workspaceId);
      if (!result.success) return fail(result.message || `${appName} didn’t return anything.`, configKey);
      data = result.data;
    } catch (error) {
      return fail(`Checking ${appName} failed: ${error instanceof Error ? error.message : String(error)}`, configKey);
    }

    // A changed trigger starts over without replaying what's already there.
    const seen = state && state.configKey === configKey && Array.isArray(state.seenIds) ? (state.seenIds as string[]) : null;
    const diff = diffPolledItems(data, definition, seen);
    if (diff.error) return fail(diff.error, configKey);

    const budget = fireBudget(state, now);
    const toRun = diff.fresh.slice(0, budget.allowed);
    const skipped = diff.fresh.length - toRun.length;

    let started = 0;
    if (toRun.length > 0) {
      await this.canvasAgents.sync(entry.agent, entry.compiled);
      for (const item of toRun) {
        try {
          await this.engine.startWorkflow(
            entry.workflowId,
            { trigger: 'APP_EVENT', connector: { provider, triggerId }, event: item, message: `New ${definition.label.toLowerCase()} in ${appName}` },
            { startedBy: 'event', limits: entry.compiled.limits },
          );
          started += 1;
        } catch (error) {
          this.logger.warn(`Starting '${entry.agent.name}' for a ${provider} event failed: ${String(error)}`);
        }
      }
    }

    const lastError =
      skipped > 0
        ? `Skipped ${skipped} event${skipped === 1 ? '' : 's'}: this agent may start at most ${MAX_RUNS_PER_HOUR} runs an hour (and ${MAX_RUNS_PER_POLL} at a time).`
        : null;
    const next = {
      ...base,
      configKey,
      seenIds: diff.seen,
      lastPolledAt: now,
      lastError,
      failures: 0,
      windowStartAt: budget.windowStartAt,
      firedInWindow: budget.firedInWindow + started,
      ...(started > 0 ? { lastFiredAt: now } : {}),
    };
    await this.prisma.connectorTriggerState.upsert({
      where: { workflowId: entry.workflowId },
      create: next,
      update: next,
    });
    if (started) this.logger.log(`Started ${started} run(s) of '${entry.agent.name}' for ${provider} ${triggerId}.`);
    return started;
  }
}

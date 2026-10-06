import { Injectable, Logger, Optional } from '@nestjs/common';
import { AICredentialService, AIInfrastructureService, ModelResolverService, ProviderRegistryService } from '@org/api-ai';
import { MCPToolRegistryService } from '@org/api-agents';
import { IntegrationsService } from '@org/api-integrations';
import { PrismaService } from '@org/database';
import {
  AGENT_EVENTS,
  AGENT_KINDS,
  AGENT_STEP_KINDS,
  PLATFORM_TOOLS,
  appLabel,
  describeCronExpression,
  describeTriggerShort,
  findAgentTemplate,
  matchAgentTemplate,
  requiredScopes,
  uniqueStepId,
  type AgentBlueprint,
  type AgentBlueprintParam,
  type AgentBlueprintStep,
  type AgentClarification,
  type AgentEventName,
  type AgentKind,
  type AgentScope,
  type AgentStepKind,
} from '@org/types';
import { isValidCron, parseScheduleText } from '@org/utils';
import { agentBlueprintSchema } from '@org/validation';
import { chatWithFailover, modelLabel } from '../model-failover.js';

/** A connected app's action, as the planner may use it (`GMAIL.create_draft`). */
export interface CatalogAppAction {
  tool: string;
  label: string;
  description: string;
  access: 'read' | 'write' | 'destructive';
  inputs: string[];
}

export interface CatalogApp {
  provider: string;
  name: string;
  integrationId: string;
  status: string;
  actions: CatalogAppAction[];
}

export interface StudioCatalog {
  tools: Array<{
    name: string;
    label: string;
    description: string;
    scope: string;
    access: 'read' | 'write';
    app: string;
    activity: string;
    approvalByDefault: boolean;
    parameters: Record<string, unknown>;
    optional: string[];
  }>;
  apps: CatalogApp[];
  events: typeof AGENT_EVENTS;
}

/** What the planner understood — shown above the plan so the user can check it. */
export interface PlanUnderstanding {
  summary: string;
  runsWhen: string;
  uses: string[];
  produces: string;
  plannedBy: 'ai' | 'template';
  model?: string;
  durationMs: number;
}

export interface PlanResult {
  blueprint: AgentBlueprint;
  understanding: PlanUnderstanding;
}

/** Reasoning models spend part of this thinking; 3.5k cut off multi-part plans mid-JSON. */
const MAX_PLAN_TOKENS = 6_000;
/**
 * Per provider. A plan the model can't draft in this long starts from a
 * template instead. Large models routinely need 30–40 s for a full plan; two
 * providers at this budget still finish inside the client's 120 s wait.
 */
const PLAN_TIMEOUT_MS = 55_000;

/** Pulls the first JSON object out of a model reply (fenced or not). */
export function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const STEP_KINDS = Object.keys(AGENT_STEP_KINDS) as AgentStepKind[];
const EVENT_NAMES = AGENT_EVENTS.map((e) => e.value) as string[];

/**
 * Turns whatever a model returned into a blueprint the Studio can trust: step
 * ids made unique, kinds and events checked, tools that do not exist dropped
 * (with a warning), inputs forced to objects. Pure — easy to test.
 */
export function sanitizeModelBlueprint(
  raw: unknown,
  knownTools: ReadonlySet<string>,
): { blueprint: Partial<AgentBlueprint>; warnings: string[] } {
  const warnings: string[] = [];
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const triggerRaw = (o['trigger'] && typeof o['trigger'] === 'object' ? o['trigger'] : {}) as Record<string, unknown>;
  const triggerKind = ['manual', 'schedule', 'event'].includes(String(triggerRaw['kind'])) ? (triggerRaw['kind'] as 'manual' | 'schedule' | 'event') : 'manual';
  const cron = str(triggerRaw['cron'], 120);
  const event = EVENT_NAMES.includes(String(triggerRaw['event'])) ? (triggerRaw['event'] as AgentEventName) : undefined;

  const taken = new Set<string>();
  const steps: AgentBlueprintStep[] = [];
  for (const entry of Array.isArray(o['steps']) ? (o['steps'] as unknown[]).slice(0, 25) : []) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as Record<string, unknown>;
    const title = str(s['title'], 160) || 'Step';
    const tool = str(s['tool'], 120);
    let kind = STEP_KINDS.includes(s['kind'] as AgentStepKind) ? (s['kind'] as AgentStepKind) : tool ? 'collect' : 'generate';
    if (tool && !knownTools.has(tool)) {
      warnings.push(`Left out “${title}”: there is no tool called “${tool}”.`);
      continue;
    }
    if ((kind === 'collect' || kind === 'action' || kind === 'notify') && !tool) kind = 'generate';
    const id = uniqueStepId(str(s['id'], 48) || title, taken);
    taken.add(id);
    const input = s['input'] && typeof s['input'] === 'object' && !Array.isArray(s['input']) ? (s['input'] as Record<string, unknown>) : undefined;
    steps.push({
      id,
      kind,
      title,
      ...(str(s['why'], 500) ? { why: str(s['why'], 500) } : {}),
      ...(tool && (kind === 'collect' || kind === 'action' || kind === 'notify') ? { tool } : {}),
      ...(input ? { input } : {}),
      ...(str(s['prompt'], 8_000) ? { prompt: str(s['prompt'], 8_000) } : {}),
      ...(Array.isArray(s['uses']) ? { uses: (s['uses'] as unknown[]).filter((u): u is string => typeof u === 'string').slice(0, 20) } : {}),
      ...(kind === 'condition' && str(s['condition'], 300) ? { condition: str(s['condition'], 300) } : {}),
      ...(s['requiresApproval'] === true ? { requiresApproval: true } : {}),
      ...(['retry', 'continue', 'stop'].includes(String(s['onFailure'])) ? { onFailure: s['onFailure'] as 'retry' | 'continue' | 'stop' } : {}),
    });
  }
  // `uses` may only point at steps that exist before the step.
  steps.forEach((step, index) => {
    if (step.uses) {
      const before = new Set(steps.slice(0, index).map((s) => s.id));
      step.uses = step.uses.filter((u) => before.has(u));
      if (step.uses.length === 0) delete step.uses;
    }
    if (step.kind === 'condition' && !step.condition) {
      step.kind = 'analyze';
    }
  });

  const outputRaw = (o['output'] && typeof o['output'] === 'object' ? o['output'] : {}) as Record<string, unknown>;
  const formats = ['report', 'todo_list', 'summary', 'answer', 'draft', 'tasks', 'alert'];
  const destinations = ['run', 'doc', 'channel', 'notification'];
  const params: AgentBlueprintParam[] = [];
  for (const entry of Array.isArray(o['params']) ? (o['params'] as unknown[]).slice(0, 10) : []) {
    if (!entry || typeof entry !== 'object') continue;
    const p = entry as Record<string, unknown>;
    const key = str(p['key'], 40).replace(/[^a-zA-Z0-9_]/g, '');
    if (!key || !/^[a-zA-Z]/.test(key) || params.some((x) => x.key === key)) continue;
    const type = ['project', 'channel', 'text', 'doc'].includes(String(p['type'])) ? (p['type'] as AgentBlueprintParam['type']) : 'text';
    params.push({ key, label: str(p['label'], 120) || key, type, ...(p['required'] === true ? { required: true } : {}), ...(str(p['hint'], 300) ? { hint: str(p['hint'], 300) } : {}) });
  }

  const kind = (Object.keys(AGENT_KINDS) as AgentKind[]).includes(o['kind'] as AgentKind) ? (o['kind'] as AgentKind) : 'task';
  return {
    warnings,
    blueprint: {
      name: str(o['name'], 120) || 'New agent',
      kind,
      objective: str(o['objective'], 1_000),
      ...(str(o['instructions'], 4_000) ? { instructions: str(o['instructions'], 4_000) } : {}),
      trigger: {
        kind: triggerKind,
        ...(triggerKind === 'schedule' && cron && isValidCron(cron) ? { cron } : {}),
        ...(triggerKind === 'event' && event ? { event } : {}),
      },
      context: Array.isArray(o['context']) ? (o['context'] as unknown[]).filter((c): c is string => typeof c === 'string').map((c) => c.slice(0, 200)).slice(0, 12) : [],
      steps,
      output: {
        format: formats.includes(String(outputRaw['format'])) ? (outputRaw['format'] as never) : 'summary',
        destination: destinations.includes(String(outputRaw['destination'])) ? (outputRaw['destination'] as never) : 'run',
        ...(str(outputRaw['channelSlug'], 120) ? { channelSlug: str(outputRaw['channelSlug'], 120).replace(/^#/, '') } : {}),
        ...(str(outputRaw['fromStep'], 48) && steps.some((s) => s.id === outputRaw['fromStep']) ? { fromStep: outputRaw['fromStep'] as string } : {}),
      },
      params,
      assumptions: Array.isArray(o['assumptions']) ? (o['assumptions'] as unknown[]).filter((c): c is string => typeof c === 'string').map((c) => c.slice(0, 300)).slice(0, 6) : [],
    },
  };
}

/**
 * AI Mode: "Build me an agent that prepares my daily report" → a plan.
 *
 * The model plans with the real tool catalog in front of it — the built-in
 * tools plus the owner's connected apps — and its answer is checked
 * (`sanitizeModelBlueprint`, then the blueprint schema) before anyone sees
 * it. When no model is configured, or its answer is unusable, the planner
 * starts from the closest template instead and says so on the plan.
 */
@Injectable()
export class AgentPlannerService {
  private readonly logger = new Logger(AgentPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIInfrastructureService,
    private readonly modelResolver: ModelResolverService,
    private readonly credentials: AICredentialService,
    private readonly registry: MCPToolRegistryService,
    private readonly integrations: IntegrationsService,
    @Optional() private readonly providers?: ProviderRegistryService,
  ) {}

  /** Built-in tools with their Studio metadata, plus the owner's connected apps and their actions. */
  async catalog(workspaceId: string, userId: string): Promise<StudioCatalog> {
    const tools = this.registry
      .getToolDefinitions()
      .filter((t) => t.meta)
      .map((t) => ({
        name: t.name,
        label: t.meta!.label,
        description: t.description,
        scope: t.meta!.scope,
        access: (t.meta!.scope.endsWith(':read') ? 'read' : 'write') as 'read' | 'write',
        app: t.meta!.app,
        activity: t.meta!.activity,
        approvalByDefault: !!t.meta!.approvalByDefault,
        parameters: t.parameters,
        optional: t.optional ?? [],
      }));

    const apps: CatalogApp[] = [];
    try {
      const connected = (await this.integrations.getConnectedIntegrations(workspaceId, userId)) as Array<{
        id: string;
        provider: string;
        status?: string;
      }>;
      const seen = new Set<string>();
      for (const integration of connected) {
        const provider = String(integration.provider).toUpperCase();
        // The platform's own internal connector is not an outside app; its data is
        // already reachable through the built-in tools.
        if (seen.has(provider) || ['CUSTOM_API', 'ONETAB_APP', 'ONETAB_INTERNAL'].includes(provider)) continue;
        seen.add(provider);
        let actions: CatalogAppAction[] = [];
        try {
          const defs = await this.integrations.getActions(integration.id, userId, workspaceId);
          actions = defs.map((d) => ({
            tool: `${provider}.${d.id}`,
            label: d.label,
            description: d.description,
            access: (d.permissionLevel ?? 'write') as CatalogAppAction['access'],
            inputs: Object.keys(((d.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties) ?? {}),
          }));
        } catch {
          actions = [];
        }
        apps.push({
          provider,
          name: appLabel(provider),
          integrationId: integration.id,
          status: String(integration.status ?? 'CONNECTED'),
          actions,
        });
      }
    } catch (error) {
      this.logger.warn(`Could not list connected apps for the Studio catalog: ${String(error)}`);
    }
    return { tools, apps, events: AGENT_EVENTS };
  }

  async plan(
    workspaceId: string,
    userId: string,
    input: { prompt: string; templateId?: string; timezone?: string },
    /** Already loaded by the caller — saves listing the apps twice. */
    preloaded?: StudioCatalog,
  ): Promise<PlanResult> {
    const started = Date.now();
    const catalog = preloaded ?? (await this.catalog(workspaceId, userId));
    const timezone = input.timezone || (await this.userTimezone(userId));

    let blueprint: AgentBlueprint | null = null;
    let model: string | undefined;
    let fallbackReason: string | undefined;
    const warnings: string[] = [];

    const template = findAgentTemplate(input.templateId);
    if (template) {
      blueprint = template.blueprint();
    } else {
      try {
        const planned = await this.planWithModel(workspaceId, input.prompt, catalog, timezone);
        blueprint = planned.blueprint;
        model = planned.model;
        warnings.push(...planned.warnings);
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`AI planning fell back to a template: ${fallbackReason}`);
      }
      if (!blueprint) {
        const match = matchAgentTemplate(input.prompt);
        blueprint = match ? match.template.blueprint() : this.askWorkspaceBlueprint();
        blueprint.source = {
          kind: 'template',
          ...(match ? { templateId: match.template.id } : {}),
          fallbackReason: fallbackReason ?? 'AI planning is not available.',
        };
      }
    }

    const finished = await this.finalize(workspaceId, blueprint, {
      prompt: input.prompt,
      ...(template ? {} : { scheduleText: input.prompt }),
      userId,
      timezone,
      catalog,
      extraWarnings: warnings,
      model,
    });
    const understanding: PlanUnderstanding = {
      summary: finished.objective || finished.name,
      runsWhen: this.describeWhen(finished),
      uses: finished.context.length ? finished.context : [...new Set(finished.steps.filter((s) => s.tool).map((s) => PLATFORM_TOOLS[s.tool!]?.label ?? s.tool!))],
      produces: this.describeOutput(finished),
      plannedBy: finished.source.kind === 'ai' ? 'ai' : 'template',
      ...(model ? { model } : {}),
      durationMs: Date.now() - started,
    };
    return { blueprint: finished, understanding };
  }

  /**
   * Makes any blueprint — planned, from a template, or edited by hand — ready
   * to show: schedule and zone, the permissions its steps need, approvals on
   * actions that reach other people, params its steps reference, and the
   * questions that must be answered before it can run.
   */
  async finalize(
    workspaceId: string,
    input: AgentBlueprint,
    ctx: {
      prompt?: string;
      /** The requester's own words, read for a schedule. Not a template's name. */
      scheduleText?: string;
      timezone: string;
      catalog: StudioCatalog;
      extraWarnings?: string[];
      model?: string;
      userId?: string;
    },
  ): Promise<AgentBlueprint> {
    const bp: AgentBlueprint = structuredClone(input);
    const assumptions = new Set(bp.assumptions ?? []);
    const warnings = new Set([...(bp.warnings ?? []), ...(ctx.extraWarnings ?? [])]);
    const appActions = new Map(ctx.catalog.apps.flatMap((a) => a.actions.map((x) => [x.tool, x] as const)));

    // When: the request's own words win over a template's default. A schedule
    // the model already read out of the request stands, and words that name
    // no time of day ("daily") keep the plan's hour instead of a 9 AM default.
    const schedule = ctx.scheduleText ? parseScheduleText(ctx.scheduleText) : null;
    const modelScheduled = bp.source.kind === 'ai' && bp.trigger.kind === 'schedule' && isValidCron(bp.trigger.cron ?? '');
    if (schedule && bp.trigger.kind !== 'event' && !modelScheduled) {
      const current = bp.trigger.kind === 'schedule' && bp.trigger.cron && isValidCron(bp.trigger.cron) ? bp.trigger.cron.split(/\s+/) : null;
      const parsed = schedule.cron.split(/\s+/);
      const cron = !schedule.timeGiven && current ? [current[0], current[1], ...parsed.slice(2)].join(' ') : schedule.cron;
      bp.trigger = { ...bp.trigger, kind: 'schedule', cron };
    }
    if (bp.trigger.kind === 'schedule') {
      bp.trigger.timezone = bp.trigger.timezone || ctx.timezone;
      for (const a of [...assumptions]) if (/^Runs at .* time zone\.$/.test(a)) assumptions.delete(a);
      assumptions.add(`${describeCronExpression(bp.trigger.cron)} (${bp.trigger.timezone}).`);
    }

    // Approvals: actions that reach other people, or act in a connected app, wait for a person by default.
    for (const step of bp.steps) {
      if (step.kind !== 'action' || !step.tool || step.requiresApproval) continue;
      const builtin = PLATFORM_TOOLS[step.tool];
      const app = appActions.get(step.tool);
      if (builtin?.approvalByDefault || (app && app.access !== 'read')) step.requiresApproval = true;
    }

    // Apps: a step on an app that is not connected is kept, and flagged.
    const connected = new Set(ctx.catalog.apps.filter((a) => a.status === 'CONNECTED').map((a) => a.provider));
    for (const step of bp.steps) {
      if (!step.tool) continue;
      if (step.tool === 'search_email' && !connected.has('GMAIL')) {
        warnings.add('Gmail isn’t connected. Connect it in Integrations before this agent runs, or its email step will fail.');
      }
      const dot = step.tool.indexOf('.');
      if (dot > 0 && !connected.has(step.tool.slice(0, dot).toUpperCase())) {
        warnings.add(`${appLabel(step.tool.slice(0, dot))} isn’t connected. Connect it in Integrations before this agent runs.`);
      }
    }

    // Params the steps reference but the plan never declared.
    const referenced = new Set<string>();
    for (const step of bp.steps) {
      const text = JSON.stringify([step.input ?? {}, step.prompt ?? '']);
      for (const match of text.matchAll(/\{\{\s*params\.([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) referenced.add(match[1]!);
    }
    for (const key of referenced) {
      if (bp.params.some((p) => p.key === key)) continue;
      const type: AgentBlueprintParam['type'] = /project/i.test(key) ? 'project' : /channel/i.test(key) ? 'channel' : /doc/i.test(key) ? 'doc' : 'text';
      bp.params.push({ key, label: key.replace(/Id$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), type });
    }
    await this.prefillParams(workspaceId, bp, ctx.prompt ?? '', assumptions);
    if (ctx.userId && ctx.prompt) await this.prefillChannel(workspaceId, ctx.userId, bp, ctx.prompt, assumptions, warnings);

    // Permissions: exactly what the steps need — shown for the user to confirm.
    bp.scopes = requiredScopes(bp, (tool) => appActions.get(tool)?.access) as AgentScope[];

    // Unattended agents tell their owner what happened.
    if (bp.trigger.kind !== 'manual' && bp.source.kind === 'ai') {
      bp.notify = { onComplete: true, onFailure: true, onApproval: true };
    }

    bp.questions = this.questionsFor(bp);
    bp.assumptions = [...assumptions].slice(0, 10);
    bp.warnings = [...warnings].slice(0, 10);
    if (ctx.prompt && !bp.source.prompt) bp.source = { ...bp.source, prompt: ctx.prompt.slice(0, 4_000) };
    if (ctx.model && bp.source.kind === 'ai') bp.source = { ...bp.source, model: ctx.model };

    const parsed = agentBlueprintSchema.safeParse(bp);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new Error(`The plan is not valid: ${first?.path.join('.')} ${first?.message}`);
    }
    return parsed.data as AgentBlueprint;
  }

  private questionsFor(bp: AgentBlueprint): AgentClarification[] {
    const questions: AgentClarification[] = [];
    for (const param of bp.params) {
      if (param.required && !param.value) {
        questions.push({ id: `param_${param.key}`, question: `Which ${param.label.toLowerCase()} should it use?`, paramKey: param.key });
      }
    }
    if (bp.trigger.kind === 'event' && bp.trigger.event === 'channel.message' && !bp.trigger.filter?.channelId) {
      questions.push({ id: 'watch_channel', question: 'Which channel should it watch?', field: 'trigger.filter.channelId' });
    }
    if (bp.output.destination === 'channel' && !bp.output.channelSlug) {
      questions.push({ id: 'post_channel', question: 'Which channel should it post to?', field: 'output.channelSlug' });
    }
    return questions;
  }

  /**
   * A channel the request names ("#client-acme") becomes the channel an
   * agent watches or posts to — only one its owner belongs to.
   */
  private async prefillChannel(
    workspaceId: string,
    userId: string,
    bp: AgentBlueprint,
    prompt: string,
    assumptions: Set<string>,
    warnings: Set<string>,
  ) {
    const slugs = [...prompt.matchAll(/#([a-z0-9][a-z0-9_-]{0,79})/gi)].map((m) => m[1]!.toLowerCase());
    const wantsWatch = bp.trigger.kind === 'event' && bp.trigger.event === 'channel.message' && !bp.trigger.filter?.channelId;
    const wantsPost = bp.output.destination === 'channel' && !bp.output.channelSlug;
    if (!slugs.length || (!wantsWatch && !wantsPost)) return;
    const channels = await this.prisma.channel.findMany({
      where: { workspaceId, slug: { in: slugs }, isArchived: false, members: { some: { userId } } },
      select: { id: true, slug: true },
    });
    const channel = channels.find((c) => c.slug === slugs[0]) ?? channels[0];
    if (!channel) {
      warnings.add(`#${slugs[0]} isn’t a channel you belong to, so it wasn’t used. Pick the channel below.`);
      return;
    }
    if (wantsWatch) {
      bp.trigger = { ...bp.trigger, filter: { ...bp.trigger.filter, channelId: channel.id } };
      assumptions.add(`Watches #${channel.slug}.`);
    } else {
      bp.output = { ...bp.output, channelSlug: channel.slug };
      assumptions.add(`Posts in #${channel.slug}.`);
    }
  }

  /** Fills a project param when the request names a project, or when there is only one. */
  private async prefillParams(workspaceId: string, bp: AgentBlueprint, prompt: string, assumptions: Set<string>) {
    const projectParam = bp.params.find((p) => p.type === 'project' && !p.value);
    if (!projectParam) return;
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null, status: { in: ['PLANNING', 'ACTIVE', 'ON_HOLD'] } },
      select: { id: true, name: true },
      take: 200,
    });
    const text = prompt.toLowerCase();
    const named = projects
      .filter((p) => p.name.trim().length > 2 && text.includes(p.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (named) {
      projectParam.value = named.id;
      assumptions.add(`Uses the project “${named.name}”.`);
    } else if (projects.length === 1 && projectParam.required) {
      projectParam.value = projects[0]!.id;
      assumptions.add(`Uses “${projects[0]!.name}”, the only active project.`);
    }
  }

  private async planWithModel(
    workspaceId: string,
    prompt: string,
    catalog: StudioCatalog,
    timezone: string,
  ): Promise<{ blueprint: AgentBlueprint; model: string; warnings: string[] }> {
    const known = new Set([...catalog.tools.map((t) => t.name), ...catalog.apps.flatMap((a) => a.actions.map((x) => x.tool))]);

    // The default model, or — when it is having an outage — the next
    // provider with a key (`chatWithFailover`).
    const { response, provider, model } = await chatWithFailover(
      { ai: this.ai, modelResolver: this.modelResolver, credentials: this.credentials, providers: this.providers },
      workspaceId,
      {},
      [
        { role: 'system', content: this.systemPrompt(catalog, timezone) },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.2, maxTokens: MAX_PLAN_TOKENS, timeoutMs: PLAN_TIMEOUT_MS },
    );
    const content = response.message?.content ?? '';
    const raw = extractJsonObject(content);
    if (!raw) {
      this.logger.warn(
        `Unreadable plan from ${modelLabel(provider, model)} (finish: ${response.finishReason ?? 'n/a'}, ${content.length} chars): ${content.slice(0, 240).replace(/\s+/g, ' ')}`,
      );
      throw new Error(
        response.finishReason === 'length'
          ? 'The model ran out of room before finishing the plan.'
          : 'The model did not return a plan it could read.',
      );
    }
    const { blueprint: partial, warnings } = sanitizeModelBlueprint(raw, known);
    if (!partial.steps?.length) throw new Error('The model returned a plan with no usable steps.');
    const blueprint: AgentBlueprint = {
      version: 1,
      name: partial.name ?? 'New agent',
      kind: partial.kind ?? 'task',
      objective: partial.objective ?? '',
      ...(partial.instructions ? { instructions: partial.instructions } : {}),
      trigger: partial.trigger ?? { kind: 'manual' },
      context: partial.context ?? [],
      steps: partial.steps,
      output: partial.output ?? { format: 'summary', destination: 'run' },
      params: partial.params ?? [],
      scopes: [],
      notify: { onComplete: false, onFailure: true, onApproval: true },
      questions: [],
      assumptions: partial.assumptions ?? [],
      warnings: [],
      source: { kind: 'ai' },
    };
    return { blueprint, model: modelLabel(provider, model), warnings };
  }

  private systemPrompt(catalog: StudioCatalog, timezone: string): string {
    const toolLines = catalog.tools.map((t) => {
      const params = Object.keys(t.parameters)
        .map((p) => (t.optional.includes(p) ? `${p}?` : p))
        .join(', ');
      return `- ${t.name}(${params}) [${t.access}] — ${t.description}`;
    });
    const appLines = catalog.apps.flatMap((a) =>
      a.actions.map((x) => `- ${x.tool}(${x.inputs.join(', ')}) [${x.access === 'read' ? 'read' : 'write'}] — ${a.name}: ${x.description}`),
    );
    const example = findAgentTemplate('daily-report')!.blueprint();
    const compactExample = JSON.stringify({
      name: example.name,
      kind: example.kind,
      objective: example.objective,
      trigger: example.trigger,
      context: example.context,
      steps: example.steps.map((s) => ({ ...s, prompt: s.prompt?.slice(0, 160) })),
      output: example.output,
      params: [],
      assumptions: example.assumptions,
    });
    return [
      'You are the planner inside AI Agent Studio, part of a team workspace app (tasks, projects, docs, meetings, chat).',
      'Turn the user’s request into an agent plan: a JSON object only — no prose, no code fences.',
      '',
      'JSON shape:',
      '{ "name": string, "kind": one of ' + Object.keys(AGENT_KINDS).join('|') + ',',
      '  "objective": one sentence, "instructions"?: tone/format guidance,',
      '  "trigger": { "kind": "manual"|"schedule"|"event", "cron"?: 5-field cron, "event"?: one of ' + EVENT_NAMES.join('|') + ' },',
      '  "context": [short phrases naming the information used],',
      '  "steps": [{ "id": snake_case, "kind": ' + STEP_KINDS.join('|') + ', "title": short imperative, "why": one short reason,',
      '             "tool"?: a tool name below, "input"?: object of tool parameters, "prompt"?: what a writing/analysis step must produce,',
      '             "uses"?: [earlier step ids], "condition"?: e.g. "triage.aiOutput contains \\"IMPORTANT\\"", "requiresApproval"?: true, "onFailure"?: "retry"|"continue"|"stop" }],',
      '  "output": { "format": report|todo_list|summary|answer|draft|tasks|alert, "destination": run|doc|channel|notification, "fromStep"?: step id },',
      '  "params": [{ "key": camelCase, "label": string, "type": project|channel|doc|text, "required"?: true }],',
      '  "assumptions": [short statements of what you assumed] }',
      '',
      'Rules:',
      '- Use ONLY the tools listed below, with their parameter names. Never invent a tool. If the request needs something no tool provides, say so in "assumptions" and plan what is possible.',
      '- Gather data first (collect steps), then analyze/generate steps, then actions. Writing steps automatically receive the results of earlier data steps.',
      '- collect / action / notify steps need a "tool". analyze / generate steps need a "prompt" and no tool.',
      '- Put an approval (a step of kind "approval", or "requiresApproval": true) before anything that publishes, sends, posts to others, or changes existing work.',
      '- In tool inputs you may reference: {{<stepId>.toolResult}} or {{<stepId>.aiOutput}} (earlier results), {{input.text}} (what the person typed when running it), {{params.<key>}} (a choice the user makes, declared in "params"), {{event.<field>}} (event data), {{now.date}} / {{now.weekday}}.',
      '- For recurring requests use a schedule trigger with cron in the user’s local time (' + timezone + '). "Every morning" is 0 8 * * *, "every evening" 0 18 * * *, weekdays use 1-5.',
      '- For "when X happens" requests use an event trigger. For one-off requests use a manual trigger.',
      '- Keep plans short: 3–8 steps. Use a condition step to stop early when there is nothing to do.',
      '- Never plan to fabricate data. Writing steps must work only from gathered data.',
      '',
      'Built-in tools:',
      ...toolLines,
      ...(appLines.length ? ['', 'Connected apps:', ...appLines] : ['', 'No external apps are connected (email tools will fail until Gmail is connected).']),
      '',
      'Example for “Prepare my daily work report every weekday evening”:',
      compactExample,
    ].join('\n');
  }

  /** A last-resort plan for a request no template matches: search the workspace and answer. */
  private askWorkspaceBlueprint(): AgentBlueprint {
    return {
      version: 1,
      name: 'Workspace assistant',
      kind: 'assistant',
      objective: 'Answer a question from your workspace’s docs and tasks.',
      trigger: { kind: 'manual' },
      context: ['Workspace docs', 'Your tasks'],
      steps: [
        { id: 'docs', kind: 'collect', title: 'Search docs', tool: 'search_docs', input: { query: '{{input.text}}' } },
        { id: 'tasks', kind: 'collect', title: 'Check your tasks', tool: 'find_tasks', input: { assignee: 'me', status: 'open', limit: 30 } },
        { id: 'answer', kind: 'generate', title: 'Answer', prompt: 'Answer the request using the docs and tasks above. Cite doc titles and task identifiers.' },
      ],
      output: { format: 'answer', destination: 'run', fromStep: 'answer' },
      params: [],
      scopes: [],
      notify: { onComplete: false, onFailure: true, onApproval: true },
      questions: [],
      assumptions: [],
      warnings: [],
      source: { kind: 'template' },
    };
  }

  private describeWhen(bp: AgentBlueprint): string {
    if (bp.trigger.kind === 'schedule') return `${describeTriggerShort(bp.trigger)}${bp.trigger.timezone ? ` (${bp.trigger.timezone})` : ''}`;
    return describeTriggerShort(bp.trigger);
  }

  private describeOutput(bp: AgentBlueprint): string {
    const format = {
      report: 'A report',
      todo_list: 'A prioritised to-do list',
      summary: 'A summary',
      answer: 'An answer',
      draft: 'A draft',
      tasks: 'Tasks',
      alert: 'An alert',
    }[bp.output.format];
    const where = {
      run: 'shown in the run',
      doc: 'saved as a doc',
      channel: bp.output.channelSlug ? `posted in #${bp.output.channelSlug}` : 'posted in a channel',
      notification: 'sent to you as a notification',
    }[bp.output.destination];
    return `${format}, ${where}`;
  }

  private async userTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return user?.timezone || 'UTC';
  }
}

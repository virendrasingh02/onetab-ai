import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { AICredentialService, AIInfrastructureService, ModelResolverService, ProviderRegistryService } from '@org/api-ai';
import { PrismaService } from '@org/database';
import {
  EDITABLE_NODE_TYPES,
  analyzeStudioGraph,
  applyGraphEdits,
  buildArchitectSpec,
  compileStudioGraph,
  describeFlowLine,
  detectAgentRequirements,
  diffStudioGraphs,
  interpretEditCommand,
  isStudioGraph,
  mainPath,
  sanitizeEditOps,
  specToStudioGraph,
  type ArchitectContext,
  type ArchitectDiagnosisFinding,
  type ArchitectDiagnosisResult,
  type ArchitectEditResult,
  type ArchitectOptimizeResult,
  type ArchitectUnderstandResult,
  type EditInterpretationContext,
  type GraphEditOp,
  type StudioCanvasGraph,
} from '@org/types';
import { parseScheduleText } from '@org/utils';
import { agentArchitectSpecSchema } from '@org/validation';
import { chatWithFailover, modelLabel } from '../model-failover.js';
import { classifyStepError } from '../run-support.js';
import { AgentPlannerService, extractJsonObject, type StudioCatalog } from './agent-planner.service.js';
import { CanvasAgentRunService } from './canvas-agent-run.service.js';

type UnderstandResult = ArchitectUnderstandResult;
type EditResult = ArchitectEditResult;
type DiagnosisFinding = ArchitectDiagnosisFinding;
type DiagnosisResult = ArchitectDiagnosisResult;

const EDIT_TIMEOUT_MS = 45_000;

/**
 * Prompt-to-agent for the Studio ("Create with one prompt").
 *
 * Understanding a request reuses the Studio's planner — the model plans with
 * the real tool catalog, falling back to a template — and adds what the
 * request's words need (apps, knowledge, approvals, a team), producing an
 * {@link AgentArchitectSpec} checked against its schema, and the canvas graph
 * it builds. Editing turns words into graph ops (rules first, a model when the
 * rules don't recognise the request), and reports the computed diff. Nothing
 * here saves: the Studio creates and updates agents through the agent routes,
 * which enforce the workspace's creation policy and keep versions.
 */
@Injectable()
export class AgentArchitectService {
  private readonly logger = new Logger(AgentArchitectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: AgentPlannerService,
    private readonly runs: CanvasAgentRunService,
    private readonly ai: AIInfrastructureService,
    private readonly modelResolver: ModelResolverService,
    private readonly credentials: AICredentialService,
    @Optional() private readonly providers?: ProviderRegistryService,
  ) {}

  async understand(workspaceId: string, userId: string, input: { prompt: string; templateId?: string }): Promise<UnderstandResult> {
    const catalog = await this.planner.catalog(workspaceId, userId);
    const [timezone, knowledgeBases] = await Promise.all([this.userTimezone(userId), this.knowledgeBases(workspaceId)]);
    const { blueprint, understanding } = await this.planner.plan(workspaceId, userId, { prompt: input.prompt, ...(input.templateId ? { templateId: input.templateId } : {}), timezone }, catalog);
    const requirements = detectAgentRequirements(input.prompt);
    const spec = buildArchitectSpec(blueprint, requirements, this.context(catalog, knowledgeBases, timezone), input.prompt);

    const parsed = agentArchitectSpecSchema.safeParse(spec);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      this.logger.warn(`Generated spec failed validation at ${first?.path.join('.')}: ${first?.message}`);
      throw new BadRequestException({ code: 'SPEC_INVALID', message: 'The plan for this agent came out malformed, so nothing was built. Try describing it again, a little more specifically.' });
    }
    const graph = specToStudioGraph(spec);
    return {
      spec,
      graph,
      flow: describeFlowLine(graph),
      issues: compileStudioGraph(graph).issues,
      plannedBy: understanding.plannedBy,
      ...(understanding.model ? { model: understanding.model } : {}),
      durationMs: understanding.durationMs,
    };
  }

  async edit(workspaceId: string, userId: string, input: { command: string; graphJson: string }): Promise<EditResult> {
    const graph = this.parseGraph(input.graphJson);
    const ctx = await this.editContext(workspaceId, userId);

    let ops: GraphEditOp[] = [];
    let explanation = '';
    let notes: string[] = [];
    let by: EditResult['by'] = 'none';
    let model: string | undefined;

    const ruled = interpretEditCommand(input.command, graph, ctx);
    if (ruled) {
      ({ ops, explanation, notes } = ruled);
      by = 'rules';
    } else {
      try {
        const proposed = await this.proposeWithModel(workspaceId, input.command, graph, ctx);
        ops = proposed.ops;
        explanation = proposed.explanation;
        model = proposed.model;
        by = 'ai';
        if (proposed.dropped) notes.push(`${proposed.dropped} suggested change${proposed.dropped === 1 ? ' was' : 's were'} left out because ${proposed.dropped === 1 ? 'it' : 'they'} didn’t fit this workflow.`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Model edit failed: ${reason}`);
        notes = [`I couldn’t work out a change for that (${reason}). Try one of the suggestions, or say it more specifically — for example “add Slack after the report”.`];
      }
    }

    const { graph: next, errors } = applyGraphEdits(graph, ops);
    const diff = diffStudioGraphs(graph, next);
    // Say what happened, not what was meant to: a change that turned out to
    // change nothing is not described as made.
    if (!diff.changedAnything && ops.length) {
      explanation = errors.length ? 'I couldn’t make that change:' : 'That’s already how it works — nothing needs to change.';
    }
    return {
      graph: next,
      ops,
      explanation: explanation || (diff.changedAnything ? 'Here’s the change.' : ''),
      notes: [...notes, ...errors],
      changes: diff.summary,
      changedAnything: diff.changedAnything,
      issues: compileStudioGraph(next).issues,
      flow: describeFlowLine(next),
      by,
      ...(model ? { model } : {}),
    };
  }

  /**
   * Why the agent's last run failed, from its real steps, and what would fix
   * it. Graph problems that block a run are findings too.
   */
  async diagnose(workspaceId: string, agentId: string, graphJson?: string): Promise<DiagnosisResult> {
    const findings: DiagnosisFinding[] = [];
    const ops: GraphEditOp[] = [];
    const graph = graphJson ? this.parseGraph(graphJson) : null;
    const labelOf = (id: string | undefined) => (id && graph?.nodes.find((n) => n.id === id)?.data.label) || id || 'A step';

    if (graph) {
      for (const issue of compileStudioGraph(graph).issues.filter((i) => i.level === 'error')) {
        const node = issue.nodeId ? graph.nodes.find((n) => n.id === issue.nodeId) : undefined;
        const app = node?.data.config?.['needsConnection'];
        findings.push({
          ...(issue.nodeId ? { nodeId: issue.nodeId } : {}),
          step: labelOf(issue.nodeId),
          code: 'GRAPH',
          message: issue.message,
          hint: app ? `Connect ${String(app)} in Integrations, then pick the action on this step.` : 'Fix this on the canvas before the next run.',
          retryable: false,
          ...(typeof app === 'string' ? { connect: app } : {}),
        });
      }
    }

    const recent = (await this.runs.listRuns(workspaceId, agentId)) as Array<{ id: string; status: string }>;
    const failed = recent.find((r) => r.status === 'FAILED') ?? null;
    if (!failed) {
      const summary = findings.length
        ? `There are no failed runs, but ${findings.length === 1 ? 'one thing' : `${findings.length} things`} will stop the next one.`
        : recent.length
          ? 'The recent runs didn’t fail. Nothing to fix.'
          : 'This agent hasn’t run yet. Run a test to see how it does.';
      // Nothing failed, so there is nothing to retry.
      return { runId: recent[0]?.id ?? null, status: recent[0]?.status ?? null, summary, findings, ops, retrySafe: false };
    }

    const run = (await this.runs.getRun(workspaceId, failed.id)) as unknown as {
      id: string;
      status: string;
      errorsJson: { message?: string } | null;
      steps: Array<{ stepId: string; status: string; errorMessage: string | null; outputJson: unknown }>;
    };
    const failedSteps = run.steps.filter((s) => s.status === 'FAILED');
    const retryTargets: string[] = [];
    for (const step of failedSteps) {
      const out = (step.outputJson && typeof step.outputJson === 'object' ? step.outputJson : {}) as Record<string, unknown>;
      const message = step.errorMessage || String(out['error'] ?? '') || 'The step failed without saying why.';
      const classified = classifyStepError(message);
      const node = graph?.nodes.find((n) => n.id === step.stepId);
      const tool = String(node?.data.config?.['toolName'] ?? '');
      const app = classified.code === 'MISSING_CONNECTION' || classified.code === 'CONNECTION_EXPIRED' ? (tool.includes('.') ? tool.slice(0, tool.indexOf('.')) : /gmail|email/i.test(message) ? 'GMAIL' : undefined) : undefined;
      findings.push({
        nodeId: step.stepId,
        step: labelOf(step.stepId),
        code: classified.code,
        message,
        hint: classified.hint,
        retryable: classified.retryable,
        ...(app ? { connect: app } : {}),
      });
      if (classified.retryable && node && Number(node.data.config?.['retries'] ?? 0) < 3) retryTargets.push(step.stepId);
    }
    if (!failedSteps.length && run.errorsJson?.message) {
      const classified = classifyStepError(run.errorsJson.message);
      findings.push({ step: 'The run', code: classified.code, message: run.errorsJson.message, hint: classified.hint, retryable: classified.retryable });
    }
    if (retryTargets.length) ops.push({ op: 'set_retries', retries: 3, nodeIds: retryTargets });

    const runFindings = findings.filter((f) => f.code !== 'GRAPH');
    const retrySafe = runFindings.length > 0 && runFindings.every((f) => f.retryable) && !findings.some((f) => f.code === 'GRAPH');
    const first = runFindings[0];
    const summary = first
      ? `${first.step} failed: ${first.message}${first.connect ? ` — ${first.connect.charAt(0) + first.connect.slice(1).toLowerCase()} needs to be (re)connected.` : ''} ${retrySafe ? 'It was a temporary problem, so retrying is safe.' : 'Retrying as-is would fail the same way.'}`
      : 'The last run failed, but no step recorded why.';
    return { runId: run.id, status: run.status, summary: summary.trim(), findings, ops, retrySafe };
  }

  /** Workflow numbers and suggestions, plus how the last runs actually went. */
  async optimize(workspaceId: string, agentId: string, graphJson: string): Promise<ArchitectOptimizeResult> {
    const graph = this.parseGraph(graphJson);
    const analysis = analyzeStudioGraph(graph);
    const recent = (await this.runs.listRuns(workspaceId, agentId)) as Array<{ status: string; latencyMs: number; tokensUsed: number; totalCost: number }>;
    const finished = recent.filter((r) => r.status === 'COMPLETED' || r.status === 'FAILED');
    const avg = (pick: (r: (typeof finished)[number]) => number) => (finished.length ? finished.reduce((n, r) => n + (pick(r) || 0), 0) / finished.length : null);
    return {
      ...analysis,
      runs: {
        count: finished.length,
        failureRate: finished.length ? finished.filter((r) => r.status === 'FAILED').length / finished.length : null,
        avgLatencyMs: avg((r) => r.latencyMs),
        avgTokens: avg((r) => r.tokensUsed),
        avgCost: avg((r) => r.totalCost),
      },
    };
  }

  /* ---------------------------------------------------------------- helpers -- */

  private parseGraph(graphJson: string): StudioCanvasGraph {
    if (!isStudioGraph(graphJson)) {
      throw new BadRequestException({ code: 'NOT_A_CANVAS_GRAPH', message: 'There’s no workflow on the canvas to change yet. Describe the agent first and I’ll build one.' });
    }
    const raw = JSON.parse(graphJson) as { nodes: unknown[]; edges?: unknown[]; settings?: Record<string, unknown> };
    const nodes = (raw.nodes as Array<Record<string, unknown>>).map((n) => {
      const data = (n['data'] && typeof n['data'] === 'object' ? n['data'] : {}) as Record<string, unknown>;
      return {
        ...n,
        id: String(n['id']),
        type: String(n['type'] ?? ''),
        position: (n['position'] as { x: number; y: number }) ?? { x: 0, y: 0 },
        data: { ...data, label: typeof data['label'] === 'string' ? data['label'] : String(n['type'] ?? ''), config: (data['config'] && typeof data['config'] === 'object' ? data['config'] : {}) as Record<string, unknown> },
      };
    });
    return { nodes, edges: (Array.isArray(raw.edges) ? raw.edges : []) as StudioCanvasGraph['edges'], ...(raw.settings ? { settings: raw.settings } : {}) };
  }

  private context(catalog: StudioCatalog, knowledgeBases: Array<{ id: string; name: string }>, timezone: string): ArchitectContext {
    return {
      connectedApps: catalog.apps.filter((a) => a.status === 'CONNECTED').map((a) => a.provider),
      appActions: Object.fromEntries(catalog.apps.map((a) => [a.provider, a.actions.map((x) => ({ tool: x.tool, label: x.label, access: x.access }))])),
      knowledgeBases,
      timezone,
    };
  }

  private async editContext(workspaceId: string, userId: string): Promise<EditInterpretationContext> {
    const [catalog, knowledgeBases, timezone, models] = await Promise.all([
      this.planner.catalog(workspaceId, userId),
      this.knowledgeBases(workspaceId),
      this.userTimezone(userId),
      this.usableModels(workspaceId),
    ]);
    const base = this.context(catalog, knowledgeBases, timezone);
    return { ...base, models, parseSchedule: (text) => parseScheduleText(text), timezone };
  }

  /** Models the workspace can really call: enabled, with a key for their provider. */
  private async usableModels(workspaceId: string): Promise<EditInterpretationContext['models']> {
    const enabled = this.providers?.getEnabledModels() ?? [];
    const keyed = new Map<string, boolean>();
    const out: Array<{ id: string; label: string; provider: string }> = [];
    for (const m of enabled) {
      if (!keyed.has(m.provider)) {
        const cred = await this.credentials.resolveCredential(m.provider, { workspaceId }).catch(() => ({ apiKey: undefined }));
        keyed.set(m.provider, !!cred.apiKey);
      }
      if (keyed.get(m.provider)) out.push({ id: m.model, label: m.name, provider: String(m.provider) });
    }
    return out.slice(0, 60);
  }

  private async knowledgeBases(workspaceId: string) {
    return this.prisma.knowledgeBase.findMany({ where: { workspaceId }, select: { id: true, name: true }, orderBy: { updatedAt: 'desc' }, take: 50 });
  }

  private async userTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return user?.timezone || 'UTC';
  }

  private async proposeWithModel(
    workspaceId: string,
    command: string,
    graph: StudioCanvasGraph,
    ctx: EditInterpretationContext,
  ): Promise<{ ops: GraphEditOp[]; explanation: string; model: string; dropped: number }> {
    const path = new Set(mainPath(graph).map((n) => n.id));
    const nodeLines = graph.nodes.map((n) => {
      const cfg = n.data.config ?? {};
      const keys = ['toolName', 'model', 'retries', 'cron', 'event', 'knowledgeBaseId', 'delegation', 'needsConnection'].filter((k) => cfg[k] !== undefined && cfg[k] !== '');
      const instructions = typeof cfg['instructions'] === 'string' ? ` instructions="${String(cfg['instructions']).slice(0, 160).replace(/\s+/g, ' ')}"` : '';
      return `- id=${n.id} type=${n.type} label="${n.data.label}"${path.has(n.id) ? '' : ' (not on the main path)'}${keys.map((k) => ` ${k}=${JSON.stringify(cfg[k])}`).join('')}${instructions}`;
    });
    const edgeLines = graph.edges.map((e) => `- ${e.source} -> ${e.target}${e.sourceHandle ? ` [${e.sourceHandle}]` : ''}`);
    const system = [
      'You edit an AI agent’s workflow in AI Agent Studio. Reply with JSON only: { "explanation": one or two plain sentences saying what you will change, "ops": [...] }.',
      'Make the smallest change that does what the person asked. Never rebuild the workflow. If the request needs nothing changed, return "ops": [].',
      '',
      'Ops:',
      '- { "op": "update_step", "nodeId", "label"?, "config": { ...keys to set } } — e.g. instructions (tone/format), goal (the step’s task), temperature, toolName, input (JSON string).',
      `- { "op": "add_step", "type": one of ${EDITABLE_NODE_TYPES.join('|')}, "label", "config"?, "after"?: nodeId, "before"?: nodeId }`,
      '- { "op": "remove_step", "nodeId" }',
      '- { "op": "set_trigger", "kind": "manual"|"schedule"|"event", "cron"?: 5-field cron in the person’s time zone, "event"? }',
      '- { "op": "set_model", "model": one of the model ids below }',
      '- { "op": "set_retries", "retries": 0-5, "nodeIds"? }',
      '- { "op": "insert_approval_before", "nodeIds": [...] }',
      '- { "op": "attach_knowledge", "knowledgeBaseId"? }',
      '- { "op": "convert_to_team", "mode": "router"|"sequential"|"parallel", "members"?: [{ "name", "role", "instructions" }] }',
      '- { "op": "merge_steps", "keep": nodeId, "remove": nodeId }',
      '',
      `Time zone: ${ctx.timezone ?? 'UTC'}.`,
      `Models available: ${ctx.models.length ? ctx.models.map((m) => m.id).join(', ') : 'only the workspace default'}.`,
      `Knowledge bases: ${ctx.knowledgeBases.length ? ctx.knowledgeBases.map((k) => `${k.id} (${k.name})`).join(', ') : 'none'}.`,
      `Connected apps: ${ctx.connectedApps.length ? ctx.connectedApps.join(', ') : 'none'}.`,
      '',
      'Workflow nodes:',
      ...nodeLines,
      'Edges:',
      ...edgeLines,
    ].join('\n');

    const { response, provider, model } = await chatWithFailover(
      { ai: this.ai, modelResolver: this.modelResolver, credentials: this.credentials, providers: this.providers },
      workspaceId,
      {},
      [
        { role: 'system', content: system },
        { role: 'user', content: command },
      ],
      { temperature: 0.1, maxTokens: 1_500, timeoutMs: EDIT_TIMEOUT_MS },
    );
    const raw = extractJsonObject(response.message?.content ?? '');
    if (!raw || typeof raw !== 'object') throw new Error('the model didn’t return a change it could read');
    const { ops, dropped } = sanitizeEditOps(raw, graph, ctx);
    const explanation = typeof (raw as { explanation?: unknown }).explanation === 'string' ? String((raw as { explanation: string }).explanation).slice(0, 600) : '';
    return { ops, explanation, model: modelLabel(provider, model), dropped };
  }
}

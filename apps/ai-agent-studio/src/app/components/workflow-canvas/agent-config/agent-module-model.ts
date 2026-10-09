import {
  connectorToolName,
  estimateTokens,
  composeAgentPrompt,
  lintAgentPrompt,
  parseConnectorActionRef,
  readCanvasToolPolicies,
  readKnowledgeBinding,
  readPromptSettings,
  readRunLimits,
  type AgentPromptSettings,
  type AgentRunLimits,
  type CanvasToolPolicy,
  type KnowledgeBindingSettings,
  type StudioGraphIssue,
} from '@org/types';
import type { Edge, Node } from '@xyflow/react';
import { DELEGATION_MODES, resolveAgentModel, slotAttachments, supervisorOf, type AgentSlotId, type DelegationMode } from '../agent-slots.js';

/**
 * An agent's five capability modules, read from — and written back to — the
 * canvas graph. There is no second copy of the configuration: the drawer edits
 * a draft of node configs, the card summary and validation read the same
 * graph, and the run compiler (`compileStudioGraph`) reads it too.
 *
 * Where each setting lives (unchanged from before, so old agents load as-is):
 * - Prompt text: the plugged-in Prompt node's `prompt`, else the agent's `instructions`.
 *   Structured prompt settings: the agent's `promptSettings`.
 * - LLM: the plugged-in LLM node's `model` / `temperature` / `maxTokens` /
 *   `fallbackModel`, else the agent's own; `maxSteps` on the agent.
 * - Knowledge: one knowledge card per source, plugged into the Knowledge (`embedding`) slot.
 * - Tools: the agent's `tools` (built-in names and `PROVIDER.action` refs),
 *   plus tool cards plugged into the Tools slot; `toolPolicies` on the agent.
 * - Sub-agents: agents plugged into the Sub-agents slot; `delegation` on the
 *   lead; team limits in the graph's `settings.limits`.
 */
export type AgentModuleId = 'prompt' | 'llm' | 'knowledge' | 'tools' | 'subAgents';

export interface ModuleSectionDef {
  id: string;
  label: string;
  /** Extra words the drawer's settings search matches. */
  keywords: string;
}

export interface AgentModuleDef {
  id: AgentModuleId;
  slot: AgentSlotId;
  label: string;
  description: string;
  sections: ModuleSectionDef[];
}

/** The modules' schema: what the drawer navigates and searches. */
export const AGENT_MODULES: AgentModuleDef[] = [
  {
    id: 'prompt',
    slot: 'prompt',
    label: 'Prompt',
    description: 'Instructions and behaviour',
    sections: [
      { id: 'overview', label: 'Overview', keywords: 'status tokens length summary lint' },
      { id: 'instructions', label: 'Instructions', keywords: 'system prompt role objective persona template markdown' },
      { id: 'goals', label: 'Goals & rules', keywords: 'goals constraints success criteria responsibilities behaviour' },
      { id: 'variables', label: 'Variables', keywords: 'variables placeholders default required {{' },
      { id: 'examples', label: 'Examples', keywords: 'few-shot examples positive negative input output' },
      { id: 'output', label: 'Output', keywords: 'format json schema markdown plain text structured tone' },
      { id: 'reasoning', label: 'Reasoning', keywords: 'planning self-check reflection clarify' },
      { id: 'guardrails', label: 'Guardrails', keywords: 'safety citations hallucination personal data pii escalation' },
      { id: 'testing', label: 'Testing', keywords: 'test preview resolved run compare model' },
      { id: 'versions', label: 'Versions', keywords: 'history compare restore rollback' },
    ],
  },
  {
    id: 'llm',
    slot: 'llm',
    label: 'LLM',
    description: 'Model, generation and limits',
    sections: [
      { id: 'overview', label: 'Overview', keywords: 'status provider summary' },
      { id: 'model', label: 'Model', keywords: 'provider model context window capabilities vision tools streaming' },
      { id: 'generation', label: 'Generation', keywords: 'temperature max tokens output length' },
      { id: 'routing', label: 'Fallback', keywords: 'fallback routing availability backup' },
      { id: 'runtime', label: 'Runtime', keywords: 'tool rounds steps iterations limit' },
      { id: 'usage', label: 'Usage & cost', keywords: 'tokens cost pricing latency estimate' },
      { id: 'testing', label: 'Testing', keywords: 'test model output latency' },
    ],
  },
  {
    id: 'knowledge',
    slot: 'embedding',
    label: 'Knowledge',
    description: 'What the agent can look things up in',
    sections: [
      { id: 'overview', label: 'Overview', keywords: 'status sources summary' },
      { id: 'sources', label: 'Sources', keywords: 'knowledge base documents files add remove enable' },
      { id: 'retrieval', label: 'Retrieval', keywords: 'semantic keyword hybrid top k similarity threshold score' },
      { id: 'testing', label: 'Retrieval debugger', keywords: 'test query retrieved scores context' },
    ],
  },
  {
    id: 'tools',
    slot: 'tools',
    label: 'Tools',
    description: 'Actions the agent may take',
    sections: [
      { id: 'overview', label: 'Overview', keywords: 'status summary count' },
      { id: 'enabled', label: 'Enabled tools', keywords: 'enabled attached remove' },
      { id: 'builtin', label: 'Built-in tools', keywords: 'built-in search docs tasks memory web firecrawl' },
      { id: 'apps', label: 'App connectors', keywords: 'apps connectors slack gmail github notion integrations' },
      { id: 'permissions', label: 'Permissions', keywords: 'approval ask block confirm permission read write delete' },
      { id: 'testing', label: 'Testing', keywords: 'test tool input output run' },
    ],
  },
  {
    id: 'subAgents',
    slot: 'agents',
    label: 'Sub-agents',
    description: 'Specialists this agent delegates to',
    sections: [
      { id: 'overview', label: 'Overview', keywords: 'status team summary' },
      { id: 'members', label: 'Team', keywords: 'sub-agents members add remove role specialist' },
      { id: 'delegation', label: 'Delegation', keywords: 'router sequential parallel review pattern supervisor' },
      { id: 'limits', label: 'Limits', keywords: 'max delegations steps timeout tokens budget' },
      { id: 'testing', label: 'Testing', keywords: 'test run delegation result' },
    ],
  },
];

export const MODULE_BY_ID = new Map(AGENT_MODULES.map((m) => [m.id, m]));
export const MODULE_BY_SLOT = new Map(AGENT_MODULES.map((m) => [m.slot, m]));

/* ------------------------------------------------------------- the view -- */

type Config = Record<string, unknown>;
export const configOf = (n: Node | undefined): Config => ((n?.data as { config?: Config } | undefined)?.config ?? {}) as Config;
export const labelOf = (n: Node | undefined): string =>
  String((n?.data as { label?: string; title?: string } | undefined)?.label || (n?.data as { title?: string } | undefined)?.title || n?.type || 'Step');
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

export interface PromptModuleView {
  /** Where the prompt text is stored. */
  textNodeId: string;
  textKey: 'prompt' | 'instructions';
  fromPromptNode: boolean;
  text: string;
  role: string;
  settings: AgentPromptSettings;
  composed: string;
}

export interface LlmModuleView {
  /** Where model settings are stored: the LLM node, else the agent. */
  targetNodeId: string;
  fromLlmNode: boolean;
  model: string;
  /** What the agent actually runs on (its own setting or its supervisor's). */
  resolved: { model: string; inherited: boolean } | null;
  fallbackModel: string;
  temperature: number | undefined;
  maxTokens: number | undefined;
  maxSteps: number | undefined;
}

export interface KnowledgeSourceView {
  nodeId: string;
  label: string;
  type: string;
  binding: KnowledgeBindingSettings | null;
  enabled: boolean;
}

export interface ToolEntryView {
  /** Stable key: the name in `tools`, or `node:<id>` for a plugged-in card. */
  key: string;
  kind: 'builtin' | 'connector';
  /** The runtime function name (`search_docs`, `slack_send_message`). */
  toolName: string;
  label: string;
  /** For connector tools. */
  provider?: string;
  actionId?: string;
  /** The plugged-in card, when the tool is one. */
  nodeId?: string;
  policy?: CanvasToolPolicy;
}

export interface SubAgentView {
  nodeId: string;
  label: string;
  role: string;
  type: string;
  model: { model: string; inherited: boolean } | null;
  hasPrompt: boolean;
  toolCount: number;
  memberCount: number;
}

export interface AgentModulesView {
  agentId: string;
  agentLabel: string;
  prompt: PromptModuleView;
  llm: LlmModuleView;
  knowledge: { sources: KnowledgeSourceView[] };
  tools: { entries: ToolEntryView[]; builtinNames: string[]; policies: Record<string, CanvasToolPolicy> };
  subAgents: {
    members: SubAgentView[];
    delegation: DelegationMode;
    isSupervised: boolean;
    limits: AgentRunLimits;
  };
}

/** Everything the five modules show for one agent, from the graph. */
export function readAgentModules(agent: Node, nodes: Node[], edges: Edge[], graphSettings?: unknown): AgentModulesView {
  const cfg = configOf(agent);
  const attached = slotAttachments(agent.id, nodes, edges);

  const promptNode = attached.prompt[0];
  const settings = readPromptSettings(cfg['promptSettings']);
  const promptText = promptNode ? text(configOf(promptNode)['prompt']) || text(configOf(promptNode)['template']) : text(cfg['instructions']);

  const llmNode = attached.llm[0];
  const llmCfg = llmNode ? configOf(llmNode) : cfg;

  const policies = readCanvasToolPolicies(cfg['toolPolicies']);
  const builtinNames: string[] = [];
  const entries: ToolEntryView[] = [];
  for (const raw of Array.isArray(cfg['tools']) ? (cfg['tools'] as unknown[]) : []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const ref = parseConnectorActionRef(raw);
    if (ref) {
      entries.push({
        key: raw,
        kind: 'connector',
        toolName: connectorToolName(ref.provider, ref.actionId),
        label: ref.actionId.replace(/_/g, ' '),
        provider: ref.provider,
        actionId: ref.actionId,
        policy: policies[raw],
      });
    } else {
      const name = raw === 'kb_search' ? 'search_docs' : raw;
      builtinNames.push(name);
      entries.push({ key: raw, kind: 'builtin', toolName: name, label: name.replace(/_/g, ' '), policy: policies[raw] ?? policies[name] });
    }
  }
  for (const n of attached.tools) {
    const c = configOf(n);
    const provider = text(c['provider'] || c['connectorId']).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const actionId = text(c['actionId']);
    const isConnector = Boolean(provider && actionId) || String(n.type).toUpperCase().startsWith('TEAMS_');
    const toolName = isConnector && provider && actionId ? connectorToolName(provider, actionId) : text(c['toolName']) || String(n.type).toLowerCase();
    entries.push({
      key: `node:${n.id}`,
      kind: isConnector ? 'connector' : 'builtin',
      toolName,
      label: labelOf(n),
      ...(isConnector ? { provider, actionId } : {}),
      nodeId: n.id,
      policy: policies[isConnector && provider && actionId ? `${provider}.${actionId}` : toolName],
    });
  }

  const delegation = DELEGATION_MODES.some((m) => m.value === cfg['delegation']) ? (cfg['delegation'] as DelegationMode) : 'router';
  return {
    agentId: agent.id,
    agentLabel: labelOf(agent),
    prompt: {
      textNodeId: promptNode?.id ?? agent.id,
      textKey: promptNode ? 'prompt' : 'instructions',
      fromPromptNode: Boolean(promptNode),
      text: promptText,
      role: text(cfg['role']),
      settings,
      composed: composeAgentPrompt(promptText, settings),
    },
    llm: {
      targetNodeId: llmNode?.id ?? agent.id,
      fromLlmNode: Boolean(llmNode),
      model: text(llmCfg['model']),
      resolved: resolveAgentModel(agent.id, nodes, edges),
      fallbackModel: text(llmCfg['fallbackModel']),
      temperature: num(llmCfg['temperature']),
      maxTokens: num(llmCfg['maxTokens']),
      maxSteps: num(cfg['maxSteps']) ?? num(cfg['maxIterations']),
    },
    knowledge: {
      sources: attached.embedding.map((n) => ({
        nodeId: n.id,
        label: labelOf(n),
        type: String(n.type),
        binding: readKnowledgeBinding(configOf(n)),
        enabled: configOf(n)['enabled'] !== false,
      })),
    },
    tools: { entries, builtinNames, policies },
    subAgents: {
      members: attached.agents.map((m) => {
        const mAttached = slotAttachments(m.id, nodes, edges);
        const mCfg = configOf(m);
        return {
          nodeId: m.id,
          label: labelOf(m),
          role: text(mCfg['role']),
          type: String(m.type),
          model: resolveAgentModel(m.id, nodes, edges),
          hasPrompt: Boolean(mAttached.prompt.length || text(mCfg['instructions']).trim()),
          toolCount: mAttached.tools.length + (Array.isArray(mCfg['tools']) ? (mCfg['tools'] as unknown[]).length : 0),
          memberCount: mAttached.agents.length,
        };
      }),
      delegation,
      isSupervised: Boolean(supervisorOf(agent.id, edges)),
      limits: readRunLimits(graphSettings),
    },
  };
}

/* ------------------------------------------------------- issues & summary -- */

export interface ModuleIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
  /** Drawer section to open, and the field to focus (an element id suffix). */
  section: string;
  field?: string;
}

export type ModuleState = 'configured' | 'empty' | 'warning' | 'error';

export interface ModuleSummary {
  id: AgentModuleId;
  label: string;
  /** One line under the label on the card. */
  title: string;
  /** Second, optional line. */
  detail?: string;
  state: ModuleState;
  count: number;
  issues: ModuleIssue[];
}

export interface ModuleContext {
  /** Compiler issues per node id (what a run would complain about). */
  issuesByNode?: Map<string, StudioGraphIssue[]>;
  /** Display names for model ids, when known. */
  modelLabel?: (model: string) => string;
  /** Ids of other steps on the canvas (valid `{{stepId.*}}` roots). */
  stepIds?: string[];
}

const PROMPT_FIELD_SECTION: Record<string, string> = {
  instructions: 'instructions',
  objective: 'instructions',
  goals: 'goals',
  constraints: 'goals',
  variables: 'variables',
  examples: 'examples',
  output: 'output',
  tone: 'output',
};

const compilerIssues = (ctx: ModuleContext, nodeIds: string[], section: string): ModuleIssue[] =>
  nodeIds.flatMap((id) =>
    (ctx.issuesByNode?.get(id) ?? []).map((i) => ({ level: i.level, message: i.message, section, field: `node-${id}` })),
  );

/** Validation for one module — shown on the card, in the overview and next to fields. */
export function validateModule(id: AgentModuleId, view: AgentModulesView, ctx: ModuleContext = {}): ModuleIssue[] {
  switch (id) {
    case 'prompt': {
      const lint = lintAgentPrompt(view.prompt.text, view.prompt.settings, ctx.stepIds ?? []);
      return lint.map((i) => ({ level: i.level, message: i.message, section: PROMPT_FIELD_SECTION[i.field] ?? 'instructions', field: i.field }));
    }
    case 'llm': {
      const out: ModuleIssue[] = [];
      if (!view.llm.resolved) out.push({ level: 'error', message: 'No model: pick one or plug in an LLM.', section: 'model', field: 'model' });
      if (view.llm.fallbackModel && view.llm.fallbackModel === (view.llm.model || view.llm.resolved?.model)) {
        out.push({ level: 'info', message: 'The fallback model is the same as the main model.', section: 'routing', field: 'fallbackModel' });
      }
      if (view.llm.maxTokens !== undefined && view.llm.maxTokens < 64) {
        out.push({ level: 'warning', message: `Max tokens is ${view.llm.maxTokens} — replies will be cut short.`, section: 'generation', field: 'maxTokens' });
      }
      return [...out, ...compilerIssues(ctx, view.llm.fromLlmNode ? [view.llm.targetNodeId] : [], 'model')];
    }
    case 'knowledge': {
      const out: ModuleIssue[] = [];
      for (const s of view.knowledge.sources) {
        if (!s.binding) out.push({ level: 'warning', message: `${s.label}: pick a knowledge base.`, section: 'sources', field: `node-${s.nodeId}` });
      }
      return out;
    }
    case 'tools': {
      const out: ModuleIssue[] = compilerIssues(
        ctx,
        view.tools.entries.flatMap((e) => (e.nodeId ? [e.nodeId] : [])),
        'enabled',
      );
      const names = view.tools.entries.map((e) => e.toolName);
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      for (const d of [...new Set(dupes)]) out.push({ level: 'info', message: `${d} is enabled twice.`, section: 'enabled' });
      return out;
    }
    case 'subAgents': {
      const out: ModuleIssue[] = [];
      for (const m of view.subAgents.members) {
        if (!m.hasPrompt) out.push({ level: 'warning', message: `${m.label} has no instructions.`, section: 'members', field: `node-${m.nodeId}` });
        if (!m.model) out.push({ level: 'warning', message: `${m.label} has no model.`, section: 'members', field: `node-${m.nodeId}` });
      }
      return [...out, ...compilerIssues(ctx, view.subAgents.members.map((m) => m.nodeId), 'members')];
    }
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function stateOf(issues: ModuleIssue[], configured: boolean): ModuleState {
  if (issues.some((i) => i.level === 'error')) return 'error';
  if (issues.some((i) => i.level === 'warning')) return 'warning';
  return configured ? 'configured' : 'empty';
}

/** The card's compact summary of one module. */
export function summarizeModule(id: AgentModuleId, view: AgentModulesView, ctx: ModuleContext = {}): ModuleSummary {
  const issues = validateModule(id, view, ctx);
  const def = MODULE_BY_ID.get(id)!;
  const base = { id, label: def.label, issues };
  const modelName = (m: string) => ctx.modelLabel?.(m) ?? m.replace(':latest', '');

  switch (id) {
    case 'prompt': {
      const s = view.prompt.settings;
      const vars = s.variables.length;
      const examples = s.examples.filter((e) => e.enabled).length;
      const hasText = Boolean(view.prompt.text.trim() || s.objective.trim());
      const title = !hasText ? 'No instructions yet' : view.prompt.fromPromptNode ? 'Using the plugged-in prompt' : 'Using built-in instructions';
      const bits = [
        vars ? plural(vars, 'variable') : '',
        examples ? plural(examples, 'example') : '',
        s.output.format !== 'auto' ? s.output.format.toUpperCase() : '',
        `~${estimateTokens(view.prompt.composed).toLocaleString()} tokens`,
      ].filter(Boolean);
      return { ...base, title, detail: hasText ? bits.join(' · ') : undefined, state: stateOf(issues, hasText), count: view.prompt.fromPromptNode ? 1 : 0 };
    }
    case 'llm': {
      const r = view.llm.resolved;
      const title = r ? `${r.inherited ? 'Inherited · ' : ''}${modelName(r.model)}` : 'No model';
      const bits = [
        view.llm.temperature !== undefined ? `Temperature ${view.llm.temperature}` : '',
        view.llm.maxTokens !== undefined ? `${view.llm.maxTokens.toLocaleString()} max tokens` : '',
        view.llm.fallbackModel ? `Fallback ${modelName(view.llm.fallbackModel)}` : '',
      ].filter(Boolean);
      return { ...base, title, detail: bits.join(' · ') || undefined, state: stateOf(issues, Boolean(r)), count: view.llm.fromLlmNode ? 1 : 0 };
    }
    case 'knowledge': {
      const sources = view.knowledge.sources;
      const active = sources.filter((s) => s.enabled && s.binding);
      const modes = [...new Set(active.map((s) => s.binding?.mode ?? 'AUTO'))];
      const modeLabel = modes.length === 1 ? (modes[0] === 'AUTO' ? 'Semantic retrieval' : `${modes[0][0]}${modes[0].slice(1).toLowerCase()} retrieval`) : 'Mixed retrieval';
      return {
        ...base,
        title: sources.length ? plural(sources.length, 'source') : 'No knowledge',
        detail: active.length ? `${modeLabel} · top ${Math.max(...active.map((s) => s.binding!.topK))}` : undefined,
        state: stateOf(issues, sources.length > 0),
        count: sources.length,
      };
    }
    case 'tools': {
      const entries = view.tools.entries;
      const apps = new Set(entries.filter((e) => e.kind === 'connector').map((e) => e.provider));
      const gated = entries.filter((e) => e.policy).length;
      const bits = [apps.size ? plural(apps.size, 'app') : '', gated ? `${gated} need approval or blocked` : ''].filter(Boolean);
      return {
        ...base,
        title: entries.length ? `${entries.length} enabled` : 'No tools',
        detail: bits.join(' · ') || undefined,
        state: stateOf(issues, entries.length > 0),
        count: entries.length,
      };
    }
    case 'subAgents': {
      const members = view.subAgents.members;
      const mode = DELEGATION_MODES.find((m) => m.value === view.subAgents.delegation)?.label ?? 'Router';
      return {
        ...base,
        title: members.length ? plural(members.length, 'specialist') : 'Works alone',
        detail: members.length ? `${mode} delegation` : undefined,
        state: stateOf(issues, members.length > 0),
        count: members.length,
      };
    }
  }
}

export function summarizeAgentModules(view: AgentModulesView, ctx: ModuleContext = {}): ModuleSummary[] {
  return AGENT_MODULES.map((m) => summarizeModule(m.id, view, ctx));
}

/* ------------------------------------------------------------- drafts -- */

/** Edits in the drawer before Save: node configs by node id, plus graph settings. */
export interface ModuleDraft {
  configs: Record<string, Config>;
  graphSettings?: Config;
}

export const emptyDraft = (): ModuleDraft => ({ configs: {} });

/** The graph with a draft laid over it — what every view in the drawer reads. */
export function applyDraft(nodes: Node[], draft: ModuleDraft): Node[] {
  if (Object.keys(draft.configs).length === 0) return nodes;
  return nodes.map((n) => (draft.configs[n.id] ? { ...n, data: { ...n.data, config: draft.configs[n.id] } } : n));
}

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Config).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );

/** Node ids and settings the draft actually changes (drafts equal to the graph don't count). */
export function draftChanges(nodes: Node[], draft: ModuleDraft, graphSettings: unknown): { nodeIds: string[]; settings: boolean } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = Object.entries(draft.configs)
    .filter(([id, cfg]) => byId.has(id) && stable(cfg) !== stable(configOf(byId.get(id))))
    .map(([id]) => id);
  const settings = draft.graphSettings !== undefined && stable(draft.graphSettings) !== stable(graphSettings ?? {});
  return { nodeIds, settings };
}

/** Merges a patch into a node's draft config (starting from the graph's). `undefined` removes a key. */
export function patchDraft(draft: ModuleDraft, nodes: Node[], nodeId: string, patch: Config): ModuleDraft {
  const base = draft.configs[nodeId] ?? configOf(nodes.find((n) => n.id === nodeId));
  const next: Config = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return { ...draft, configs: { ...draft.configs, [nodeId]: next } };
}

/** Graph-level run limits a team uses, as the draft's `settings.limits`. */
export function patchLimits(draft: ModuleDraft, graphSettings: unknown, limits: Partial<AgentRunLimits>): ModuleDraft {
  const base = (draft.graphSettings ?? (graphSettings as Config | undefined) ?? {}) as Config;
  const current = (base['limits'] ?? {}) as Config;
  const next: Config = { ...current };
  for (const [k, v] of Object.entries(limits)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return { ...draft, graphSettings: { ...base, limits: next } };
}

/**
 * The config keys each module owns on each node, for Copy / Export / Import
 * and "Reset to defaults". Keys not listed are never touched.
 */
export function moduleConfigKeys(id: AgentModuleId, view: AgentModulesView): Record<string, string[]> {
  switch (id) {
    case 'prompt':
      return view.prompt.fromPromptNode
        ? { [view.prompt.textNodeId]: ['prompt'], [view.agentId]: ['role', 'promptSettings', 'rules', 'promptTests'] }
        : { [view.agentId]: ['instructions', 'role', 'promptSettings', 'rules', 'promptTests'] };
    case 'llm':
      return view.llm.fromLlmNode
        ? { [view.llm.targetNodeId]: ['model', 'temperature', 'maxTokens', 'fallbackModel'], [view.agentId]: ['maxSteps'] }
        : { [view.agentId]: ['model', 'temperature', 'maxTokens', 'fallbackModel', 'maxSteps'] };
    case 'knowledge':
      return Object.fromEntries(view.knowledge.sources.map((s) => [s.nodeId, ['knowledgeBaseId', 'topK', 'mode', 'minScore', 'enabled']]));
    case 'tools':
      return { [view.agentId]: ['tools', 'toolPolicies'] };
    case 'subAgents':
      return { [view.agentId]: ['delegation'] };
  }
}

/** Defaults "Reset to defaults" writes (a missing key means "remove it"). */
export const MODULE_DEFAULTS: Record<AgentModuleId, Config> = {
  prompt: { promptSettings: undefined },
  llm: { temperature: 0.7, maxTokens: undefined, fallbackModel: undefined, maxSteps: undefined },
  knowledge: { topK: 5, mode: undefined, minScore: undefined, enabled: undefined },
  tools: { toolPolicies: undefined },
  subAgents: { delegation: 'router' },
};

/** The module's own settings, portable: `{ nodeRole: { key: value } }` keyed by where they live. */
export function exportModule(id: AgentModuleId, view: AgentModulesView, nodes: Node[]): Config {
  const keys = moduleConfigKeys(id, view);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Config = { module: id, version: 1, nodes: {} as Config };
  for (const [nodeId, list] of Object.entries(keys)) {
    const cfg = configOf(byId.get(nodeId));
    const role = nodeId === view.agentId ? 'agent' : nodeId;
    (out['nodes'] as Config)[role] = Object.fromEntries(list.filter((k) => cfg[k] !== undefined).map((k) => [k, cfg[k]]));
  }
  return out;
}

/** An exported module back onto this agent: only the module's own keys, only on its own nodes. */
export function importModule(
  id: AgentModuleId,
  view: AgentModulesView,
  draft: ModuleDraft,
  nodes: Node[],
  payload: unknown,
): { draft: ModuleDraft; applied: number } {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Config;
  if (p['module'] !== id) throw new Error(`That file holds ${String(p['module'] ?? 'something else')} settings, not ${MODULE_BY_ID.get(id)?.label}.`);
  const keys = moduleConfigKeys(id, view);
  const incoming = (p['nodes'] ?? {}) as Record<string, Config>;
  // Other nodes match by id (same agent), else by position (exported from another agent).
  const others = Object.entries(incoming).filter(([role]) => role !== 'agent').map(([, v]) => v);
  let otherIndex = 0;
  let next = draft;
  let applied = 0;
  for (const [nodeId, list] of Object.entries(keys)) {
    const source = nodeId === view.agentId ? incoming['agent'] : (incoming[nodeId] ?? others[otherIndex]);
    if (nodeId !== view.agentId) otherIndex++;
    if (!source || typeof source !== 'object') continue;
    const patch = Object.fromEntries(list.filter((k) => k in source).map((k) => [k, source[k]]));
    if (Object.keys(patch).length) {
      next = patchDraft(next, nodes, nodeId, patch);
      applied += Object.keys(patch).length;
    }
  }
  return { draft: next, applied };
}

/** Section a module issue points at, for the card's warning icon. */
export function firstIssue(summary: ModuleSummary): ModuleIssue | undefined {
  return summary.issues.find((i) => i.level === 'error') ?? summary.issues.find((i) => i.level === 'warning');
}

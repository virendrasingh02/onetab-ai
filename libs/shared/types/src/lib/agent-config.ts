/**
 * What an AI agent actually runs with, and how the Agent Builder's graph turns
 * into it.
 *
 * The builder is a node graph (`AIAgent.graphJson`); the runtime reads plain
 * columns (`model`, `systemPrompt`, `tools`, …) plus `configuration.runtime`.
 * The builder used to save only `{ name, role, graphJson }`, so the model,
 * instructions and tools a member configured on the canvas never reached a
 * single run. `deriveAgentFromGraph` is now the one mapping, used by the API
 * on every save (so any client that writes a graph gets the same result) and
 * by the builder to preview what will run.
 *
 * Every setting in here is enforced by `AIRuntimeService` or the schedule
 * sweep. Settings the runtime cannot honour are not part of the contract.
 */

/* ------------------------------------------------------------ contract ---- */

/**
 * How much an agent may do without a person confirming:
 * - `supervised` — every tool call waits for approval, reads included;
 * - `semi` — reads run, anything that writes or sends waits for approval;
 * - `autonomous` — only tools flagged "require approval" (and integration
 *   actions their app marks destructive) wait.
 */
export type AgentAutonomy = 'supervised' | 'semi' | 'autonomous';

export interface AgentToolPolicy {
  requiresApproval?: boolean;
}

export interface AgentKnowledgeBinding {
  knowledgeBaseId: string;
  topK: number;
}

export type AgentPiiAction = 'redact' | 'block' | 'warn';

export interface AgentGuardrails {
  /** Personal data (emails, phone numbers, card and SSN-like numbers) in answers. */
  pii?: AgentPiiAction;
  /** Hard cap on completion tokens per model call. */
  maxTokensPerRun?: number;
}

export type AgentOutputKind = 'channel' | 'task' | 'webhook';

/** Where a *scheduled* run's result is delivered. Chat replies answer in place. */
export interface AgentOutputTarget {
  kind: AgentOutputKind;
  /** A channel id, a project id (optional for tasks), or an https URL. */
  target: string;
}

export interface AgentScheduleSpec {
  cronExpression: string;
  /** What the agent is asked to do when the schedule fires. */
  task: string;
  enabled: boolean;
}

export type AgentResponseFormat = 'markdown' | 'json' | 'plain';

export interface AgentRuntimeConfig {
  version: 1;
  autonomy: AgentAutonomy;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: AgentResponseFormat;
  /** Include facts saved with `save_memory` in every turn. */
  useWorkspaceMemory: boolean;
  knowledge: AgentKnowledgeBinding[];
  toolPolicies: Record<string, AgentToolPolicy>;
  guardrails: AgentGuardrails;
  outputs: AgentOutputTarget[];
  schedules: AgentScheduleSpec[];
}

/** Agents created without the builder (API, marketplace) behave as before. */
export const DEFAULT_AGENT_RUNTIME: AgentRuntimeConfig = {
  version: 1,
  autonomy: 'autonomous',
  useWorkspaceMemory: true,
  knowledge: [],
  toolPolicies: {},
  guardrails: {},
  outputs: [],
  schedules: [],
};

/**
 * Built-in tools that only read. Under `semi` autonomy these run without
 * approval; everything else — including tools this list does not know — is
 * treated as able to change things.
 */
export const READ_ONLY_AGENT_TOOLS: readonly string[] = [
  'search_docs',
  'list_projects',
  'list_tasks',
  'list_channels',
  'list_memory',
  'find_tasks',
  'get_project_overview',
  'list_meetings',
  'get_activity',
  'read_doc',
  'search_email',
  'list_reminders',
  'list_monitors',
  'firecrawl_search',
  'firecrawl_scrape',
  'firecrawl_crawl',
  'firecrawl_extract',
];

/**
 * Read-only tools over the owner's *own* data — their meetings, their activity,
 * their private docs, their mailbox. An agent or coworker answering other
 * people in a channel must not relay those, so they are never part of a
 * default tool set; an agent gets them only when its builder picks them.
 */
export const OWNER_PRIVATE_AGENT_TOOLS: readonly string[] = [
  'list_meetings',
  'get_activity',
  'read_doc',
  'search_email',
];

/** Whether a tool call must wait for a person under `runtime`. */
export function agentToolNeedsApproval(runtime: AgentRuntimeConfig, toolName: string): boolean {
  if (runtime.toolPolicies[toolName]?.requiresApproval) return true;
  if (runtime.autonomy === 'supervised') return true;
  if (runtime.autonomy === 'semi') return !READ_ONLY_AGENT_TOOLS.includes(toolName);
  return false;
}

/** Reads `AIAgent.configuration.runtime`, filling anything missing with defaults. */
export function readAgentRuntime(configuration: unknown): AgentRuntimeConfig {
  const raw =
    configuration && typeof configuration === 'object'
      ? ((configuration as Record<string, unknown>)['runtime'] as Partial<AgentRuntimeConfig> | undefined)
      : undefined;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AGENT_RUNTIME };
  return {
    ...DEFAULT_AGENT_RUNTIME,
    ...raw,
    knowledge: Array.isArray(raw.knowledge) ? raw.knowledge : [],
    toolPolicies: raw.toolPolicies && typeof raw.toolPolicies === 'object' ? raw.toolPolicies : {},
    guardrails: raw.guardrails && typeof raw.guardrails === 'object' ? raw.guardrails : {},
    outputs: Array.isArray(raw.outputs) ? raw.outputs : [],
    schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
    version: 1,
  };
}

/* ------------------------------------------------------------ the graph ---- */

/** Node kinds the Agent Builder places (`data.kind` on each React Flow node). */
export const AGENT_GRAPH_NODE_KINDS = [
  'agent',
  'trigger',
  'guardrail',
  'model',
  'prompt',
  'memory',
  'knowledge',
  'tool',
  'output',
] as const;
export type AgentGraphNodeKind = (typeof AGENT_GRAPH_NODE_KINDS)[number];

interface GraphNodeLike {
  id?: string;
  data?: { kind?: string; config?: Record<string, unknown> };
}

interface GraphEdgeLike {
  source?: string;
  target?: string;
}

/** The columns and runtime config a graph describes. */
export interface DerivedAgentConfig {
  name?: string;
  role?: string;
  description?: string;
  provider?: string;
  model?: string;
  systemPrompt?: string;
  tools: string[];
  runtime: AgentRuntimeConfig;
}

function nodesOf(graphJson: string): GraphNodeLike[] | null {
  try {
    const parsed = JSON.parse(graphJson) as { nodes?: unknown };
    return Array.isArray(parsed?.nodes) ? (parsed.nodes as GraphNodeLike[]) : null;
  } catch {
    return null;
  }
}

function edgesOf(graphJson: string): GraphEdgeLike[] {
  try {
    const parsed = JSON.parse(graphJson) as { edges?: unknown };
    return Array.isArray(parsed?.edges) ? (parsed.edges as GraphEdgeLike[]) : [];
  } catch {
    return [];
  }
}

/**
 * The nodes that affect a run: capabilities wired into the agent core, and
 * spine nodes reachable from it (triggers and guardrails upstream, outputs
 * downstream) — the same rule the builder states when it warns that a node
 * "is not connected to anything". A graph with no edges at all (written by an
 * API client rather than drawn) is taken whole.
 */
function connectedToCore(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): Set<string> {
  const ids = new Set(nodes.map((n) => String(n.id ?? '')));
  const core = nodes.find((n) => n.data?.kind === 'agent');
  if (!core?.id || edges.length === 0) return ids;

  const reached = new Set<string>([core.id]);
  const walk = (from: string, dir: 'up' | 'down') => {
    const queue = [from];
    while (queue.length) {
      const current = queue.shift() as string;
      for (const edge of edges) {
        const next = dir === 'up' ? (edge.target === current ? edge.source : undefined) : edge.source === current ? edge.target : undefined;
        if (next && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
  };
  walk(core.id, 'up');
  walk(core.id, 'down');
  return reached;
}

/**
 * Whether `graphJson` is an Agent Builder graph (every node has a known
 * `data.kind`) rather than the procedural START → AGENT → END shape the former
 * Agent Studio wrote — see `convertLegacyAgentGraph`.
 */
export function isAgentBuilderGraph(graphJson: string | null | undefined): boolean {
  if (!graphJson) return false;
  const nodes = nodesOf(graphJson);
  return (
    !!nodes &&
    nodes.length > 0 &&
    nodes.every((n) =>
      (AGENT_GRAPH_NODE_KINDS as readonly string[]).includes(String(n?.data?.kind ?? '')),
    )
  );
}

const text = (config: Record<string, unknown> | undefined, key: string): string | undefined => {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const number = (config: Record<string, unknown> | undefined, key: string): number | undefined => {
  const value = config?.[key];
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const RESPONSE_FORMATS: readonly AgentResponseFormat[] = ['markdown', 'json', 'plain'];
const AUTONOMY: readonly AgentAutonomy[] = ['supervised', 'semi', 'autonomous'];
const PII_ACTIONS: readonly AgentPiiAction[] = ['redact', 'block', 'warn'];

/**
 * The runtime configuration an Agent Builder graph describes, or `null` when
 * the graph is not a builder graph (nothing is derived from a legacy one).
 */
export function deriveAgentFromGraph(graphJson: string | null | undefined): DerivedAgentConfig | null {
  if (!graphJson || !isAgentBuilderGraph(graphJson)) return null;
  const allNodes = nodesOf(graphJson) ?? [];
  const live = connectedToCore(allNodes, edgesOf(graphJson));
  const nodes = allNodes.filter((n) => live.has(String(n.id ?? '')));
  const of = (kind: AgentGraphNodeKind) => nodes.filter((n) => n.data?.kind === kind);
  const cfg = (node: GraphNodeLike | undefined) => node?.data?.config;

  const core = cfg(of('agent')[0]);
  const model = cfg(of('model')[0]);
  const prompt = cfg(of('prompt')[0]);
  const memory = cfg(of('memory')[0]);

  const tools: string[] = [];
  const toolPolicies: Record<string, AgentToolPolicy> = {};
  for (const node of of('tool')) {
    const toolId = text(cfg(node), 'toolId');
    if (!toolId || tools.includes(toolId)) continue;
    tools.push(toolId);
    if (cfg(node)?.['requiresApproval'] === true) toolPolicies[toolId] = { requiresApproval: true };
  }

  const knowledge: AgentKnowledgeBinding[] = [];
  for (const node of of('knowledge')) {
    const knowledgeBaseId = text(cfg(node), 'knowledgeBaseId');
    if (!knowledgeBaseId) continue;
    knowledge.push({
      knowledgeBaseId,
      topK: Math.min(Math.max(Math.round(number(cfg(node), 'topK') ?? 5), 1), 20),
    });
  }

  const guardrails: AgentGuardrails = {};
  for (const node of of('guardrail')) {
    const policy = text(cfg(node), 'policy');
    const action = text(cfg(node), 'action');
    if (policy === 'pii-redaction' && action && (PII_ACTIONS as readonly string[]).includes(action)) {
      guardrails.pii = action as AgentPiiAction;
    } else if (policy === 'cost-cap') {
      const cap = number(cfg(node), 'maxTokens');
      if (cap && cap > 0) guardrails.maxTokensPerRun = Math.round(cap);
    }
  }

  const schedules: AgentScheduleSpec[] = [];
  for (const node of of('trigger')) {
    if (text(cfg(node), 'type') !== 'schedule') continue;
    const cronExpression = text(cfg(node), 'expression');
    if (!cronExpression) continue;
    schedules.push({
      cronExpression,
      task: text(cfg(node), 'task') ?? 'Perform your scheduled check-in.',
      enabled: cfg(node)?.['enabled'] !== false,
    });
  }

  const outputs: AgentOutputTarget[] = [];
  for (const node of of('output')) {
    const kind = text(cfg(node), 'channel');
    const legacyTarget = text(cfg(node), 'target') ?? '';
    if (kind === 'channel' || kind === 'matrix-channel') {
      const target = text(cfg(node), 'channelId') ?? legacyTarget;
      if (target) outputs.push({ kind: 'channel', target });
    } else if (kind === 'task') {
      outputs.push({ kind: 'task', target: text(cfg(node), 'projectId') ?? '' });
    } else if (kind === 'webhook') {
      const target = text(cfg(node), 'url') ?? legacyTarget;
      if (target) outputs.push({ kind: 'webhook', target });
    }
  }

  const autonomy = text(core, 'autonomy');
  const responseFormat = text(prompt, 'responseFormat');
  const temperature = number(model, 'temperature');
  const maxTokens = number(model, 'maxTokens');

  return {
    name: text(core, 'name'),
    role: text(core, 'role'),
    description: text(core, 'objective'),
    provider: text(model, 'provider'),
    model: text(model, 'model'),
    systemPrompt: text(prompt, 'systemPrompt'),
    tools,
    runtime: {
      version: 1,
      autonomy: autonomy && (AUTONOMY as readonly string[]).includes(autonomy)
        ? (autonomy as AgentAutonomy)
        : 'semi',
      ...(temperature !== undefined ? { temperature: Math.min(Math.max(temperature, 0), 2) } : {}),
      ...(maxTokens !== undefined && maxTokens > 0 ? { maxTokens: Math.round(maxTokens) } : {}),
      ...(responseFormat && (RESPONSE_FORMATS as readonly string[]).includes(responseFormat)
        ? { responseFormat: responseFormat as AgentResponseFormat }
        : {}),
      // No memory node means the agent carries nothing between runs.
      useWorkspaceMemory: !!memory && text(memory, 'strategy') !== 'none',
      knowledge,
      toolPolicies,
      guardrails,
      outputs,
      schedules,
    },
  };
}

/* --------------------------------------------------- legacy Studio graphs ---- */

export interface LegacyGraphConversion {
  /** An Agent Builder graph carrying everything that maps onto an agent. */
  graph: { nodes: unknown[]; edges: unknown[] };
  /** Steps that are workflow logic, not agent configuration (conditions, loops…). */
  unsupportedSteps: Array<{ id: string; type: string; label: string }>;
}

const LEGACY_TOOL_TYPES: Record<string, string> = {
  FIRECRAWL_SEARCH: 'firecrawl_search',
  FIRECRAWL_SCRAPE: 'firecrawl_scrape',
  FIRECRAWL_CRAWL: 'firecrawl_crawl',
  FIRECRAWL_EXTRACT: 'firecrawl_extract',
};

/**
 * Converts a graph the former standalone Agent Studio wrote (START → AGENT →
 * TOOL … → END, React Flow `type` in upper case) into an Agent Builder graph.
 * Identity, model, instructions and tools carry over; control-flow steps
 * (conditions, loops, transforms, approvals-as-steps) have no agent
 * equivalent and are returned as `unsupportedSteps` so the caller can offer
 * to rebuild them as a workflow instead of silently dropping them.
 */
export function convertLegacyAgentGraph(
  graphJson: string,
  agent: { name: string; role?: string | null; model?: string | null; provider?: string | null; systemPrompt?: string | null },
): LegacyGraphConversion | null {
  const nodes = nodesOf(graphJson) as Array<{
    id: string;
    type?: string;
    data?: { label?: string; config?: Record<string, unknown> };
  }> | null;
  if (!nodes || nodes.length === 0 || isAgentBuilderGraph(graphJson)) return null;

  const upper = (n: { type?: string }) => String(n.type ?? '').toUpperCase();
  const agentNode = nodes.find((n) => upper(n) === 'AGENT' || upper(n) === 'SUB_AGENT');
  const agentCfg = agentNode?.data?.config ?? {};

  const tools = new Set<string>();
  const unsupportedSteps: LegacyGraphConversion['unsupportedSteps'] = [];
  let requiresApproval = false;
  for (const n of nodes) {
    const type = upper(n);
    const cfg = n.data?.config ?? {};
    if (['START', 'TRIGGER', 'END', 'OUTPUT', 'AGENT', 'SUB_AGENT'].includes(type)) continue;
    if (LEGACY_TOOL_TYPES[type]) {
      tools.add(LEGACY_TOOL_TYPES[type]!);
    } else if (['TOOL', 'MCP', 'MCP_TOOL'].includes(type)) {
      const name = typeof cfg['toolName'] === 'string' ? cfg['toolName'] : typeof cfg['tool'] === 'string' ? cfg['tool'] : '';
      if (name) tools.add(name);
    } else if (['USER_APPROVAL', 'HUMAN_APPROVAL', 'HUMAN_TASK'].includes(type)) {
      requiresApproval = true;
    } else {
      unsupportedSteps.push({ id: n.id, type, label: n.data?.label ?? type });
    }
  }

  const instructions =
    (typeof agentCfg['instructions'] === 'string' && agentCfg['instructions']) ||
    (typeof agentCfg['prompt'] === 'string' && agentCfg['prompt']) ||
    agent.systemPrompt ||
    'You are a helpful AI agent.';
  const model = (typeof agentCfg['model'] === 'string' && agentCfg['model']) || agent.model || '';
  const temperature = typeof agentCfg['temperature'] === 'number' ? agentCfg['temperature'] : 0.3;

  const node = (id: string, kind: AgentGraphNodeKind, x: number, y: number, config: Record<string, unknown>) => ({
    id,
    type: kind,
    position: { x, y },
    data: { kind, config },
  });
  const outNodes: unknown[] = [
    node('trigger-legacy', 'trigger', 0, 320, { type: 'manual', expression: 'On demand', task: '', enabled: true }),
    node('agent-legacy', 'agent', 280, 320, {
      name: agent.name,
      role: agent.role || 'Assistant',
      objective: instructions.slice(0, 500),
      autonomy: requiresApproval ? 'supervised' : 'semi',
    }),
    node('output-legacy', 'output', 560, 320, { channel: 'chat', target: '', format: 'summary' }),
    node('model-legacy', 'model', 0, 0, {
      provider: agent.provider || 'nvidia',
      model,
      temperature,
      maxTokens: 4096,
      streaming: true,
    }),
    node('prompt-legacy', 'prompt', 280, 0, { label: 'System instructions', systemPrompt: instructions, responseFormat: 'markdown' }),
  ];
  const edge = (source: string, target: string, capability: boolean) => ({
    id: `e-${source}-${target}`,
    source,
    target,
    sourceHandle: capability ? 'cap' : 'out',
    targetHandle: capability ? 'caps' : 'in',
    type: 'smoothstep',
    animated: !capability,
    ...(capability ? { style: { strokeDasharray: '4 4' } } : {}),
  });
  const outEdges: unknown[] = [
    edge('trigger-legacy', 'agent-legacy', false),
    edge('agent-legacy', 'output-legacy', false),
    edge('model-legacy', 'agent-legacy', true),
    edge('prompt-legacy', 'agent-legacy', true),
  ];
  [...tools].forEach((toolId, i) => {
    const id = `tool-legacy-${i}`;
    outNodes.push(node(id, 'tool', 560 + i * 280, 0, { toolId, permission: 'read', requiresApproval: false, rateLimit: 30 }));
    outEdges.push(edge(id, 'agent-legacy', true));
  });

  return { graph: { nodes: outNodes, edges: outEdges }, unsupportedSteps };
}

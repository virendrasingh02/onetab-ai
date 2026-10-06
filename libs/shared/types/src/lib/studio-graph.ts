/**
 * How an AI Agent Studio canvas graph runs.
 *
 * The Studio canvas (`apps/ai-agent-studio`) stores a React Flow graph in
 * `AIAgent.graphJson`: catalog node types in upper case (`TRIGGER_MANUAL`,
 * `AGENT`, `IF_ELSE`, …), and agents whose Prompt / LLM / Embeddings / Tools /
 * Sub-agents are plugged into named "slot" handles. Nothing executed that
 * shape: test runs ignored the graph and ran one plain agent turn.
 *
 * `compileStudioGraph` turns it into the workflow engine's graph:
 *  - slot attachments are folded into the agent they are plugged into, as an
 *    {@link InlineAgentSpec}; sub-agents become that agent's team members;
 *  - every other catalog type maps to an engine step type, explicitly — a type
 *    the engine cannot run becomes an `UNSUPPORTED` step that is skipped
 *    visibly and reported as an issue, never a step that silently "succeeds".
 *
 * Pure and shared: the API compiles on run and on validate, the canvas uses
 * the same issues to warn before anyone runs anything.
 */

/* ---------------------------------------------------------------- agents -- */

/**
 * How a supervisor uses its team:
 * - `router` — the supervisor's model decides whom to delegate to, as tools;
 * - `sequential` — every member works in order, each seeing the previous result;
 * - `parallel` — every member works at once; the supervisor merges the results.
 */
export type AgentDelegationMode = 'router' | 'sequential' | 'parallel';

export const AGENT_DELEGATION_MODES: readonly AgentDelegationMode[] = ['router', 'sequential', 'parallel'];

/** An agent defined on the canvas (not its own `AIAgent` row). */
export interface InlineAgentSpec {
  /** The canvas node id — stable across saves, used to address delegations. */
  key: string;
  name: string;
  role?: string;
  instructions: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Tool names: built-in tools, `provider.action` integration actions. */
  tools: string[];
  knowledge: Array<{ knowledgeBaseId: string; topK: number }>;
  delegation: AgentDelegationMode;
  members: InlineAgentSpec[];
  /** Model ↔ tool rounds this agent may take in one turn. */
  maxSteps?: number;
}

/** Hard ceilings on one run, so an agentic run can never loop forever. */
export interface AgentRunLimits {
  /** Steps the engine may run (loop iterations count each step again). */
  maxSteps: number;
  maxDurationMs: number;
  /** Delegations across the whole agent team in one turn. */
  maxDelegations: number;
  /** Tokens across the run; unset = no run-level cap (credits still apply). */
  maxTokens?: number;
}

export const DEFAULT_AGENT_RUN_LIMITS: AgentRunLimits = {
  maxSteps: 100,
  maxDurationMs: 10 * 60_000,
  maxDelegations: 12,
};

/** Upper bounds a graph's own settings may not exceed. */
export const MAX_AGENT_RUN_LIMITS: AgentRunLimits = {
  maxSteps: 500,
  maxDurationMs: 30 * 60_000,
  maxDelegations: 50,
  maxTokens: 2_000_000,
};

export const MAX_AGENT_TOOL_ROUNDS = 10;
export const MAX_LOOP_ITERATIONS = 50;

/* ----------------------------------------------------------------- graph -- */

export interface CanvasGraphNode {
  id: string;
  type?: string;
  data?: { label?: string; config?: Record<string, unknown>; [key: string]: unknown };
}

export interface CanvasGraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface CompiledStudioNode {
  id: string;
  type: string;
  label?: string;
  config: Record<string, unknown>;
}

export interface StudioGraphIssue {
  nodeId?: string;
  level: 'error' | 'warning';
  message: string;
}

export interface CompiledStudioGraph {
  nodes: CompiledStudioNode[];
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>;
  /** The agents on the run path (team members are nested inside them). */
  agents: InlineAgentSpec[];
  issues: StudioGraphIssue[];
  limits: AgentRunLimits;
}

/** Engine context key holding the latest step's text — the default input of the next step. */
export const LAST_OUTPUT_KEY = '__last';
const LAST = `{{${LAST_OUTPUT_KEY}}}`;

/** Slot handles on an agent node (see the canvas's `agent-slots.ts`). */
const SLOT_HANDLES = new Set(['prompt', 'llm', 'embedding', 'tools', 'agents']);
const AGENT_TYPES = new Set(['AGENT', 'SUB_AGENT', 'AGENT_COORDINATOR']);
/** Canvas-only cards that never run. */
const DECORATIVE_TYPES = new Set(['STICKY_NOTE', 'NOTE', 'GROUP', 'STAGE']);
/** The loop handle whose branch runs once per item. */
export const LOOP_EACH_HANDLE = 'each';

const TOOL_NODE_NAMES: Record<string, string> = {
  FIRECRAWL_SEARCH: 'firecrawl_search',
  FIRECRAWL_SCRAPE: 'firecrawl_scrape',
  FIRECRAWL_CRAWL: 'firecrawl_crawl',
  FIRECRAWL_EXTRACT: 'firecrawl_extract',
  KB_SEARCH: 'search_docs',
  VECTOR_SEARCH: 'search_docs',
  KNOWLEDGE_RETRIEVAL: 'search_docs',
};

/** Older ids the canvas offered for an agent's own tool list. */
const TOOL_ALIASES: Record<string, string> = { kb_search: 'search_docs' };

const CONDITION_OPERATORS: Record<string, string> = {
  equals: 'eq',
  not_equals: 'ne',
  contains: 'contains',
  greater_than: 'gt',
  less_than: 'lt',
  is_empty: 'notExists',
  is_not_empty: 'exists',
};

/** Why a type cannot run yet — shown on the skipped step and as a warning. */
const UNSUPPORTED_REASONS: Record<string, string> = {
  AI_GUARDRAIL: 'Guardrail steps don’t run on their own yet. Set guardrails in the agent’s settings.',
  MODEL_ROUTER: 'Model routing isn’t available yet. Plug a model into the agent’s LLM slot.',
  LLM_ROUTER: 'Model routing isn’t available yet. Plug a model into the agent’s LLM slot.',
  DOC_RETRIEVAL: 'Document retrieval steps don’t run yet. Use Knowledge Search.',
  RERANKER: 'Reranking isn’t available yet.',
  CONTEXT_BUILDER: 'Context building isn’t available yet.',
  TEXT_SPLITTER: 'Text splitting isn’t available yet.',
  EMBEDDING_MODEL: 'Embedding steps don’t run on their own. Plug knowledge into an agent’s Embeddings slot.',
  SWITCH_CASE: 'Switch steps can’t be configured yet. Use If / Else.',
  RETRY_NODE: 'Retry steps don’t run yet. Steps already retry transient failures on their own.',
  ERROR_HANDLER: 'Error-handler steps don’t run yet.',
  DATA_MAPPER: 'Data mapping isn’t available yet. Use a Template step.',
  DATA_FILTER: 'Data filtering isn’t available yet.',
  JSON_PARSE: 'JSON parsing isn’t available yet.',
  JSON_PARSER: 'JSON parsing isn’t available yet.',
  DATE_FORMATTER: 'Date formatting isn’t available yet.',
  SLACK_SEND: 'Slack steps aren’t wired yet. Give an agent the Slack tools from a connected Slack app.',
  EMAIL_SEND: 'Email steps aren’t wired yet.',
  ESCALATE_HUMAN: 'Escalation isn’t available yet. Use a User Approval step.',
  GITHUB_ACTION: 'GitHub steps aren’t wired yet. Give an agent the GitHub tools from a connected GitHub app.',
};

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const typeOf = (node: CanvasGraphNode | undefined) => String(node?.type ?? '').toUpperCase();
const configOf = (node: CanvasGraphNode | undefined): Record<string, unknown> =>
  (node?.data?.config && typeof node.data.config === 'object' ? node.data.config : {}) as Record<string, unknown>;
const labelOf = (node: CanvasGraphNode | undefined): string | undefined => asText(node?.data?.label);

/**
 * Whether a stored graph is a Studio canvas graph (catalog types in
 * `node.type`), as opposed to an Agent Builder graph (`data.kind` on every
 * node) — see `isAgentBuilderGraph`.
 */
export function isStudioGraph(graphJson: string | null | undefined): boolean {
  if (!graphJson) return false;
  try {
    const parsed = JSON.parse(graphJson) as { nodes?: unknown };
    if (!Array.isArray(parsed?.nodes) || parsed.nodes.length === 0) return false;
    const nodes = parsed.nodes as CanvasGraphNode[];
    return nodes.some((n) => typeof n?.type === 'string' && /^[A-Z][A-Z0-9_]*$/.test(n.type)) &&
      !nodes.every((n) => typeof (n?.data as { kind?: unknown } | undefined)?.kind === 'string');
  } catch {
    return false;
  }
}

/** Graph-level limits a canvas stored under `settings.limits`, clamped to the maxima. */
export function readRunLimits(settings: unknown): AgentRunLimits {
  const raw = (settings && typeof settings === 'object' ? (settings as Record<string, unknown>)['limits'] : undefined) as
    | Record<string, unknown>
    | undefined;
  const pick = (key: keyof AgentRunLimits, min: number) => {
    const n = asNumber(raw?.[key]);
    const max = MAX_AGENT_RUN_LIMITS[key] as number;
    return n !== undefined && n > 0 ? clamp(Math.round(n), min, max) : undefined;
  };
  const maxTokens = pick('maxTokens', 1_000);
  return {
    maxSteps: pick('maxSteps', 1) ?? DEFAULT_AGENT_RUN_LIMITS.maxSteps,
    maxDurationMs: pick('maxDurationMs', 5_000) ?? DEFAULT_AGENT_RUN_LIMITS.maxDurationMs,
    maxDelegations: pick('maxDelegations', 1) ?? DEFAULT_AGENT_RUN_LIMITS.maxDelegations,
    ...(maxTokens ? { maxTokens } : {}),
  };
}

/**
 * Compiles a Studio canvas graph for the workflow engine. Never throws: a
 * graph that cannot run comes back with `error` issues.
 */
export function compileStudioGraph(graph: {
  nodes?: unknown;
  edges?: unknown;
  settings?: unknown;
}): CompiledStudioGraph {
  const nodes = (Array.isArray(graph.nodes) ? graph.nodes : []).filter(
    (n): n is CanvasGraphNode => !!n && typeof n === 'object' && typeof (n as CanvasGraphNode).id === 'string',
  );
  const edges = (Array.isArray(graph.edges) ? graph.edges : []).filter(
    (e): e is CanvasGraphEdge =>
      !!e && typeof e === 'object' && typeof (e as CanvasGraphEdge).source === 'string' && typeof (e as CanvasGraphEdge).target === 'string',
  );
  const issues: StudioGraphIssue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const limits = readRunLimits(graph.settings);

  if (nodes.filter((n) => !DECORATIVE_TYPES.has(typeOf(n))).length === 0) {
    return { nodes: [], edges: [], agents: [], issues: [{ level: 'error', message: 'The canvas is empty.' }], limits };
  }

  const isSlotEdge = (e: CanvasGraphEdge) =>
    !!e.sourceHandle && SLOT_HANDLES.has(e.sourceHandle) && AGENT_TYPES.has(typeOf(byId.get(e.source)));
  const slotEdges = edges.filter(isSlotEdge);
  /** Nodes plugged into an agent: configuration, not steps of the run. */
  const attached = new Set(slotEdges.map((e) => e.target));

  // Teams are trees. A reporting cycle leaves every agent in it as someone's
  // sub-agent, so none is on the run path and the walk below never sees it.
  const teamEdges = slotEdges.filter((e) => e.sourceHandle === 'agents');
  for (const start of new Set(teamEdges.map((e) => e.source))) {
    const seen = new Set<string>();
    const stack = teamEdges.filter((e) => e.source === start).map((e) => e.target);
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === start) {
        issues.push({ nodeId: start, level: 'error', message: `${labelOf(byId.get(start)) ?? 'An agent'} reports to its own team: agents can’t report to each other in a loop.` });
        break;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...teamEdges.filter((e) => e.source === id).map((e) => e.target));
    }
  }

  const attachments = (agentId: string, slot: string) =>
    slotEdges.filter((e) => e.source === agentId && e.sourceHandle === slot).map((e) => byId.get(e.target)).filter(
      (n): n is CanvasGraphNode => !!n,
    );

  /* --- agents ----------------------------------------------------------- */

  const buildAgent = (node: CanvasGraphNode, inherited: { model?: string }, path: Set<string>): InlineAgentSpec => {
    const cfg = configOf(node);
    const type = typeOf(node);
    const prompt = attachments(node.id, 'prompt')[0];
    const llm = attachments(node.id, 'llm')[0];
    const llmCfg = configOf(llm);

    const instructions =
      asText(configOf(prompt)['prompt']) ??
      asText(configOf(prompt)['template']) ??
      asText(configOf(prompt)['systemPrompt']) ??
      asText(cfg['instructions']) ??
      asText(cfg['systemPrompt']) ??
      asText(cfg['prompt']) ??
      '';
    const name = labelOf(node) ?? asText(cfg['name']) ?? asText(cfg['role']) ?? 'Agent';
    if (!instructions) {
      issues.push({
        nodeId: node.id,
        level: 'warning',
        message: `${name} has no instructions, so it will only follow its name and role.`,
      });
    }

    const model = asText(llmCfg['model']) ?? asText(cfg['model']) ?? inherited.model;
    const temperature = asNumber(llmCfg['temperature']) ?? asNumber(cfg['temperature']);
    const maxTokens = asNumber(llmCfg['maxTokens']) ?? asNumber(cfg['maxTokens']);

    const tools: string[] = [];
    const addTool = (tool: string | undefined) => {
      const name = tool ? (TOOL_ALIASES[tool] ?? tool) : undefined;
      if (name && !tools.includes(name)) tools.push(name);
    };
    for (const tool of Array.isArray(cfg['tools']) ? (cfg['tools'] as unknown[]) : []) addTool(asText(tool));
    for (const toolNode of attachments(node.id, 'tools')) {
      const toolType = typeOf(toolNode);
      const toolCfg = configOf(toolNode);
      const mapped =
        TOOL_NODE_NAMES[toolType] ??
        (['TOOL', 'MCP', 'MCP_TOOL'].includes(toolType) ? (asText(toolCfg['toolName']) ?? asText(toolCfg['tool'])) : undefined);
      if (mapped) addTool(mapped);
      else {
        issues.push({
          nodeId: toolNode.id,
          level: 'warning',
          message: `${labelOf(toolNode) ?? toolType} can’t be used as an agent tool yet, so ${name} won’t have it.`,
        });
      }
    }

    const knowledge: InlineAgentSpec['knowledge'] = [];
    for (const kbNode of attachments(node.id, 'embedding')) {
      const kbCfg = configOf(kbNode);
      const knowledgeBaseId = asText(kbCfg['knowledgeBaseId']);
      if (!knowledgeBaseId) {
        issues.push({ nodeId: kbNode.id, level: 'warning', message: `Pick a knowledge base for ${labelOf(kbNode) ?? 'this knowledge step'}.` });
        continue;
      }
      knowledge.push({ knowledgeBaseId, topK: clamp(Math.round(asNumber(kbCfg['topK']) ?? 5), 1, 20) });
    }

    const members: InlineAgentSpec[] = [];
    const nextPath = new Set(path).add(node.id);
    for (const member of attachments(node.id, 'agents')) {
      if (nextPath.has(member.id)) {
        issues.push({ nodeId: member.id, level: 'error', message: 'Agents can’t report to each other in a loop.' });
        continue;
      }
      members.push(buildAgent(member, { model }, nextPath));
    }
    if (type === 'AGENT_COORDINATOR' && members.length === 0) {
      issues.push({ nodeId: node.id, level: 'error', message: `${name} is a supervisor with no sub-agents to delegate to.` });
    }

    const delegation = AGENT_DELEGATION_MODES.includes(cfg['delegation'] as AgentDelegationMode)
      ? (cfg['delegation'] as AgentDelegationMode)
      : 'router';
    const steps = asNumber(cfg['maxSteps']) ?? asNumber(cfg['maxIterations']);

    return {
      key: node.id,
      name,
      ...(asText(cfg['role']) ? { role: asText(cfg['role']) } : {}),
      instructions,
      ...(model ? { model } : {}),
      ...(temperature !== undefined ? { temperature: clamp(temperature, 0, 2) } : {}),
      ...(maxTokens !== undefined && maxTokens > 0 ? { maxTokens: Math.round(maxTokens) } : {}),
      tools,
      knowledge,
      delegation,
      members,
      ...(steps !== undefined && steps > 0 ? { maxSteps: clamp(Math.round(steps), 1, MAX_AGENT_TOOL_ROUNDS) } : {}),
    };
  };

  /* --- steps ------------------------------------------------------------ */

  const unsupported = (node: CanvasGraphNode, reason: string): CompiledStudioNode => {
    issues.push({ nodeId: node.id, level: 'warning', message: `${labelOf(node) ?? typeOf(node)}: ${reason}` });
    return { id: node.id, type: 'UNSUPPORTED', label: labelOf(node), config: { reason, originalType: typeOf(node) } };
  };

  const llmStep = (node: CanvasGraphNode, prompt: string, extra: Record<string, unknown> = {}): CompiledStudioNode => {
    const cfg = configOf(node);
    return {
      id: node.id,
      type: 'LLM',
      label: labelOf(node),
      config: {
        prompt,
        ...(asText(cfg['model']) ? { model: asText(cfg['model']) } : {}),
        ...(asNumber(cfg['temperature']) !== undefined ? { temperature: asNumber(cfg['temperature']) } : {}),
        ...extra,
      },
    };
  };

  const compileStep = (node: CanvasGraphNode): CompiledStudioNode => {
    const type = typeOf(node);
    const cfg = configOf(node);
    const label = labelOf(node);
    const step = (engineType: string, config: Record<string, unknown>): CompiledStudioNode => ({
      id: node.id,
      type: engineType,
      label,
      config,
    });

    if (type === 'START' || type === 'TRIGGER' || type.startsWith('TRIGGER_')) {
      // A schedule card carries its cron (read in its zone) so an agent that
      // is switched on runs by itself (`WorkflowScheduleListener`).
      const cron = type === 'TRIGGER_SCHEDULE' ? asText(cfg['cron']) : undefined;
      if (type === 'TRIGGER_SCHEDULE' && (!cron || cron.split(/\s+/).length !== 5)) {
        issues.push({ nodeId: node.id, level: 'warning', message: `${label ?? 'Schedule'} has no valid schedule, so it only runs when started by hand.` });
      }
      return step('TRIGGER', {
        trigger: type,
        ...(cron && cron.split(/\s+/).length === 5 ? { cron, ...(asText(cfg['timezone']) ? { timezone: asText(cfg['timezone']) } : {}) } : {}),
        ...(type === 'TRIGGER_APP_EVENT' && asText(cfg['event']) ? { event: asText(cfg['event']) } : {}),
      });
    }

    if (AGENT_TYPES.has(type)) {
      const spec = buildAgent(node, {}, new Set());
      return step('AGENT', {
        inlineAgent: spec,
        goal: asText(cfg['goal']) ?? asText(cfg['task']) ?? LAST,
        ...(asNumber(cfg['retries']) !== undefined ? { retries: asNumber(cfg['retries']) } : {}),
        ...(asNumber(cfg['timeout']) ? { timeoutMs: (asNumber(cfg['timeout']) as number) * 1000 } : {}),
      });
    }

    switch (type) {
      case 'AI_CHAT_MODEL':
      case 'LLM':
        return llmStep(node, asText(cfg['prompt']) ?? LAST, {
          ...(asNumber(cfg['maxTokens']) ? { maxTokens: asNumber(cfg['maxTokens']) } : {}),
        });
      case 'REASONING_CHAIN':
        return llmStep(node, `Think the problem through step by step, then give a clear answer.\n\n${asText(cfg['prompt']) ?? LAST}`);
      case 'AI_SUMMARIZER': {
        const length = asText(cfg['length']) ?? 'concise';
        const format = asText(cfg['format']) === 'bullet_points' ? ' as bullet points' : '';
        return llmStep(node, `Write a ${length} summary${format} of the following.\n\n${asText(cfg['input']) ?? LAST}`);
      }
      case 'AI_TRANSLATOR':
        return llmStep(
          node,
          `Translate the following into ${asText(cfg['targetLanguage']) ?? 'English'}${cfg['preserveFormatting'] === false ? '' : ', keeping its formatting'}. Reply with the translation only.\n\n${asText(cfg['input']) ?? LAST}`,
        );
      case 'AI_SENTIMENT':
        return llmStep(
          node,
          `Rate the sentiment of the following as Positive, Neutral or Negative${cfg['detectUrgency'] === false ? '' : ', and its urgency as Low, Medium or High'}. Reply in one line.\n\n${asText(cfg['input']) ?? LAST}`,
        );
      case 'INTENT_CLASSIFIER':
        return step('CLASSIFIER', { categories: cfg['categories'] ?? 'general', input: asText(cfg['input']) ?? LAST });
      case 'STRUCTURED_OUTPUT': {
        let fields = asText(cfg['fields']);
        if (!fields) {
          try {
            const schema = JSON.parse(String(cfg['schemaDefinition'] ?? '')) as Record<string, unknown>;
            fields = Object.keys(schema).join(',');
          } catch {
            /* free-form extraction */
          }
        }
        return step('STRUCTURED_OUTPUT', { input: asText(cfg['input']) ?? LAST, ...(fields ? { fields } : {}) });
      }
      case 'AI_ENTITY_EXTRACTOR':
        return step('EXTRACT_DATA', {
          input: asText(cfg['input']) ?? LAST,
          fields: Array.isArray(cfg['entityTypes']) ? (cfg['entityTypes'] as unknown[]).map(String).join(',') : '',
        });
      case 'PROMPT_TEMPLATE':
      case 'TRANSFORM':
      case 'TEMPLATE':
        return step('TRANSFORM', { template: asText(cfg['prompt']) ?? asText(cfg['template']) ?? LAST });

      case 'KB_SEARCH':
      case 'VECTOR_SEARCH':
      case 'KNOWLEDGE_RETRIEVAL':
        return step('KNOWLEDGE_RETRIEVAL', {
          knowledgeBaseId: asText(cfg['knowledgeBaseId']) ?? '',
          topK: asNumber(cfg['topK']) ?? 4,
          query: asText(cfg['query']) ?? LAST,
        });

      case 'IF_ELSE':
      case 'CONDITION': {
        const field = asText(cfg['variable'])?.replace(/^\{\{\s*|\s*\}\}$/g, '') ?? asText(cfg['field']);
        if (!field && !asText(cfg['expression'])) {
          issues.push({ nodeId: node.id, level: 'error', message: `${label ?? 'If / Else'} needs a variable to test.` });
        }
        return step('CONDITION', {
          ...(field ? { field } : {}),
          ...(asText(cfg['expression']) ? { expression: asText(cfg['expression']) } : {}),
          operator: CONDITION_OPERATORS[String(cfg['operator'] ?? 'equals')] ?? String(cfg['operator'] ?? 'eq'),
          value: cfg['value'] ?? '',
        });
      }
      case 'PARALLEL_SPLIT':
      case 'PARALLEL':
        return step('PARALLEL', {});
      case 'MERGE_PATHS':
      case 'MERGE':
        return step('MERGE', {});
      case 'LOOP':
      case 'WHILE_LOOP':
        return step('LOOP', {
          itemsKey: (asText(cfg['itemsKey']) ?? asText(cfg['items']) ?? 'items').replace(/^\{\{\s*|\s*\}\}$/g, ''),
          maxIterations: clamp(Math.round(asNumber(cfg['maxIterations']) ?? MAX_LOOP_ITERATIONS), 1, MAX_LOOP_ITERATIONS),
        });
      case 'WAIT_DELAY':
      case 'DELAY':
        return step('DELAY', { seconds: asNumber(cfg['delaySeconds']) ?? asNumber(cfg['seconds']) ?? 0 });
      case 'SET_VARIABLE':
        return step('VARIABLE', {
          name: asText(cfg['variableName']) ?? asText(cfg['name']) ?? 'var',
          value: asText(cfg['value']) ?? LAST,
        });
      case 'GET_VARIABLE':
        return step('TRANSFORM', { template: `{{${asText(cfg['variableName']) ?? 'var'}}}` });
      case 'CODE':
      case 'CODE_JAVASCRIPT':
      case 'CODE_PYTHON':
        issues.push({ nodeId: node.id, level: 'warning', message: `${label ?? 'Code'}: code steps are skipped — there is no sandbox to run them in.` });
        return step('CODE', {});
      case 'HTTP_REQUEST':
        return step('HTTP_REQUEST', {
          method: asText(cfg['method']) ?? 'GET',
          url: asText(cfg['url']) ?? '',
          headers: cfg['headers'] && typeof cfg['headers'] === 'object' ? cfg['headers'] : {},
          ...(cfg['body'] !== undefined ? { body: cfg['body'] } : {}),
        });
      case 'FIRECRAWL_SEARCH':
        return step(type, { query: asText(cfg['query']) ?? LAST, limit: asNumber(cfg['limit']) ?? 3 });
      case 'FIRECRAWL_SCRAPE':
      case 'FIRECRAWL_CRAWL':
      case 'FIRECRAWL_EXTRACT':
        return step(type, { ...cfg });
      case 'TOOL':
      case 'MCP':
      case 'MCP_TOOL':
        if (!asText(cfg['toolName']) && !asText(cfg['tool']) && !asText(cfg['mcpTool'])) {
          const app = asText(cfg['needsConnection']);
          issues.push({
            nodeId: node.id,
            level: 'error',
            message: app
              ? `${label ?? 'Tool'} needs ${app.charAt(0) + app.slice(1).toLowerCase().replace(/_/g, ' ')}: connect it, then pick the action — this step has no tool picked yet.`
              : `${label ?? 'Tool'} has no tool picked.`,
          });
        }
        return step(type, { ...cfg });
      case 'DB_QUERY':
      case 'DB_WRITE':
        issues.push({ nodeId: node.id, level: 'warning', message: `${label ?? 'Database'}: database steps are skipped — none are connected yet.` });
        return step('DATABASE', {});
      case 'USER_APPROVAL':
      case 'HUMAN_APPROVAL':
      case 'HUMAN_TASK':
        return step('HUMAN_APPROVAL', {
          action: asText(cfg['action']) ?? label ?? 'Approve this step',
          required: cfg['required'] !== false,
          ...(asText(cfg['description']) ? { description: asText(cfg['description']) } : {}),
          reviewPath: asText(cfg['reviewPath']) ?? LAST_OUTPUT_KEY,
          reviewLabel: asText(cfg['reviewLabel']) ?? 'What the agent produced',
        });
      case 'HUMAN_REVIEW':
        return step('HUMAN_APPROVAL', {
          action: asText(cfg['action']) ?? label ?? 'Review the draft',
          required: true,
          reviewPath: LAST_OUTPUT_KEY,
          reviewLabel: 'Draft',
        });
      case 'HUMAN_INPUT':
        return step('HUMAN_INPUT', { action: asText(cfg['question']) ?? asText(cfg['action']) ?? 'Input needed', required: true });
      case 'END':
      case 'OUTPUT':
      case 'STOP_WORKFLOW':
      case 'CHAT_RESPONSE':
      case 'RESPONSE_STREAM':
      case 'WEBHOOK_RESPONSE':
      case 'RETURN_TO_PARENT':
        return step('OUTPUT', { template: asText(cfg['template']) ?? asText(cfg['message']) ?? LAST });
      default:
        return unsupported(node, UNSUPPORTED_REASONS[type] ?? `${type} steps can’t run yet.`);
    }
  };

  const runNodes = nodes.filter((n) => !attached.has(n.id) && !DECORATIVE_TYPES.has(typeOf(n)));
  // A retry count set on any card applies, whatever the card compiles to.
  const compiled = runNodes.map((node) => {
    const out = compileStep(node);
    const retries = asNumber(configOf(node)['retries']);
    if (retries !== undefined && out.config['retries'] === undefined && out.type !== 'TRIGGER' && out.type !== 'UNSUPPORTED') {
      out.config = { ...out.config, retries: clamp(Math.round(retries), 0, 5) };
    }
    return out;
  });
  const runIds = new Set(compiled.map((n) => n.id));
  const compiledById = new Map(compiled.map((n) => [n.id, n]));

  const runEdges: CompiledStudioGraph['edges'] = [];
  for (const [index, e] of edges.entries()) {
    if (isSlotEdge(e) || !runIds.has(e.source) || !runIds.has(e.target)) continue;
    const sourceType = compiledById.get(e.source)?.type;
    // Only branching steps (and a loop's per-item branch, and error fallbacks)
    // keep their handle: the engine filters on it. A parallel split's lanes
    // all run, whatever handle the card drew them from.
    const keepHandle =
      !!e.sourceHandle &&
      (e.sourceHandle === 'error' ||
        (sourceType === 'CONDITION' && (e.sourceHandle === 'true' || e.sourceHandle === 'false')) ||
        (sourceType === 'LOOP' && e.sourceHandle === LOOP_EACH_HANDLE));
    runEdges.push({ id: e.id ?? `e${index}`, source: e.source, target: e.target, ...(keepHandle ? { sourceHandle: e.sourceHandle as string } : {}) });
  }

  for (const n of nodes) {
    // A node plugged into an agent is configuration, so its flow wires don't run.
    if (attached.has(n.id) && edges.some((e) => !isSlotEdge(e) && (e.source === n.id || e.target === n.id))) {
      issues.push({ nodeId: n.id, level: 'warning', message: `${labelOf(n) ?? typeOf(n)} is plugged into an agent, so its other connections are ignored.` });
    }
  }

  const agents = compiled
    .filter((n) => n.type === 'AGENT')
    .map((n) => n.config['inlineAgent'] as InlineAgentSpec);

  if (!compiled.some((n) => n.type !== 'TRIGGER' && n.type !== 'UNSUPPORTED')) {
    issues.push({ level: 'error', message: 'Add at least one step that does something after the trigger.' });
  }

  return { nodes: compiled, edges: runEdges, agents, issues, limits };
}

/** Every agent in a team, the supervisor first (depth-first). */
export function flattenAgentTeam(spec: InlineAgentSpec): InlineAgentSpec[] {
  return [spec, ...spec.members.flatMap(flattenAgentTeam)];
}

/**
 * `AutomationWorkflow.triggerType` of the engine workflow a canvas agent is
 * compiled into. Those workflows belong to their agent: workflow lists and
 * search leave them out, and no trigger or schedule matches them.
 */
export const CANVAS_AGENT_TRIGGER = 'CANVAS_AGENT';

/* ------------------------------------------------------------ API shapes -- */

export type AgentTaskStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING'
  | 'APPROVAL_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSED';

/** One piece of work an agent was given in a run (`AgentTask`). */
export interface AgentTaskRecord {
  id: string;
  executionId: string;
  parentTaskId: string | null;
  agentKey: string;
  agentName: string;
  delegatedBy: string | null;
  title: string;
  description: string | null;
  status: AgentTaskStatus;
  input: Record<string, unknown>;
  output: { result?: string; tools?: string[]; notices?: string[] } | null;
  dependencies: string[];
  retryCount: number;
  error: string | null;
  approvalRequired: boolean;
  tokensUsed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** What one agent said to another in a run (`AgentMessage`). */
export interface AgentMessageRecord {
  id: string;
  executionId: string;
  taskId: string | null;
  fromAgent: string;
  fromName: string;
  toAgent: string;
  toName: string;
  kind: 'task' | 'result' | 'error' | 'status';
  content: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface CanvasRunStep {
  id: string;
  stepId: string;
  nodeType: string;
  status: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  latencyMs: number;
  tokensUsed: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** A canvas agent run with everything that happened in it. */
export interface CanvasAgentRunDetail {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  latencyMs: number;
  tokensUsed: number;
  totalCost: number;
  errorsJson: { message?: string } | null;
  stateJson: Record<string, unknown>;
  steps: CanvasRunStep[];
  agentTasks: AgentTaskRecord[];
  agentMessages: AgentMessageRecord[];
  approvals: Array<{ id: string; stepId: string | null; actionType: string; state: string; createdAt: string; respondedAt: string | null; comment: string | null }>;
}

export interface CanvasAgentRunSummary {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  latencyMs: number;
  tokensUsed: number;
  totalCost: number;
  stateJson: Record<string, unknown>;
}

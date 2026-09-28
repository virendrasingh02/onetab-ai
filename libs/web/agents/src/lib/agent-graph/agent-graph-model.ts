/**
 * The agent builder's data model.
 *
 * An agent is a graph, not a form. The old builder had four inputs hard-coded
 * into JSX, which meant every new capability (memory, guardrails, retrieval)
 * would have been another hand-written field. Here a node *kind* declares its
 * own fields, defaults, handles and summary line, and the canvas, the palette,
 * the inspector and the validator are all driven off that one declaration —
 * adding a capability is a new entry in `NODE_SPECS`, nothing else.
 *
 * Shape of a valid graph, left to right:
 *
 *        model   prompt   memory   knowledge   tool        ← capabilities
 *            \      |       |         |        /             (bottom → `caps`)
 *   trigger ──► guardrail ──► agent ──► output              ← the spine
 *                                                             (right → `in`)
 */

import {
  BookOpen,
  Bot,
  Brain,
  Cpu,
  MessageSquareCode,
  Send,
  ShieldCheck,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------- kinds ---- */

export const NODE_KINDS = [
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

export type AgentNodeKind = (typeof NODE_KINDS)[number];

export const NODE_CATEGORIES = [
  'core',
  'entry',
  'reasoning',
  'capability',
  'safety',
  'delivery',
] as const;

export type NodeCategory = (typeof NODE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<NodeCategory, string> = {
  core: 'Core',
  entry: 'Triggers',
  reasoning: 'Reasoning',
  capability: 'Capabilities',
  safety: 'Safety',
  delivery: 'Delivery',
};

/* ------------------------------------------------------------ config ---- */

/** Every field value is JSON-safe so a graph round-trips through storage. */
export type ConfigValue = string | number | boolean | string[];
export type NodeConfig = Record<string, ConfigValue>;

/**
 * Where a `source` field's options come from. They are the workspace's real
 * lists (tools the runtime can call, knowledge bases, channels…), loaded by
 * `AgentBuilderOptionsProvider` — never a hard-coded list that can drift from
 * what actually exists.
 */
export type OptionSource =
  | 'tools'
  | 'knowledgeBases'
  | 'channels'
  | 'projects'
  | 'providers'
  | 'models'
  | 'agents'
  | 'coworkers'
  /** MCP server tools as `<connectionId>::<toolName>`, for workflow MCP steps. */
  | 'mcpServerTools';

/** Show a field only while another field of the same node has one of `is`. */
export interface FieldCondition {
  key: string;
  is: readonly string[];
}

type FieldBase = {
  key: string;
  label: string;
  hint?: string;
  showWhen?: FieldCondition;
};

export type FieldSpec = FieldBase &
  (
    | { type: 'text'; placeholder?: string; required?: boolean; mono?: boolean }
    | { type: 'textarea'; rows?: number; placeholder?: string; required?: boolean }
    | { type: 'select'; options: ReadonlyArray<{ value: string; label: string }>; required?: boolean }
    | {
        type: 'source';
        source: OptionSource;
        required?: boolean;
        placeholder?: string;
        /** Narrow options to those whose `group` equals this sibling field's value. */
        filterBy?: string;
      }
    | { type: 'number'; min?: number; max?: number; step?: number }
    | { type: 'toggle' }
  );

/** Whether `field` applies to a node whose config is `config`. */
export function isFieldVisible(field: FieldSpec, config: NodeConfig): boolean {
  if (!field.showWhen) return true;
  return field.showWhen.is.includes(String(config[field.showWhen.key] ?? ''));
}

/** The config key a `source` field writes its option's display label to. */
export function labelKey(fieldKey: string): string {
  return `${fieldKey}Label`;
}

/* ------------------------------------------------------------ accents ---- */

/**
 * Tailwind can only see class names it can read as literals, so the accent per
 * kind is a lookup of complete strings rather than an interpolated
 * `bg-accent-${name}-soft`.
 *
 * `hex` is for the minimap, which paints to a canvas and cannot take a class.
 */
export interface NodeAccent {
  chip: string;
  border: string;
  text: string;
  handle: string;
  hex: string;
}

export const NODE_ACCENTS = {
  violet: {
    chip: 'bg-accent-violet-soft text-accent-violet',
    border: 'border-accent-violet/40',
    text: 'text-accent-violet',
    handle: 'bg-accent-violet!',
    hex: '#8b5cf6',
  },
  amber: {
    chip: 'bg-accent-amber-soft text-accent-amber',
    border: 'border-accent-amber/40',
    text: 'text-accent-amber',
    handle: 'bg-accent-amber!',
    hex: '#f59e0b',
  },
  rose: {
    chip: 'bg-accent-rose-soft text-accent-rose',
    border: 'border-accent-rose/40',
    text: 'text-accent-rose',
    handle: 'bg-accent-rose!',
    hex: '#f43f5e',
  },
  indigo: {
    chip: 'bg-accent-indigo-soft text-accent-indigo',
    border: 'border-accent-indigo/40',
    text: 'text-accent-indigo',
    handle: 'bg-accent-indigo!',
    hex: '#6366f1',
  },
  blue: {
    chip: 'bg-accent-blue-soft text-accent-blue',
    border: 'border-accent-blue/40',
    text: 'text-accent-blue',
    handle: 'bg-accent-blue!',
    hex: '#3b82f6',
  },
  cyan: {
    chip: 'bg-accent-cyan-soft text-accent-cyan',
    border: 'border-accent-cyan/40',
    text: 'text-accent-cyan',
    handle: 'bg-accent-cyan!',
    hex: '#06b6d4',
  },
  teal: {
    chip: 'bg-accent-teal-soft text-accent-teal',
    border: 'border-accent-teal/40',
    text: 'text-accent-teal',
    handle: 'bg-accent-teal!',
    hex: '#14b8a6',
  },
  green: {
    chip: 'bg-accent-green-soft text-accent-green',
    border: 'border-accent-green/40',
    text: 'text-accent-green',
    handle: 'bg-accent-green!',
    hex: '#10b981',
  },
  orange: {
    chip: 'bg-accent-orange-soft text-accent-orange',
    border: 'border-accent-orange/40',
    text: 'text-accent-orange',
    handle: 'bg-accent-orange!',
    hex: '#f97316',
  },
} as const satisfies Record<string, NodeAccent>;

export type NodeAccentName = keyof typeof NODE_ACCENTS;

/* -------------------------------------------------------- kind specs ---- */

/**
 * Which sockets a kind exposes.
 *
 * `caps` is a second inbound socket on the agent core, kept separate from `in`
 * so the runtime spine (trigger → guardrail → agent → output) stays visually
 * distinct from the capabilities wired into it.
 */
export interface NodeHandles {
  /** Inbound spine socket, on the left. */
  in?: boolean;
  /** Outbound spine socket, on the right. */
  out?: boolean;
  /** Inbound capability socket, on top. Agent core only. */
  caps?: boolean;
  /** Outbound capability socket, on the bottom. */
  cap?: boolean;
}

export interface NodeKindSpec {
  kind: AgentNodeKind;
  label: string;
  category: NodeCategory;
  description: string;
  accent: NodeAccentName;
  icon: LucideIcon;
  /** Only one may exist in a graph — the palette entry disables once placed. */
  singleton?: boolean;
  handles: NodeHandles;
  defaults: NodeConfig;
  fields: ReadonlyArray<FieldSpec>;
  /** The monospace line under the title on the canvas card. */
  summary: (config: NodeConfig) => string;
}

function str(config: NodeConfig, key: string, fallback = ''): string {
  const value = config[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function num(config: NodeConfig, key: string, fallback = 0): number {
  const value = config[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Every field below maps onto something the runtime enforces
 * (`deriveAgentFromGraph` in `@org/types` is the one mapping). Settings the
 * runtime cannot honour — per-tool rate limits, memory windows, content
 * classifiers — are deliberately absent rather than offered and ignored.
 */
export const NODE_SPECS: Record<AgentNodeKind, NodeKindSpec> = {
  agent: {
    kind: 'agent',
    label: 'Agent core',
    category: 'core',
    description: 'Identity and autonomy level. Everything else wires into it.',
    accent: 'violet',
    icon: Bot,
    singleton: true,
    handles: { in: true, out: true, caps: true },
    defaults: {
      name: 'New agent',
      role: 'Assistant',
      objective: '',
      autonomy: 'semi',
    },
    fields: [
      { type: 'text', key: 'name', label: 'Agent name', required: true },
      { type: 'text', key: 'role', label: 'Role', required: true, placeholder: 'e.g. Support triage' },
      {
        type: 'textarea',
        key: 'objective',
        label: 'What it is for',
        rows: 3,
        hint: 'Shown to teammates as the agent’s description.',
      },
      {
        type: 'select',
        key: 'autonomy',
        label: 'Autonomy',
        options: [
          { value: 'supervised', label: 'Supervised — every tool call needs approval' },
          { value: 'semi', label: 'Semi-autonomous — reads run, writes need approval' },
          { value: 'autonomous', label: 'Autonomous — only flagged tools need approval' },
        ],
        hint: 'Approvals wait in the AI Workspace until the agent’s creator or an admin decides.',
      },
    ],
    summary: (config) => str(config, 'role', 'No role set'),
  },

  trigger: {
    kind: 'trigger',
    label: 'Trigger',
    category: 'entry',
    description: 'When the agent runs: on request, on a schedule, or when mentioned.',
    accent: 'amber',
    icon: Zap,
    handles: { out: true },
    defaults: {
      type: 'manual',
      expression: '0 9 * * 1-5',
      task: '',
      enabled: true,
    },
    fields: [
      {
        type: 'select',
        key: 'type',
        label: 'Runs',
        options: [
          { value: 'manual', label: 'When someone messages it' },
          { value: 'mention', label: 'When @mentioned in a channel it was added to' },
          { value: 'schedule', label: 'On a schedule' },
        ],
      },
      {
        type: 'text',
        key: 'expression',
        label: 'Schedule (cron)',
        mono: true,
        required: true,
        hint: 'Minute hour day month weekday — "0 9 * * 1-5" is 09:00 on weekdays (server time).',
        showWhen: { key: 'type', is: ['schedule'] },
      },
      {
        type: 'textarea',
        key: 'task',
        label: 'What to do each time',
        rows: 3,
        required: true,
        placeholder: 'Summarise yesterday’s support tickets and flag anything urgent.',
        showWhen: { key: 'type', is: ['schedule'] },
      },
      { type: 'toggle', key: 'enabled', label: 'Enabled', showWhen: { key: 'type', is: ['schedule'] } },
    ],
    summary: (config) =>
      str(config, 'type') === 'schedule'
        ? `schedule · ${str(config, 'expression', '—')}`
        : str(config, 'type') === 'mention'
          ? 'on @mention'
          : 'on request',
  },

  guardrail: {
    kind: 'guardrail',
    label: 'Guardrail',
    category: 'safety',
    description: 'A policy applied to every run.',
    accent: 'rose',
    icon: ShieldCheck,
    handles: { in: true, out: true },
    defaults: {
      policy: 'pii-redaction',
      action: 'redact',
      maxTokens: 2000,
    },
    fields: [
      {
        type: 'select',
        key: 'policy',
        label: 'Policy',
        options: [
          { value: 'pii-redaction', label: 'Personal data in answers' },
          { value: 'cost-cap', label: 'Token cap per model call' },
        ],
      },
      {
        type: 'select',
        key: 'action',
        label: 'When an answer contains emails, phone, card or SSN numbers',
        options: [
          { value: 'redact', label: 'Redact them' },
          { value: 'block', label: 'Withhold the answer' },
          { value: 'warn', label: 'Allow, but note it in the run' },
        ],
        showWhen: { key: 'policy', is: ['pii-redaction'] },
      },
      {
        type: 'number',
        key: 'maxTokens',
        label: 'Max tokens per call',
        min: 64,
        max: 128000,
        step: 64,
        showWhen: { key: 'policy', is: ['cost-cap'] },
      },
    ],
    summary: (config) =>
      str(config, 'policy') === 'cost-cap'
        ? `≤ ${num(config, 'maxTokens')} tokens`
        : `PII → ${str(config, 'action', 'redact')}`,
  },

  model: {
    kind: 'model',
    label: 'Model',
    category: 'reasoning',
    description: 'The provider and sampling settings the agent reasons with.',
    accent: 'indigo',
    icon: Cpu,
    singleton: true,
    handles: { cap: true },
    defaults: {
      provider: 'nvidia',
      model: 'nvidia/nemotron-3-super-120b-a12b',
      temperature: 0.2,
      maxTokens: 4096,
    },
    fields: [
      { type: 'source', key: 'provider', label: 'Provider', source: 'providers', required: true },
      {
        type: 'source',
        key: 'model',
        label: 'Model',
        source: 'models',
        filterBy: 'provider',
        required: true,
        hint: 'Custom models need a Pro or Business plan; otherwise the workspace default is used.',
      },
      {
        type: 'number',
        key: 'temperature',
        label: 'Temperature',
        min: 0,
        max: 2,
        step: 0.1,
        hint: 'Lower is more deterministic.',
      },
      { type: 'number', key: 'maxTokens', label: 'Max tokens', min: 256, max: 128000, step: 256 },
    ],
    summary: (config) =>
      `${str(config, 'model', '—')} · t=${num(config, 'temperature')}`,
  },

  prompt: {
    kind: 'prompt',
    label: 'Instructions',
    category: 'reasoning',
    description: 'The system prompt and the shape of the answer.',
    accent: 'blue',
    icon: MessageSquareCode,
    singleton: true,
    handles: { cap: true },
    defaults: {
      label: 'System instructions',
      systemPrompt:
        'You are a helpful AI agent in this workspace. Be concise, cite the source of anything you look up, and ask before doing anything you are unsure about.',
      responseFormat: 'markdown',
    },
    fields: [
      {
        type: 'textarea',
        key: 'systemPrompt',
        label: 'System prompt',
        rows: 9,
        required: true,
        hint: 'How the agent behaves, what it may do and what it must never do.',
      },
      {
        type: 'select',
        key: 'responseFormat',
        label: 'Answer format',
        options: [
          { value: 'markdown', label: 'Markdown' },
          { value: 'json', label: 'JSON only' },
          { value: 'plain', label: 'Plain text' },
        ],
      },
    ],
    summary: (config) => `${str(config, 'systemPrompt').length} chars`,
  },

  memory: {
    kind: 'memory',
    label: 'Memory',
    category: 'reasoning',
    description: 'Whether the agent sees facts saved in this workspace.',
    accent: 'cyan',
    icon: Brain,
    singleton: true,
    handles: { cap: true },
    defaults: { strategy: 'workspace' },
    fields: [
      {
        type: 'select',
        key: 'strategy',
        label: 'Memory',
        options: [
          { value: 'workspace', label: 'Workspace memory — facts saved with save_memory' },
          { value: 'none', label: 'None — every run starts fresh' },
        ],
        hint: 'Give the agent the save_memory tool so it can add facts.',
      },
    ],
    summary: (config) => (str(config, 'strategy') === 'none' ? 'stateless' : 'workspace memory'),
  },

  knowledge: {
    kind: 'knowledge',
    label: 'Knowledge',
    category: 'capability',
    description: 'A knowledge base the agent retrieves from before answering.',
    accent: 'teal',
    icon: BookOpen,
    handles: { cap: true },
    defaults: { knowledgeBaseId: '', topK: 5 },
    fields: [
      {
        type: 'source',
        key: 'knowledgeBaseId',
        label: 'Knowledge base',
        source: 'knowledgeBases',
        required: true,
        placeholder: 'Pick a knowledge base',
        hint: 'Create and fill knowledge bases in AI Workspace → Knowledge.',
      },
      { type: 'number', key: 'topK', label: 'Passages per answer', min: 1, max: 20, step: 1 },
    ],
    summary: (config) =>
      `${str(config, labelKey('knowledgeBaseId'), 'no knowledge base')} · ${num(config, 'topK', 5)} passages`,
  },

  tool: {
    kind: 'tool',
    label: 'Tool',
    category: 'capability',
    description: 'Something the agent may do: a workspace action, a web lookup or an MCP tool.',
    accent: 'green',
    icon: Wrench,
    handles: { cap: true },
    defaults: { toolId: 'search_docs', requiresApproval: false },
    fields: [
      {
        type: 'source',
        key: 'toolId',
        label: 'Tool',
        source: 'tools',
        required: true,
      },
      {
        type: 'toggle',
        key: 'requiresApproval',
        label: 'Always ask before using',
        hint: 'On top of the agent’s autonomy setting.',
      },
    ],
    summary: (config) =>
      `${str(config, labelKey('toolId'), str(config, 'toolId', '—'))}${config['requiresApproval'] ? ' · approval' : ''}`,
  },

  output: {
    kind: 'output',
    label: 'Output',
    category: 'delivery',
    description: 'Where a scheduled run’s result goes. Chat replies answer in place.',
    accent: 'orange',
    icon: Send,
    handles: { in: true },
    defaults: { channel: 'chat', channelId: '', projectId: '', url: '' },
    fields: [
      {
        type: 'select',
        key: 'channel',
        label: 'Deliver to',
        options: [
          { value: 'chat', label: 'The conversation it was asked in' },
          { value: 'channel', label: 'A channel' },
          { value: 'task', label: 'A new task' },
          { value: 'webhook', label: 'A webhook (HTTPS POST)' },
        ],
      },
      {
        type: 'source',
        key: 'channelId',
        label: 'Channel',
        source: 'channels',
        required: true,
        showWhen: { key: 'channel', is: ['channel', 'matrix-channel'] },
      },
      {
        type: 'source',
        key: 'projectId',
        label: 'Project',
        source: 'projects',
        hint: 'Optional — leave empty for a task with no project.',
        showWhen: { key: 'channel', is: ['task'] },
      },
      {
        type: 'text',
        key: 'url',
        label: 'Webhook URL',
        mono: true,
        required: true,
        placeholder: 'https://hooks.example.com/agent',
        showWhen: { key: 'channel', is: ['webhook'] },
      },
    ],
    summary: (config) => {
      const kind = str(config, 'channel', 'chat');
      if (kind === 'channel' || kind === 'matrix-channel') {
        return `#${str(config, labelKey('channelId'), 'pick a channel')}`;
      }
      if (kind === 'task') return `task${str(config, labelKey('projectId')) ? ` in ${str(config, labelKey('projectId'))}` : ''}`;
      if (kind === 'webhook') return str(config, 'url', 'webhook');
      return 'reply in chat';
    },
  },
};

/** Palette order. Core first, then the spine, then what plugs into it. */
export const PALETTE_ORDER: ReadonlyArray<AgentNodeKind> = [
  'agent',
  'trigger',
  'guardrail',
  'model',
  'prompt',
  'memory',
  'knowledge',
  'tool',
  'output',
];

/** Guards the drag payload, which arrives from the DOM as an untyped string. */
export function isAgentNodeKind(value: string): value is AgentNodeKind {
  return (NODE_KINDS as ReadonlyArray<string>).includes(value);
}

export function specFor(kind: AgentNodeKind): NodeKindSpec {
  return NODE_SPECS[kind];
}

export function accentFor(kind: AgentNodeKind): NodeAccent {
  return NODE_ACCENTS[NODE_SPECS[kind].accent];
}

/** A fresh copy — node config is mutated per instance, so defaults must not be shared. */
export function defaultConfigFor(kind: AgentNodeKind): NodeConfig {
  return { ...NODE_SPECS[kind].defaults };
}

/**
 * Field values arrive from `<input>` as strings; keep them in the type the
 * spec declared so validation and the summary lines do not have to re-parse.
 */
export function coerceFieldValue(field: FieldSpec, raw: unknown): ConfigValue {
  switch (field.type) {
    case 'number': {
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case 'toggle':
      return Boolean(raw);
    default:
      return String(raw ?? '');
  }
}

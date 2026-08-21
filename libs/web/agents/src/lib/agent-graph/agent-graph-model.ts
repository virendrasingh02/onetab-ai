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

export type FieldSpec =
  | {
      type: 'text';
      key: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      mono?: boolean;
      hint?: string;
    }
  | {
      type: 'textarea';
      key: string;
      label: string;
      rows?: number;
      placeholder?: string;
      required?: boolean;
      hint?: string;
    }
  | {
      type: 'select';
      key: string;
      label: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      hint?: string;
    }
  | {
      type: 'number';
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
      hint?: string;
    }
  | { type: 'toggle'; key: string; label: string; hint?: string };

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

const PROVIDER_OPTIONS = [
  { value: 'nvidia', label: 'NVIDIA' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
] as const;

/** Mirrors the tool names the marketplace agents advertise. */
const TOOL_OPTIONS = [
  { value: 'create_task', label: 'create_task' },
  { value: 'search_docs', label: 'search_docs' },
  { value: 'send_channel_message', label: 'send_channel_message' },
  { value: 'schedule_event', label: 'schedule_event' },
  { value: 'http_request', label: 'http_request' },
  { value: 'run_code', label: 'run_code' },
  { value: 'index_document', label: 'index_document' },
] as const;

function str(config: NodeConfig, key: string, fallback = ''): string {
  const value = config[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function num(config: NodeConfig, key: string, fallback = 0): number {
  const value = config[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

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
      name: 'Workspace Security Guard',
      role: 'Security auditor',
      objective:
        'Inspect workspace activity, audit user permissions and report suspicious actions to the security channel.',
      autonomy: 'supervised',
    },
    fields: [
      { type: 'text', key: 'name', label: 'Agent name', required: true },
      { type: 'text', key: 'role', label: 'Role', required: true },
      {
        type: 'textarea',
        key: 'objective',
        label: 'Objective',
        rows: 4,
        required: true,
        hint: 'One paragraph on what success looks like for this agent.',
      },
      {
        type: 'select',
        key: 'autonomy',
        label: 'Autonomy',
        options: [
          { value: 'supervised', label: 'Supervised — every action approved' },
          { value: 'semi', label: 'Semi-autonomous — writes need approval' },
          { value: 'autonomous', label: 'Autonomous — acts within guardrails' },
        ],
      },
    ],
    summary: (config) => str(config, 'role', 'No role set'),
  },

  trigger: {
    kind: 'trigger',
    label: 'Trigger',
    category: 'entry',
    description: 'What wakes the agent up — a schedule, a webhook, a mention.',
    accent: 'amber',
    icon: Zap,
    handles: { out: true },
    defaults: {
      type: 'schedule',
      expression: '0 */6 * * *',
      enabled: true,
    },
    fields: [
      {
        type: 'select',
        key: 'type',
        label: 'Trigger type',
        options: [
          { value: 'manual', label: 'Manual run' },
          { value: 'schedule', label: 'Schedule (cron)' },
          { value: 'webhook', label: 'Inbound webhook' },
          { value: 'event', label: 'Workspace event' },
          { value: 'mention', label: 'Channel mention' },
        ],
      },
      {
        type: 'text',
        key: 'expression',
        label: 'Expression',
        mono: true,
        required: true,
        hint: 'A cron string, an event name or a webhook path.',
      },
      { type: 'toggle', key: 'enabled', label: 'Enabled' },
    ],
    summary: (config) =>
      `${str(config, 'type', 'manual')} · ${str(config, 'expression', '—')}`,
  },

  guardrail: {
    kind: 'guardrail',
    label: 'Guardrail',
    category: 'safety',
    description: 'A policy the run must clear before the agent acts.',
    accent: 'rose',
    icon: ShieldCheck,
    handles: { in: true, out: true },
    defaults: {
      policy: 'pii-redaction',
      action: 'redact',
      threshold: 0.8,
    },
    fields: [
      {
        type: 'select',
        key: 'policy',
        label: 'Policy',
        options: [
          { value: 'pii-redaction', label: 'PII redaction' },
          { value: 'content-filter', label: 'Content filter' },
          { value: 'cost-cap', label: 'Cost cap per run' },
          { value: 'tool-allowlist', label: 'Tool allowlist' },
        ],
      },
      {
        type: 'select',
        key: 'action',
        label: 'On violation',
        options: [
          { value: 'block', label: 'Block the run' },
          { value: 'warn', label: 'Warn and continue' },
          { value: 'redact', label: 'Redact and continue' },
        ],
      },
      {
        type: 'number',
        key: 'threshold',
        label: 'Threshold',
        min: 0,
        max: 1,
        step: 0.05,
        hint: 'Confidence above which the policy fires.',
      },
    ],
    summary: (config) =>
      `${str(config, 'policy', 'policy')} → ${str(config, 'action', 'warn')}`,
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
      streaming: true,
    },
    fields: [
      {
        type: 'select',
        key: 'provider',
        label: 'Provider',
        options: PROVIDER_OPTIONS,
      },
      {
        type: 'text',
        key: 'model',
        label: 'Model',
        mono: true,
        required: true,
        placeholder: 'nvidia/nemotron-3-super-120b-a12b',
      },
      {
        type: 'number',
        key: 'temperature',
        label: 'Temperature',
        min: 0,
        max: 2,
        step: 0.1,
        hint: 'Lower is more deterministic. Audit work wants ≤ 0.3.',
      },
      {
        type: 'number',
        key: 'maxTokens',
        label: 'Max tokens',
        min: 256,
        max: 128000,
        step: 256,
      },
      { type: 'toggle', key: 'streaming', label: 'Stream responses' },
    ],
    summary: (config) =>
      `${str(config, 'provider', '—')}/${str(config, 'model', '—')} · t=${num(
        config,
        'temperature',
      )}`,
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
        'You are an autonomous AI security auditor. Inspect workspace activities, audit user permissions, and report suspicious actions. Cite the record you based each finding on.',
      responseFormat: 'markdown',
    },
    fields: [
      { type: 'text', key: 'label', label: 'Label' },
      {
        type: 'textarea',
        key: 'systemPrompt',
        label: 'System prompt',
        rows: 9,
        required: true,
        hint: 'Describe how the agent behaves and what it may access.',
      },
      {
        type: 'select',
        key: 'responseFormat',
        label: 'Response format',
        options: [
          { value: 'markdown', label: 'Markdown' },
          { value: 'json', label: 'Structured JSON' },
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
    description: 'How much of previous runs the agent carries forward.',
    accent: 'cyan',
    icon: Brain,
    singleton: true,
    handles: { cap: true },
    defaults: {
      strategy: 'summary',
      windowSize: 20,
      persist: true,
    },
    fields: [
      {
        type: 'select',
        key: 'strategy',
        label: 'Strategy',
        options: [
          { value: 'none', label: 'Stateless' },
          { value: 'buffer', label: 'Rolling buffer' },
          { value: 'summary', label: 'Rolling summary' },
          { value: 'vector', label: 'Vector recall' },
        ],
      },
      {
        type: 'number',
        key: 'windowSize',
        label: 'Window size',
        min: 1,
        max: 200,
        step: 1,
        hint: 'Messages kept before the strategy compacts them.',
      },
      {
        type: 'toggle',
        key: 'persist',
        label: 'Persist between runs',
      },
    ],
    summary: (config) =>
      `${str(config, 'strategy', 'none')} · ${num(config, 'windowSize')} turns`,
  },

  knowledge: {
    kind: 'knowledge',
    label: 'Knowledge',
    category: 'capability',
    description: 'A corpus the agent retrieves from before answering.',
    accent: 'teal',
    icon: BookOpen,
    handles: { cap: true },
    defaults: {
      source: 'workspace-docs',
      collection: 'security-policies',
      topK: 6,
      rerank: true,
    },
    fields: [
      {
        type: 'select',
        key: 'source',
        label: 'Source',
        options: [
          { value: 'workspace-docs', label: 'Workspace documents' },
          { value: 'channels', label: 'Channel history' },
          { value: 'uploads', label: 'Uploaded files' },
          { value: 'external-url', label: 'External URL' },
        ],
      },
      {
        type: 'text',
        key: 'collection',
        label: 'Collection',
        mono: true,
        required: true,
      },
      { type: 'number', key: 'topK', label: 'Top K', min: 1, max: 50, step: 1 },
      { type: 'toggle', key: 'rerank', label: 'Rerank results' },
    ],
    summary: (config) =>
      `${str(config, 'collection', '—')} · k=${num(config, 'topK')}`,
  },

  tool: {
    kind: 'tool',
    label: 'Tool',
    category: 'capability',
    description: 'A workspace action the agent is permitted to call.',
    accent: 'green',
    icon: Wrench,
    handles: { cap: true },
    defaults: {
      toolId: 'search_docs',
      permission: 'read',
      requiresApproval: false,
      rateLimit: 30,
    },
    fields: [
      { type: 'select', key: 'toolId', label: 'Tool', options: TOOL_OPTIONS },
      {
        type: 'select',
        key: 'permission',
        label: 'Permission',
        options: [
          { value: 'read', label: 'Read only' },
          { value: 'write', label: 'Read + write' },
          { value: 'admin', label: 'Administrative' },
        ],
      },
      {
        type: 'toggle',
        key: 'requiresApproval',
        label: 'Require human approval',
      },
      {
        type: 'number',
        key: 'rateLimit',
        label: 'Calls per hour',
        min: 1,
        max: 1000,
        step: 1,
      },
    ],
    summary: (config) =>
      `${str(config, 'toolId', '—')} · ${str(config, 'permission', 'read')}`,
  },

  output: {
    kind: 'output',
    label: 'Output',
    category: 'delivery',
    description: 'Where a finished run is delivered.',
    accent: 'orange',
    icon: Send,
    handles: { in: true },
    defaults: {
      channel: 'matrix-channel',
      target: '#security-alerts',
      format: 'summary',
    },
    fields: [
      {
        type: 'select',
        key: 'channel',
        label: 'Destination',
        options: [
          { value: 'matrix-channel', label: 'Matrix channel' },
          { value: 'email', label: 'Email digest' },
          { value: 'webhook', label: 'Outbound webhook' },
          { value: 'task', label: 'Create a task' },
          { value: 'doc', label: 'Append to a document' },
        ],
      },
      {
        type: 'text',
        key: 'target',
        label: 'Target',
        mono: true,
        required: true,
      },
      {
        type: 'select',
        key: 'format',
        label: 'Payload',
        options: [
          { value: 'summary', label: 'Summary' },
          { value: 'full', label: 'Full transcript' },
          { value: 'json', label: 'Structured JSON' },
        ],
      },
    ],
    summary: (config) =>
      `${str(config, 'channel', '—')} → ${str(config, 'target', '—')}`,
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

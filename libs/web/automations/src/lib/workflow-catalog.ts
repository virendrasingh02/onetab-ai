/**
 * What a workflow can be built from.
 *
 * Every entry is a step `WorkflowEngineService` actually runs, and its
 * `fields` are exactly the settings the engine reads for it — the inspector is
 * generated from this, so a field on screen is a field that does something.
 * `outputs` are the keys the step adds to the run context, which is what the
 * Variables panel offers as `{{stepId.key}}`.
 *
 * Steps that used to be offered without doing anything (arbitrary code, a
 * "structured output" that returned the text length, a switch whose cases
 * could not be wired) are gone from the palette; saved graphs that contain
 * them still open.
 */

import { AGENT_EVENTS } from '@org/types';
import type { OptionSource } from '@org/web-agents';
import {
  Bot,
  Brain,
  Database,
  FileSearch,
  GitBranch,
  GitMerge,
  Globe,
  Layers,
  Link2,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Tag,
  Timer,
  UserCheck,
  Variable as VariableIcon,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type NodeCategory = 'triggers' | 'ai' | 'knowledge' | 'logic' | 'tools';

export interface WorkflowField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'select' | 'source' | 'json' | 'csv';
  options?: ReadonlyArray<{ value: string; label: string }>;
  source?: OptionSource;
  /** Narrow a `source` picker by another field's value (models by provider). */
  filterBy?: string;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  mono?: boolean;
  required?: boolean;
  showWhen?: { key: string; is: readonly string[] };
}

export interface NodeCatalogItem {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultData: Record<string, unknown>;
  fields: readonly WorkflowField[];
  /** Keys this step adds to the run context. */
  outputs: readonly string[];
  /** Named outgoing handles (branches). Absent: one plain output. */
  branches?: (data: Record<string, unknown>) => string[];
  /** Not offered in the palette, but still rendered in saved graphs. */
  legacy?: boolean;
}

/**
 * Workspace events a workflow can start on (`AutomationTriggerListener`) —
 * the same catalog the Studio offers (`AGENT_EVENTS`), so canvas workflows and
 * Studio agents react to the same things. Events that only fire for a chosen
 * channel are left out: the canvas trigger has no channel picker.
 */
export const WORKFLOW_EVENTS: ReadonlyArray<{ value: string; label: string }> = [
  ...AGENT_EVENTS.filter((e) => e.filter !== 'channel').map(({ value, label }) => ({ value, label })),
  { value: 'channel.created', label: 'A channel is created' },
];

const csv = (value: unknown): string[] =>
  (Array.isArray(value) ? value.map(String) : String(value ?? '').split(','))
    .map((part) => part.trim())
    .filter(Boolean);

const MODEL_FIELDS: WorkflowField[] = [
  { key: 'provider', label: 'Provider', kind: 'source', source: 'providers', hint: 'Leave empty for the workspace default model.' },
  { key: 'model', label: 'Model', kind: 'source', source: 'models', filterBy: 'provider' },
];

export const NODE_CATALOG: NodeCatalogItem[] = [
  /* ------------------------------------------------------ triggers & I/O ---- */
  {
    type: 'TRIGGER',
    category: 'triggers',
    label: 'Trigger',
    description: 'When the workflow runs: on request, on a schedule, or on a workspace event',
    icon: Zap,
    defaultData: { label: 'Start', triggerKind: 'MANUAL', cron: '0 9 * * 1-5', event: 'task.created' },
    fields: [
      {
        key: 'triggerKind',
        label: 'Runs',
        kind: 'select',
        options: [
          { value: 'MANUAL', label: 'On request (Run button or the API)' },
          { value: 'CRON', label: 'On a schedule' },
          { value: 'EVENT', label: 'When something happens in the workspace' },
        ],
      },
      {
        key: 'cron',
        label: 'Schedule (cron)',
        kind: 'text',
        mono: true,
        required: true,
        hint: 'Minute hour day month weekday — "0 9 * * 1-5" is 09:00 on weekdays (server time).',
        showWhen: { key: 'triggerKind', is: ['CRON'] },
      },
      {
        key: 'event',
        label: 'Event',
        kind: 'select',
        options: WORKFLOW_EVENTS,
        showWhen: { key: 'triggerKind', is: ['EVENT'] },
        hint: 'The event’s fields (e.g. {{title}} for a task) are available to later steps.',
      },
    ],
    outputs: [],
  },
  {
    type: 'OUTPUT',
    category: 'triggers',
    label: 'Result',
    description: 'The run’s result — shown in Runs and returned to the caller',
    icon: Radio,
    defaultData: { label: 'Result', template: '' },
    fields: [
      {
        key: 'template',
        label: 'Result',
        kind: 'textarea',
        placeholder: '{{summary.aiOutput}}',
        hint: 'Leave empty to return everything the run produced.',
      },
    ],
    outputs: ['output'],
  },
  {
    type: 'HUMAN_APPROVAL',
    category: 'triggers',
    label: 'Approval',
    description: 'Pause until the workflow’s creator or an admin approves',
    icon: ShieldCheck,
    defaultData: { label: 'Approve', action: 'Approve before continuing' },
    fields: [
      {
        key: 'action',
        label: 'What they are approving',
        kind: 'text',
        hint: 'Shown in AI Workspace → Approvals. Approving continues the run; rejecting stops it.',
      },
    ],
    outputs: ['approval.comment'],
  },

  /* ------------------------------------------------------------------ AI ---- */
  {
    type: 'LLM',
    category: 'ai',
    label: 'Generate text',
    description: 'Ask a model — summarise, draft, rewrite, answer',
    icon: Sparkles,
    defaultData: { label: 'Generate', prompt: '{{input.text}}', temperature: 0.4 },
    fields: [
      { key: 'prompt', label: 'Prompt', kind: 'textarea', required: true, placeholder: 'Summarise {{input.text}} in three bullets.' },
      ...MODEL_FIELDS,
      { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 2, step: 0.1 },
    ],
    outputs: ['aiOutput'],
  },
  {
    type: 'AGENT',
    category: 'ai',
    label: 'Ask an agent',
    description: 'Run one of your agents — with its tools, knowledge and approval rules',
    icon: Bot,
    defaultData: { label: 'Agent', agentId: '', goal: '{{input.text}}' },
    fields: [
      { key: 'agentId', label: 'Agent', kind: 'source', source: 'agents', required: true },
      { key: 'goal', label: 'What to ask it', kind: 'textarea', required: true },
    ],
    outputs: ['entityResponse'],
  },
  {
    type: 'AI_COWORKER',
    category: 'ai',
    label: 'Ask a coworker',
    description: 'Hand a task to one of your AI coworkers',
    icon: UserCheck,
    defaultData: { label: 'Coworker', coworkerId: '', task: '{{input.text}}' },
    fields: [
      { key: 'coworkerId', label: 'Coworker', kind: 'source', source: 'coworkers', required: true },
      { key: 'task', label: 'Task', kind: 'textarea', required: true },
    ],
    outputs: ['entityResponse'],
  },
  {
    type: 'CLASSIFIER',
    category: 'ai',
    label: 'Classify',
    description: 'Sort text into one of your categories and branch on it',
    icon: Tag,
    defaultData: { label: 'Classify', input: '{{input.text}}', categories: 'bug, feature, question' },
    fields: [
      { key: 'input', label: 'Text to classify', kind: 'textarea', required: true },
      { key: 'categories', label: 'Categories', kind: 'csv', required: true, hint: 'Comma-separated. Each gets its own output, plus "default".' },
      ...MODEL_FIELDS,
    ],
    outputs: ['classification'],
    branches: (data) => [...csv(data['categories'] ?? data['classes']), 'default'],
  },
  {
    type: 'EXTRACT_DATA',
    category: 'ai',
    label: 'Extract fields',
    description: 'Pull named fields out of text as JSON',
    icon: FileSearch,
    defaultData: { label: 'Extract', input: '{{input.text}}', fields: 'name, email, company' },
    fields: [
      { key: 'input', label: 'Text', kind: 'textarea', required: true },
      { key: 'fields', label: 'Fields', kind: 'csv', hint: 'Comma-separated. Empty: whatever facts the model finds.' },
      ...MODEL_FIELDS,
    ],
    outputs: ['extracted'],
  },
  {
    type: 'PROMPT',
    category: 'ai',
    label: 'Fill a template',
    description: 'Combine values into text for a later step',
    icon: Brain,
    defaultData: { label: 'Template', promptText: 'Customer {{input.name}} wrote: {{input.text}}' },
    fields: [{ key: 'promptText', label: 'Template', kind: 'textarea', required: true }],
    outputs: ['prompt'],
  },

  /* ----------------------------------------------------------- knowledge ---- */
  {
    type: 'KNOWLEDGE_RETRIEVAL',
    category: 'knowledge',
    label: 'Search knowledge',
    description: 'Find the most relevant passages in a knowledge base',
    icon: Database,
    defaultData: { label: 'Knowledge', knowledgeBaseId: '', query: '{{input.text}}', topK: 4 },
    fields: [
      { key: 'knowledgeBaseId', label: 'Knowledge base', kind: 'source', source: 'knowledgeBases', required: true },
      { key: 'query', label: 'Search for', kind: 'text', required: true },
      { key: 'topK', label: 'Passages', kind: 'number', min: 1, max: 20, step: 1 },
    ],
    outputs: ['retrievedDocuments', 'count'],
  },
  {
    type: 'FIRECRAWL_SEARCH',
    category: 'knowledge',
    label: 'Search the web',
    description: 'Web search (uses the Firecrawl key in Tools → Secrets when set)',
    icon: Search,
    defaultData: { label: 'Web search', query: '{{input.topic}}', limit: 5 },
    fields: [
      { key: 'query', label: 'Query', kind: 'text', required: true },
      { key: 'limit', label: 'Results', kind: 'number', min: 1, max: 10, step: 1 },
    ],
    outputs: ['searchResult'],
  },
  {
    type: 'FIRECRAWL_SCRAPE',
    category: 'knowledge',
    label: 'Read a web page',
    description: 'Fetch a public page as text',
    icon: Globe,
    defaultData: { label: 'Read page', url: '{{input.url}}' },
    fields: [{ key: 'url', label: 'URL', kind: 'text', mono: true, required: true }],
    outputs: ['scrapeResult'],
  },

  /* --------------------------------------------------------------- logic ---- */
  {
    type: 'CONDITION',
    category: 'logic',
    label: 'If / else',
    description: 'Continue down “true” or “false”',
    icon: GitBranch,
    defaultData: { label: 'Check', expression: 'input.score >= 0.8' },
    fields: [
      {
        key: 'expression',
        label: 'Condition',
        kind: 'text',
        mono: true,
        required: true,
        hint: 'A value and a comparison: input.status == "done", score >= 0.8, email contains "@acme", exists input.id.',
      },
    ],
    outputs: [],
    branches: () => ['true', 'false'],
  },
  {
    type: 'MERGE',
    category: 'logic',
    label: 'Join',
    description: 'Wait for every branch leading here, then continue once',
    icon: GitMerge,
    defaultData: { label: 'Join' },
    fields: [],
    outputs: [],
  },
  {
    type: 'DELAY',
    category: 'logic',
    label: 'Short wait',
    description: 'Pause up to 15 seconds (e.g. before re-checking an API)',
    icon: Timer,
    defaultData: { label: 'Wait', seconds: 5 },
    fields: [{ key: 'seconds', label: 'Seconds', kind: 'number', min: 1, max: 15, step: 1 }],
    outputs: [],
  },
  {
    type: 'VARIABLE',
    category: 'logic',
    label: 'Set a value',
    description: 'Name a value for later steps',
    icon: VariableIcon,
    defaultData: { label: 'Set value', name: 'summary', value: '' },
    fields: [
      { key: 'name', label: 'Name', kind: 'text', mono: true, required: true },
      { key: 'value', label: 'Value', kind: 'textarea' },
    ],
    outputs: [],
  },

  /* --------------------------------------------------------------- tools ---- */
  {
    type: 'TOOL',
    category: 'tools',
    label: 'Workspace tool',
    description: 'Create a task or doc, list projects, save a memory…',
    icon: Wrench,
    defaultData: { label: 'Tool', toolName: 'create_task', input: '{\n  "title": "{{input.title}}"\n}' },
    fields: [
      { key: 'toolName', label: 'Tool', kind: 'source', source: 'tools', required: true },
      { key: 'input', label: 'Input (JSON)', kind: 'json', hint: 'The tool’s parameters. {{…}} values are filled in when it runs.' },
    ],
    outputs: ['toolResult'],
  },
  {
    type: 'MCP',
    category: 'tools',
    label: 'MCP server tool',
    description: 'Call a tool on a connected MCP server',
    icon: Link2,
    defaultData: { label: 'MCP tool', mcpTool: '', input: '{}' },
    fields: [
      { key: 'mcpTool', label: 'Tool', kind: 'source', source: 'mcpServerTools', required: true },
      { key: 'input', label: 'Input (JSON)', kind: 'json' },
    ],
    outputs: ['toolResult'],
  },
  {
    type: 'HTTP_REQUEST',
    category: 'tools',
    label: 'HTTP request',
    description: 'Call a public HTTPS API',
    icon: Globe,
    defaultData: { label: 'HTTP request', method: 'POST', url: 'https://', body: '' },
    fields: [
      {
        key: 'method',
        label: 'Method',
        kind: 'select',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m })),
      },
      {
        key: 'url',
        label: 'URL',
        kind: 'text',
        mono: true,
        required: true,
        hint: 'Private and internal addresses are refused.',
      },
      { key: 'body', label: 'Body', kind: 'textarea', showWhen: { key: 'method', is: ['POST', 'PUT', 'PATCH'] } },
    ],
    outputs: ['statusCode', 'body'],
  },

  /* ---------------------------------------------- still readable, not offered ---- */
  { type: 'START', category: 'triggers', label: 'Start', description: 'Start', icon: Zap, defaultData: {}, fields: [], outputs: [], legacy: true },
  { type: 'USER_INPUT', category: 'triggers', label: 'Input', description: 'Input', icon: Zap, defaultData: {}, fields: [], outputs: [], legacy: true },
  {
    type: 'HUMAN_INPUT',
    category: 'triggers',
    label: 'Approval',
    description: 'Pause for a person',
    icon: ShieldCheck,
    defaultData: {},
    fields: [{ key: 'action', label: 'What they are approving', kind: 'text' }],
    outputs: ['approval.comment'],
    legacy: true,
  },
  { type: 'PARALLEL', category: 'logic', label: 'Split', description: 'Both branches run', icon: Layers, defaultData: {}, fields: [], outputs: [], legacy: true },
  {
    type: 'SWITCH',
    category: 'logic',
    label: 'Switch',
    description: 'Branch on a value',
    icon: Split,
    defaultData: {},
    fields: [
      { key: 'value', label: 'Value', kind: 'text', mono: true },
      { key: 'cases', label: 'Cases', kind: 'csv' },
    ],
    outputs: ['switchBranch'],
    branches: (data) => [...csv(data['cases']), 'default'],
    legacy: true,
  },
  {
    type: 'STRUCTURED_OUTPUT',
    category: 'ai',
    label: 'Extract fields',
    description: 'Extract fields',
    icon: FileSearch,
    defaultData: {},
    fields: [{ key: 'input', label: 'Text', kind: 'textarea' }, { key: 'fields', label: 'Fields', kind: 'csv' }],
    outputs: ['extracted'],
    legacy: true,
  },
  {
    type: 'CODE',
    category: 'tools',
    label: 'Code (not run)',
    description: 'Code steps are skipped — use Set a value or Fill a template',
    icon: Wrench,
    defaultData: {},
    fields: [],
    outputs: [],
    legacy: true,
  },
];

export function catalogItem(type: string | undefined): NodeCatalogItem | undefined {
  return NODE_CATALOG.find((item) => item.type === type);
}

/** The palette: every step that does something, legacy entries excluded. */
export const PALETTE = NODE_CATALOG.filter((item) => !item.legacy);

export function isFieldShown(field: WorkflowField, data: Record<string, unknown>): boolean {
  return !field.showWhen || field.showWhen.is.includes(String(data[field.showWhen.key] ?? ''));
}

/** Required fields that are blank on a node, for the pre-save check. */
export function missingFields(type: string, data: Record<string, unknown>): string[] {
  const item = catalogItem(type);
  if (!item) return [];
  return item.fields
    .filter((f) => f.required && isFieldShown(f, data))
    .filter((f) => {
      const value = data[f.key];
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map((f) => f.label);
}

/** `triggerType` for the workflow row, from its trigger node. */
export function triggerTypeFor(data: Record<string, unknown> | undefined): string {
  const kind = String(data?.['triggerKind'] ?? 'MANUAL').toUpperCase();
  if (kind === 'CRON') return 'CRON';
  if (kind === 'EVENT') return String(data?.['event'] ?? 'task.created');
  return 'MANUAL';
}

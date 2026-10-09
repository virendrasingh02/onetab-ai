/**
 * AI Agent Studio — an agent's capability modules (Prompt, LLM, Knowledge,
 * Tools, Sub-agents) as data.
 *
 * The canvas stores these settings on the agent node's `config` (legacy flat
 * keys such as `instructions`, `model`, `tools` stay where they always were;
 * newer settings live under `promptSettings`, `toolPolicies`, …). Everything
 * here is pure so the Studio drawer (preview, lint) and the run compiler
 * (`compileStudioGraph`) read the settings the same way: what the drawer
 * previews is exactly what the agent is given.
 */

/* ---------------------------------------------------------------- prompt -- */

export type PromptTone = 'neutral' | 'friendly' | 'professional' | 'concise' | 'empathetic';

export const PROMPT_TONES: ReadonlyArray<{ value: PromptTone; label: string; instruction: string }> = [
  { value: 'neutral', label: 'Neutral', instruction: '' },
  { value: 'friendly', label: 'Friendly', instruction: 'Write in a warm, friendly and approachable tone.' },
  { value: 'professional', label: 'Professional', instruction: 'Write in a clear, professional tone.' },
  { value: 'concise', label: 'Concise', instruction: 'Be brief: lead with the answer and leave out filler.' },
  { value: 'empathetic', label: 'Empathetic', instruction: 'Acknowledge how the person feels and respond with care.' },
];

/** `auto` leaves the format to the instructions; the others are enforced on the agent. */
export type PromptOutputFormat = 'auto' | 'text' | 'markdown' | 'json';

export interface PromptVariable {
  /** Dotted path as written in the prompt: `customer.name` for `{{customer.name}}`. */
  name: string;
  description?: string;
  required?: boolean;
  /** Used when the run has no value for it. */
  defaultValue?: string;
}

export interface PromptExample {
  id: string;
  input: string;
  output: string;
  /** Positive = a reply to imitate; negative = a reply to avoid. */
  kind: 'positive' | 'negative';
  enabled: boolean;
}

export interface AgentPromptSettings {
  objective: string;
  persona: string;
  tone: PromptTone;
  goals: string[];
  constraints: string[];
  successCriteria: string[];
  variables: PromptVariable[];
  examples: PromptExample[];
  output: { format: PromptOutputFormat; schema: string };
  reasoning: { plan: boolean; selfCheck: boolean; askWhenUnclear: boolean };
  safety: { citeSources: boolean; noFabrication: boolean; protectPersonalData: boolean; escalation: string };
}

export const DEFAULT_PROMPT_SETTINGS: AgentPromptSettings = {
  objective: '',
  persona: '',
  tone: 'neutral',
  goals: [],
  constraints: [],
  successCriteria: [],
  variables: [],
  examples: [],
  output: { format: 'auto', schema: '' },
  reasoning: { plan: false, selfCheck: false, askWhenUnclear: false },
  safety: { citeSources: false, noFabrication: false, protectPersonalData: false, escalation: '' },
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const bool = (v: unknown): boolean => v === true;
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];

/** `config.promptSettings` with every gap filled — old agents have none and read as defaults. */
export function readPromptSettings(raw: unknown): AgentPromptSettings {
  const r = obj(raw);
  const output = obj(r['output']);
  const reasoning = obj(r['reasoning']);
  const safety = obj(r['safety']);
  const format = output['format'];
  const tone = r['tone'];
  return {
    objective: str(r['objective']),
    persona: str(r['persona']),
    tone: PROMPT_TONES.some((t) => t.value === tone) ? (tone as PromptTone) : 'neutral',
    goals: strList(r['goals']),
    constraints: strList(r['constraints']),
    successCriteria: strList(r['successCriteria']),
    variables: (Array.isArray(r['variables']) ? r['variables'] : [])
      .map(obj)
      .filter((v) => VARIABLE_NAME.test(str(v['name']).trim()))
      .map((v) => ({
        name: str(v['name']).trim(),
        ...(str(v['description']) ? { description: str(v['description']) } : {}),
        ...(bool(v['required']) ? { required: true } : {}),
        ...(str(v['defaultValue']) ? { defaultValue: str(v['defaultValue']) } : {}),
      })),
    examples: (Array.isArray(r['examples']) ? r['examples'] : []).map(obj).map((e, i) => ({
      id: str(e['id']) || `example-${i + 1}`,
      input: str(e['input']),
      output: str(e['output']),
      kind: e['kind'] === 'negative' ? 'negative' : 'positive',
      enabled: e['enabled'] !== false,
    })),
    output: {
      format: format === 'text' || format === 'markdown' || format === 'json' ? format : 'auto',
      schema: str(output['schema']),
    },
    reasoning: {
      plan: bool(reasoning['plan']),
      selfCheck: bool(reasoning['selfCheck']),
      askWhenUnclear: bool(reasoning['askWhenUnclear']),
    },
    safety: {
      citeSources: bool(safety['citeSources']),
      noFabrication: bool(safety['noFabrication']),
      protectPersonalData: bool(safety['protectPersonalData']),
      escalation: str(safety['escalation']),
    },
  };
}

const VARIABLE_NAME = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/;
const VARIABLE_REF = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

/** Variables a text refers to, in order of first use. */
export function promptVariableRefs(text: string): string[] {
  const seen: string[] = [];
  for (const m of (text || '').matchAll(VARIABLE_REF)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

/** The runtime format the composed prompt asks for (`responseFormat` on the agent), if any. */
export function promptResponseFormat(settings: AgentPromptSettings): 'plain' | 'markdown' | 'json' | undefined {
  const f = settings.output.format;
  return f === 'text' ? 'plain' : f === 'markdown' || f === 'json' ? f : undefined;
}

/**
 * The system prompt an agent runs with: its instructions followed by the
 * structured sections that are set. Settings left at their defaults add
 * nothing, so an agent that never opened these settings runs exactly as before.
 */
export function composeAgentPrompt(instructions: string, settings: AgentPromptSettings): string {
  const parts: string[] = [];
  const base = (instructions || '').trim();
  if (base) parts.push(base);
  const section = (title: string, body: string) => {
    if (body.trim()) parts.push(`## ${title}\n${body.trim()}`);
  };

  section('Objective', settings.objective);
  section('Persona', settings.persona);
  if (settings.goals.length) section('Goals', bullets(settings.goals));
  if (settings.constraints.length) section('Constraints', bullets(settings.constraints));
  if (settings.successCriteria.length) section('A good answer', bullets(settings.successCriteria));

  const work: string[] = [];
  if (settings.reasoning.plan) work.push('Before acting, make a short plan of the steps and tools you need.');
  if (settings.reasoning.askWhenUnclear) work.push('If the request is ambiguous, ask one clarifying question instead of guessing.');
  if (settings.reasoning.selfCheck) {
    work.push('Before you answer, check the answer against the goals and constraints above and fix anything that misses.');
  }
  if (work.length) section('How to work', bullets(work));

  const safety: string[] = [];
  if (settings.safety.citeSources) safety.push('Name the source (document or tool) behind every factual claim.');
  if (settings.safety.noFabrication) safety.push('Never invent facts, numbers, links or quotes. If you don’t know, say so.');
  if (settings.safety.protectPersonalData) {
    safety.push('Don’t repeat personal data (emails, phone numbers, account or ID numbers) unless the task needs it.');
  }
  if (settings.safety.escalation.trim()) safety.push(`Hand over to a person when: ${settings.safety.escalation.trim()}`);
  if (safety.length) section('Safety', bullets(safety));

  const tone = PROMPT_TONES.find((t) => t.value === settings.tone)?.instruction;
  if (tone) section('Tone', tone);

  if (settings.output.format === 'json') {
    const schema = settings.output.schema.trim();
    section(
      'Output',
      schema
        ? `Reply with a single JSON object that matches this JSON Schema, and nothing else:\n\`\`\`json\n${schema}\n\`\`\``
        : 'Reply with a single valid JSON object and nothing else.',
    );
  } else if (settings.output.format === 'markdown') {
    section('Output', 'Format the reply in Markdown.');
  } else if (settings.output.format === 'text') {
    section('Output', 'Reply in plain text, without Markdown formatting.');
  }

  const examples = settings.examples.filter((e) => e.enabled && (e.input.trim() || e.output.trim()));
  if (examples.length) {
    section(
      'Examples',
      examples
        .map((e, i) =>
          e.kind === 'negative'
            ? `Example ${i + 1} — a reply to AVOID:\nInput: ${e.input.trim()}\nBad reply: ${e.output.trim()}`
            : `Example ${i + 1}:\nInput: ${e.input.trim()}\nReply: ${e.output.trim()}`,
        )
        .join('\n\n'),
    );
  }
  return parts.join('\n\n');
}

/** `{{path}}` → the declared default, for every variable that has one. */
export function promptVariableDefaults(settings: AgentPromptSettings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of settings.variables) if (v.defaultValue !== undefined && v.defaultValue !== '') out[v.name] = v.defaultValue;
  return out;
}

const readPath = (source: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((cur, key) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined), source);

/**
 * Fills `{{path}}` from `values` (dotted paths into the object, or flat
 * `'a.b'` keys), then from `defaults`. Unknown references are left as written
 * — the same rule the workflow engine applies to an agent's instructions.
 */
export function resolvePromptVariables(
  text: string,
  values: Record<string, unknown>,
  defaults: Record<string, string> = {},
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const resolved = (text || '').replace(VARIABLE_REF, (whole, path: string) => {
    const value = path in values ? values[path] : readPath(values, path);
    if (value !== undefined && value !== null && value !== '') return typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (path in defaults) return defaults[path];
    if (!missing.includes(path)) missing.push(path);
    return whole;
  });
  return { text: resolved, missing };
}

/** Rough token count (≈ 4 characters a token) — good enough for budgets and warnings. */
export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

/** Variable roots every canvas run provides (`{{input.message}}`, `{{__last}}`, …). */
export const RUNTIME_VARIABLE_ROOTS: readonly string[] = ['input', 'trigger', '__last', 'item', 'index', 'workflow', 'run', 'user', 'workspace'];

export interface PromptLintIssue {
  level: 'error' | 'warning' | 'info';
  /** Which part of the settings it is about — the drawer scrolls there. */
  field: 'instructions' | 'objective' | 'variables' | 'examples' | 'output' | 'tone' | 'goals' | 'constraints';
  message: string;
}

/** A JSON Schema text problem, or null when it parses as an object. */
export function jsonSchemaError(schema: string): string | null {
  if (!schema.trim()) return null;
  try {
    const parsed = JSON.parse(schema) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'The schema must be a JSON object.';
    return null;
  } catch (e) {
    return `The schema isn’t valid JSON: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const duplicates = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return true;
    seen.add(k);
    return false;
  });
};

/**
 * Problems and suggestions for a prompt: undeclared or unused variables,
 * conflicting format/tone instructions, an invalid output schema, empty
 * examples, and length. `knownRoots` are extra variable roots that exist at
 * run time (other steps' ids on the canvas).
 */
export function lintAgentPrompt(
  instructions: string,
  settings: AgentPromptSettings,
  knownRoots: readonly string[] = [],
): PromptLintIssue[] {
  const issues: PromptLintIssue[] = [];
  const text = instructions || '';
  const lower = text.toLowerCase();

  if (!text.trim() && !settings.objective.trim()) {
    issues.push({ level: 'warning', field: 'instructions', message: 'No instructions or objective: the agent only knows its name and role.' });
  }

  const composedRefs = promptVariableRefs(composeAgentPrompt(text, settings));
  const declared = new Set(settings.variables.map((v) => v.name));
  const roots = new Set([...RUNTIME_VARIABLE_ROOTS, ...knownRoots]);
  for (const ref of composedRefs) {
    if (declared.has(ref) || roots.has(ref.split('.')[0])) continue;
    issues.push({ level: 'warning', field: 'variables', message: `{{${ref}}} isn’t declared and no step provides it — add it under Variables with a default.` });
  }
  for (const v of settings.variables) {
    if (!composedRefs.includes(v.name)) {
      issues.push({ level: 'info', field: 'variables', message: `{{${v.name}}} is declared but the prompt never uses it.` });
    } else if (v.required && !v.defaultValue && !roots.has(v.name.split('.')[0])) {
      issues.push({ level: 'info', field: 'variables', message: `{{${v.name}}} is required and has no default, so each run must supply it.` });
    }
  }
  for (const name of duplicates(settings.variables.map((v) => v.name))) {
    issues.push({ level: 'error', field: 'variables', message: `{{${name}}} is declared twice.` });
  }

  const schemaProblem = settings.output.format === 'json' ? jsonSchemaError(settings.output.schema) : null;
  if (schemaProblem) issues.push({ level: 'error', field: 'output', message: schemaProblem });
  if (settings.output.format === 'json' && /\bmarkdown\b/.test(lower)) {
    issues.push({ level: 'warning', field: 'output', message: 'Output is set to JSON, but the instructions ask for Markdown.' });
  }
  if (settings.output.format === 'text' && /\b(markdown|bullet points?|tables?)\b/.test(lower)) {
    issues.push({ level: 'warning', field: 'output', message: 'Output is plain text, but the instructions ask for formatting.' });
  }
  if (settings.tone === 'concise' && /\b(in detail|detailed|thorough|in depth|elaborate)\b/.test(lower)) {
    issues.push({ level: 'warning', field: 'tone', message: 'Tone is Concise, but the instructions ask for detail.' });
  }

  for (const g of duplicates(settings.goals)) issues.push({ level: 'info', field: 'goals', message: `Goal listed twice: “${g}”.` });
  for (const c of duplicates(settings.constraints)) issues.push({ level: 'info', field: 'constraints', message: `Constraint listed twice: “${c}”.` });

  settings.examples.forEach((e, i) => {
    if (e.enabled && (!e.input.trim() || !e.output.trim())) {
      issues.push({ level: 'warning', field: 'examples', message: `Example ${i + 1} needs both an input and a reply.` });
    }
  });

  const tokens = estimateTokens(composeAgentPrompt(text, settings));
  if (tokens > 8_000) {
    issues.push({ level: 'warning', field: 'instructions', message: `The prompt is about ${tokens.toLocaleString()} tokens — long prompts cost more on every turn and leave less room for context.` });
  }
  if (text.trim() && text.trim().length < 40 && !settings.objective.trim()) {
    issues.push({ level: 'info', field: 'instructions', message: 'Very short instructions — say who the agent helps, what it should do and what a good answer looks like.' });
  }
  return issues;
}

/* ------------------------------------------------------------- knowledge -- */

export type KnowledgeSearchMode = 'SEMANTIC' | 'KEYWORD' | 'HYBRID';

export interface KnowledgeBindingSettings {
  knowledgeBaseId: string;
  topK: number;
  /** Unset = the platform's default (semantic, falling back to keyword). */
  mode?: KnowledgeSearchMode;
  /** Passages scoring below this (0–1) are dropped. */
  minScore?: number;
}

/** A knowledge card's config (`KB_SEARCH`, `VECTOR_SEARCH`, …) as a binding, or null without a base. */
export function readKnowledgeBinding(cfg: unknown): KnowledgeBindingSettings | null {
  const c = obj(cfg);
  const id = str(c['knowledgeBaseId']).trim();
  if (!id) return null;
  const topK = Number(c['topK']);
  const min = Number(c['minScore']);
  const mode = c['mode'];
  return {
    knowledgeBaseId: id,
    topK: Number.isFinite(topK) ? Math.min(Math.max(Math.round(topK), 1), 20) : 5,
    ...(mode === 'SEMANTIC' || mode === 'KEYWORD' || mode === 'HYBRID' ? { mode } : {}),
    ...(Number.isFinite(min) && min > 0 ? { minScore: Math.min(min, 1) } : {}),
  };
}

/* ----------------------------------------------------------------- tools -- */

/** Per-tool permission a canvas may set. Only ever stricter than the agent's own policy. */
export type CanvasToolPolicy = 'ask_user' | 'blocked';

/** `config.toolPolicies`, keeping only the values a canvas is allowed to set. */
export function readCanvasToolPolicies(raw: unknown): Record<string, CanvasToolPolicy> {
  const out: Record<string, CanvasToolPolicy> = {};
  for (const [tool, policy] of Object.entries(obj(raw))) {
    if (tool.trim() && (policy === 'ask_user' || policy === 'blocked')) out[tool.trim()] = policy;
  }
  return out;
}

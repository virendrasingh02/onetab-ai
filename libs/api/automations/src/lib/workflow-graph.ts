/**
 * How a stored workflow graph is read before it runs.
 *
 * Three authors write `AutomationWorkflow.nodesJson`, each in its own shape:
 *  - the workflow canvas keeps a step's settings flat on the React Flow
 *    `data` payload (`data.prompt`, `data.url`, `data.agentId`, …) beside
 *    UI-only keys (`label`, `subtitle`, `disabled`);
 *  - graphs imported from the former Agent Studio nest them in
 *    `data.config`;
 *  - API callers send `config` directly.
 *
 * The engine only ever read `config`, so every canvas-built workflow ran with
 * its settings silently empty — an LLM step ignored its prompt, an HTTP step
 * had no URL, a condition had nothing to compare. `normalizeWorkflowNode`
 * folds all three into one `config`.
 */

export interface RawWorkflowNode {
  id: string;
  type?: string;
  label?: string;
  config?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label?: string;
  config: Record<string, unknown>;
  /** The builder's React Flow payload; `data.disabled` switches a node off. */
  data?: Record<string, unknown>;
}

/** Keys on `data` that describe how the card looks, not how the step runs. */
const UI_ONLY_KEYS = new Set(['label', 'subtitle', 'type', 'disabled', 'config', 'icon']);

/** React Flow component names older canvases stored in `node.type`. */
const LEGACY_COMPONENT_TYPES = new Set([
  'triggerNode',
  'conditionNode',
  'aiActionNode',
  'apiActionNode',
]);

export function normalizeWorkflowNode(raw: RawWorkflowNode): WorkflowNode {
  const data = (raw.data ?? {}) as Record<string, unknown>;
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!UI_ONLY_KEYS.has(key)) flat[key] = value;
  }
  const nested =
    data['config'] && typeof data['config'] === 'object'
      ? (data['config'] as Record<string, unknown>)
      : {};

  const dataType = typeof data['type'] === 'string' ? (data['type'] as string) : '';
  const nodeType = raw.type ?? '';
  const type =
    dataType && (!nodeType || LEGACY_COMPONENT_TYPES.has(nodeType)) ? dataType : nodeType || dataType;

  return {
    id: raw.id,
    type: type.toUpperCase(),
    label: raw.label ?? (typeof data['label'] === 'string' ? (data['label'] as string) : undefined),
    // Most specific wins: explicit `config`, then `data.config`, then flat data.
    config: { ...flat, ...nested, ...(raw.config ?? {}) },
    data,
  };
}

export function normalizeWorkflowNodes(raw: unknown): WorkflowNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (n): n is RawWorkflowNode =>
        !!n && typeof n === 'object' && typeof (n as RawWorkflowNode).id === 'string',
    )
    .map(normalizeWorkflowNode);
}

/* ------------------------------------------------------------ conditions ---- */

export type ConditionOperator =
  | 'exists'
  | 'notExists'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains';

export interface ConditionSpec {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

const OPERATOR_TOKENS: Array<[string, ConditionOperator]> = [
  ['===', 'eq'],
  ['!==', 'ne'],
  ['==', 'eq'],
  ['!=', 'ne'],
  ['>=', 'gte'],
  ['<=', 'lte'],
  ['>', 'gt'],
  ['<', 'lt'],
];

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(['"`])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2]! : trimmed;
}

/**
 * Parses the canvas's free-text condition (`input.status == "done"`,
 * `score >= 0.8`, `payload.email contains "@acme"`, `exists input.userId`,
 * or a bare path meaning "exists") into a structured spec. Deliberately a
 * tiny grammar, never `eval` — the expression is member-authored.
 * Returns `null` when the text is not understood.
 */
export function parseConditionExpression(expression: string): ConditionSpec | null {
  const text = expression.trim().replace(/^\{\{\s*|\s*\}\}$/g, '');
  if (!text) return null;
  const path = /^[A-Za-z_$][\w$]*(?:\.[\w$]+|\[\d+\])*$/;

  const unary = /^(exists|notExists|!)\s*\(?\s*([^()\s]+)\s*\)?$/.exec(text);
  if (unary && path.test(unary[2]!)) {
    return { field: unary[2]!, operator: unary[1] === 'exists' ? 'exists' : 'notExists' };
  }

  const contains = /^(.+?)\s+contains\s+(.+)$/i.exec(text);
  if (contains && path.test(contains[1]!.trim())) {
    return { field: contains[1]!.trim(), operator: 'contains', value: unquote(contains[2]!) };
  }

  for (const [token, operator] of OPERATOR_TOKENS) {
    const index = text.indexOf(token);
    if (index <= 0) continue;
    const field = text.slice(0, index).trim();
    if (!path.test(field)) return null;
    return { field, operator, value: unquote(text.slice(index + token.length)) };
  }

  return path.test(text) ? { field: text, operator: 'exists' } : null;
}

export function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      payload,
    );
}

/** The structured spec a node's config describes, from fields or free text. */
export function conditionSpecFrom(cfg: Record<string, unknown>): ConditionSpec | null {
  if (typeof cfg['field'] === 'string' && cfg['field'].trim()) {
    return {
      field: cfg['field'].trim(),
      operator: (String(cfg['operator'] ?? 'exists') as ConditionOperator) || 'exists',
      value: cfg['value'],
    };
  }
  if (typeof cfg['expression'] === 'string') {
    return parseConditionExpression(cfg['expression']);
  }
  return null;
}

export function evaluateCondition(
  spec: ConditionSpec | null,
  payload: Record<string, unknown>,
): boolean {
  if (!spec) return false;
  const actual = readPath(payload, spec.field);
  const expected = spec.value;
  const asNumber = (v: unknown) => (typeof v === 'number' ? v : Number(String(v)));

  switch (spec.operator) {
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'notExists':
      return actual === undefined || actual === null || actual === '';
    case 'eq':
      return String(actual) === String(expected);
    case 'ne':
      return String(actual) !== String(expected);
    case 'contains':
      return Array.isArray(actual)
        ? actual.map(String).includes(String(expected))
        : String(actual ?? '').includes(String(expected ?? ''));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = asNumber(actual);
      const b = asNumber(expected);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (spec.operator === 'gt') return a > b;
      if (spec.operator === 'gte') return a >= b;
      if (spec.operator === 'lt') return a < b;
      return a <= b;
    }
    default:
      return false;
  }
}

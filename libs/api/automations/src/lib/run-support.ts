import {
  AGENT_SCOPES,
  PLATFORM_TOOLS,
  describeAgentScope,
  scopeForTool,
  type AgentProfile,
  type AgentScope,
} from '@org/types';
import { zonedParts } from '@org/utils';

/**
 * Pieces of a workflow run that are pure logic — what a failure means, how
 * long to wait before retrying, what a run's context starts with, and whether
 * a step is inside the permissions the agent was granted. Kept out of
 * `WorkflowEngineService` so they can be tested without a database.
 */

/* ------------------------------------------------------------ failures -- */

export type StepErrorCode =
  | 'MISSING_CONNECTION'
  | 'CONNECTION_EXPIRED'
  | 'MISSING_PERMISSION'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'MODEL_FAILED'
  | 'CREDIT_LIMIT'
  | 'TOOL_FAILED';

export interface ClassifiedError {
  code: StepErrorCode;
  /** Whether trying again could succeed without anyone changing anything. */
  retryable: boolean;
  /** What a person can do about it. */
  hint: string;
}

const RULES: Array<[RegExp, ClassifiedError]> = [
  [/doesn[’']t have permission|MISSING_PERMISSION|not granted/i, { code: 'MISSING_PERMISSION', retryable: false, hint: 'Grant the permission in the agent’s Permissions, then run it again.' }],
  [/expired|reconnect|invalid_grant|unauthori[sz]ed|\b401\b|revoked/i, { code: 'CONNECTION_EXPIRED', retryable: false, hint: 'Reconnect the app in Integrations to continue.' }],
  [/isn[’']t connected|not connected|no .*connection|connect .* in integrations/i, { code: 'MISSING_CONNECTION', retryable: false, hint: 'Connect the app in Integrations, then run the agent again.' }],
  [/\b429\b|rate.?limit|too many requests|overloaded|at capacity|temporarily unavailable/i, { code: 'RATE_LIMITED', retryable: true, hint: 'The service is rate-limiting requests. The step is retried with a longer wait.' }],
  [/timed out|timeout|ETIMEDOUT|ECONNRESET|socket hang up|ENOTFOUND|EAI_AGAIN|fetch failed|\b50[234]\b/i, { code: 'TIMEOUT', retryable: true, hint: 'A service did not answer in time. Retrying usually helps.' }],
  [/CREDIT_LIMIT|credit balance/i, { code: 'CREDIT_LIMIT', retryable: false, hint: 'Top up AI credits in Billing, then run it again.' }],
  [/private or reserved|aren[’']t supported|not supported|not allowed/i, { code: 'INVALID_INPUT', retryable: false, hint: 'This step asks for something the platform does not allow. Change the step’s settings.' }],
  [/not valid JSON|is required|needs a|give a|no tool configured|not a registered|invalid/i, { code: 'INVALID_INPUT', retryable: false, hint: 'Fix the step’s settings in the plan or on the canvas.' }],
  [/does not exist|no (doc|project|task|meeting)|not found/i, { code: 'NOT_FOUND', retryable: false, hint: 'Check the item the step points at still exists and you can see it.' }],
  [/model|provider|completion|llm|api key|credential/i, { code: 'MODEL_FAILED', retryable: true, hint: 'The AI model call failed. Check Settings → AI providers if it keeps happening.' }],
];

export function classifyStepError(message: string): ClassifiedError {
  for (const [pattern, result] of RULES) if (pattern.test(message)) return result;
  return { code: 'TOOL_FAILED', retryable: true, hint: 'Retry the run, or restart from this step once the cause is fixed.' };
}

/** Exponential backoff with jitter; rate limits wait longer. */
export function backoffMs(attempt: number, code: StepErrorCode, random = Math.random): number {
  const base = code === 'RATE_LIMITED' ? 4_000 : 750;
  const cap = code === 'RATE_LIMITED' ? 30_000 : 8_000;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), cap) + Math.floor(random() * 250);
}

/* ------------------------------------------------------------- context -- */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `{{now.*}}` — the moment a run starts, in the agent's time zone. */
export function nowContext(at: Date, timeZone: string) {
  const p = zonedParts(at, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    iso: at.toISOString(),
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    weekday: WEEKDAYS[p.weekday] ?? '',
    long: `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month - 1]} ${p.year}`,
    timezone: timeZone,
  };
}

/** A stored profile, if the value looks like one. */
export function readAgentProfile(value: unknown): AgentProfile | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as Partial<AgentProfile>;
  return profile.version === 1 && Array.isArray(profile.steps) ? (profile as AgentProfile) : null;
}

/** `{{params.*}}` from the profile's filled-in params. */
export function paramsContext(profile: AgentProfile | null): Record<string, string> {
  const params: Record<string, string> = {};
  for (const param of profile?.params ?? []) params[param.key] = param.value ?? '';
  return params;
}

/* --------------------------------------------------------- permissions -- */

/** Node types that act on something outside the run, and the scope each needs. */
export function scopeForNode(
  nodeType: string,
  config: Record<string, unknown>,
  appAccess?: 'read' | 'write' | 'destructive',
): AgentScope | null {
  switch (nodeType) {
    case 'TOOL':
    case 'APP': {
      const tool = String(config['toolName'] || config['tool'] || '').trim();
      return tool ? scopeForTool(tool, appAccess) : null;
    }
    case 'MCP':
    case 'MCP_TOOL':
      return 'app:mcp:write';
    case 'AGENT':
    case 'AI_COWORKER':
      return 'agents:run';
    case 'HTTP_REQUEST':
    case 'API_CALL':
    case 'API':
    case 'WEBHOOK':
      return 'app:http:write';
    case 'FIRECRAWL_SEARCH':
    case 'FIRECRAWL_SCRAPE':
    case 'FIRECRAWL_CRAWL':
    case 'FIRECRAWL_EXTRACT':
      return 'web:read';
    default:
      return null;
  }
}

export function missingPermissionMessage(scope: AgentScope): string {
  const info = describeAgentScope(scope);
  return `This agent doesn’t have permission to “${info.label}” (${scope}). Grant it in the agent’s Permissions to run this step.`;
}

/** Whether a scope only reads. Unknown scopes count as writes. */
export function isReadScope(scope: AgentScope | null): boolean {
  if (!scope) return true;
  if (AGENT_SCOPES[scope]) return AGENT_SCOPES[scope]!.access === 'read';
  return /:read$/.test(scope);
}

/** Built-in tools that change nothing — safe to run for real in a test run. */
export function isReadOnlyTool(tool: string): boolean {
  const meta = PLATFORM_TOOLS[tool];
  return meta ? isReadScope(meta.scope) : false;
}

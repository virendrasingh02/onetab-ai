import type { AgentRuntimeConfig } from './agent-config.js';

/**
 * What a workspace admin allows for a tool or a whole connected app:
 * `allow` leaves the agent's own autonomy rules in charge, `approval` makes
 * every call wait for a person, `disabled` removes it from every agent.
 */
export type WorkspaceToolMode = 'allow' | 'approval' | 'disabled';

export const WORKSPACE_TOOL_MODES: readonly WorkspaceToolMode[] = ['allow', 'approval', 'disabled'];

export interface WorkspaceToolPolicy {
  /** By connected app (upper-case provider key, e.g. `SLACK`). */
  connectors: Record<string, WorkspaceToolMode>;
  /** By tool name (built-in, MCP, or `<provider>_<action>`). Wins over `connectors`. */
  tools: Record<string, WorkspaceToolMode>;
}

export const EMPTY_WORKSPACE_TOOL_POLICY: Readonly<WorkspaceToolPolicy> = { connectors: {}, tools: {} };

const MAX_POLICY_ENTRIES = 500;

const isMode = (value: unknown): value is WorkspaceToolMode =>
  value === 'allow' || value === 'approval' || value === 'disabled';

/** Keeps only well-formed, non-default entries; `allow` is the absence of a rule. */
function cleanEntries(raw: unknown, normalizeKey: (key: string) => string): Record<string, WorkspaceToolMode> {
  const out: Record<string, WorkspaceToolMode> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = normalizeKey(key.trim());
    if (!name || name.length > 200 || !isMode(value) || value === 'allow') continue;
    out[name] = value;
    if (Object.keys(out).length >= MAX_POLICY_ENTRIES) break;
  }
  return out;
}

/** A stored policy, tolerating anything malformed in the JSON. */
export function resolveWorkspaceToolPolicy(raw: unknown): WorkspaceToolPolicy {
  const source = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof WorkspaceToolPolicy, unknown>>) : {};
  return {
    connectors: cleanEntries(source.connectors, (key) => key.toUpperCase()),
    tools: cleanEntries(source.tools, (key) => key),
  };
}

/** The rule that applies to one tool: its own, else its app's, else `allow`. */
export function workspaceToolMode(
  policy: WorkspaceToolPolicy | undefined,
  toolName: string,
  connector?: string,
): WorkspaceToolMode {
  if (!policy) return 'allow';
  const own = policy.tools[toolName];
  if (own) return own;
  if (connector) return policy.connectors[connector.toUpperCase()] ?? 'allow';
  return 'allow';
}

export interface PolicyTool {
  name: string;
  /** Upper-case provider key for connector tools. */
  connector?: string;
}

/**
 * Folds the workspace policy into an agent's runtime so the one gate every
 * tool source already answers to (`agentToolGate`) enforces it: a disabled
 * tool becomes `blocked`, an approval-only tool becomes `ask_user`. The
 * workspace rule overrides the agent's own permissive rule, never a stricter
 * one. `disabled` lists the tools that should not even be offered.
 */
export function applyWorkspaceToolPolicy(
  runtime: AgentRuntimeConfig,
  policy: WorkspaceToolPolicy | undefined,
  tools: readonly PolicyTool[],
): { runtime: AgentRuntimeConfig; disabled: Set<string> } {
  const disabled = new Set<string>();
  if (!policy || (!Object.keys(policy.tools).length && !Object.keys(policy.connectors).length)) {
    return { runtime, disabled };
  }
  const policies = { ...(runtime.rules?.policies ?? {}) };
  for (const tool of tools) {
    const mode = workspaceToolMode(policy, tool.name, tool.connector);
    if (mode === 'disabled') {
      disabled.add(tool.name);
      policies[tool.name] = 'blocked';
    } else if (mode === 'approval' && policies[tool.name] !== 'blocked') {
      policies[tool.name] = 'ask_user';
    }
  }
  return { runtime: { ...runtime, rules: { ...runtime.rules, policies } }, disabled };
}

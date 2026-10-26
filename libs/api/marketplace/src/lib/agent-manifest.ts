import { z } from 'zod';

/**
 * Agent package manifest — validation and permission derivation.
 *
 * Pure functions only (no I/O) so every install decision is unit-testable. An
 * "agent package" is data, never code: a blueprint (prompt, model, tool ids,
 * canvas graph) plus the manifest below. Nothing here, or in the install flow,
 * executes package-supplied code in the API process; code/HTTP *nodes* inside a
 * graph run in the workflow engine's sandbox, and are surfaced as sensitive
 * permissions that an approver must accept first.
 */

export const AGENT_MANIFEST_SCHEMA_VERSION = 1;
/** Platform version agents declare compatibility against (`minPlatformVersion`). */
export const AGENT_PLATFORM_VERSION = '1.0.0';

const MAX_PROMPT_CHARS = 50_000;
const MAX_GRAPH_BYTES = 1_000_000;
const MAX_TOOLS = 64;
const MAX_CONFIG_FIELDS = 24;
const MAX_EXTERNAL_SERVICES = 16;

const TOOL_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const CONFIG_KEY = /^[a-z][a-zA-Z0-9_]{0,39}$/;

/** Tool ids whose name implies they act outside the workspace or destroy data. */
const SENSITIVE_TOOL = /(delete|remove|destroy|drop|exec|shell|script|code|eval|http|fetch|request|webhook|email|send_email|payment|transfer|publish)/i;
/** Graph node types that execute logic or reach the network. */
const SENSITIVE_NODE = new Set([
  'code', 'script', 'function', 'shell', 'http', 'http_request', 'httprequest', 'webhook', 'fetch',
]);

export type PermissionKind = 'tool' | 'network' | 'data' | 'code' | 'connector';

export interface PermissionRequest {
  /** Stable id — what an approver grants and what an update is diffed on. */
  id: string;
  kind: PermissionKind;
  label: string;
  description: string;
  /** Sensitive permissions need an explicit approval and cannot be implied. */
  sensitive: boolean;
}

export type ConfigFieldType = 'text' | 'secret' | 'url' | 'select' | 'boolean';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required: boolean;
  description?: string;
  options?: string[];
}

export interface AgentInstallManifest {
  schemaVersion: number;
  tools: string[];
  externalServices: string[];
  connectors: string[];
  configFields: ConfigField[];
  requiresAdmin: boolean;
  minPlatformVersion: string;
  platforms: string[];
  /** Node types found in the canvas graph (informational + permission input). */
  graphNodeTypes: string[];
}

export interface ManifestIssue {
  code: 'INVALID_MANIFEST' | 'INVALID_BLUEPRINT' | 'INVALID_URL' | 'INCOMPATIBLE';
  message: string;
}

export type ManifestResult =
  | { ok: true; manifest: AgentInstallManifest; permissions: PermissionRequest[] }
  | { ok: false; issues: ManifestIssue[] };

const configFieldSchema = z.object({
  key: z.string().regex(CONFIG_KEY, 'must start with a letter; letters, digits and _ only'),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'secret', 'url', 'select', 'boolean']),
  required: z.boolean().default(false),
  description: z.string().max(300).optional(),
  options: z.array(z.string().max(80)).max(50).optional(),
});

const rawManifestSchema = z
  .object({
    schemaVersion: z.number().int().min(1).max(AGENT_MANIFEST_SCHEMA_VERSION).default(1),
    capabilities: z.array(z.string()).max(MAX_TOOLS).default([]),
    security: z
      .object({ externalServices: z.array(z.string().max(300)).max(MAX_EXTERNAL_SERVICES).default([]) })
      .partial()
      .default({}),
    dependencies: z
      .object({ connectors: z.array(z.string().max(80)).max(16).default([]) })
      .partial()
      .default({}),
    configSchema: z.array(configFieldSchema).max(MAX_CONFIG_FIELDS).default([]),
    requiresAdmin: z.boolean().default(false),
    minPlatformVersion: z.string().regex(SEMVER).default('1.0.0'),
    compatibility: z.object({ platforms: z.array(z.string().max(30)).max(8).default([]) }).partial().default({}),
  })
  .passthrough();

const blueprintSchema = z
  .object({
    name: z.string().min(1).max(120),
    systemPrompt: z.string().max(MAX_PROMPT_CHARS),
    systemInstructions: z.string().max(MAX_PROMPT_CHARS).optional().nullable(),
    provider: z.string().min(1).max(60),
    model: z.string().min(1).max(120),
    tools: z.union([z.string(), z.array(z.string())]).optional(),
    graphJson: z.string().nullable().optional(),
  })
  .passthrough();

export function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Rejects non-https, credentialed, loopback, link-local and private-range targets. */
export function validateExternalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return `'${raw}' is not a valid URL.`;
  }
  if (url.protocol !== 'https:') return `'${url.hostname}' must use https.`;
  if (url.username || url.password) return `'${url.hostname}' must not embed credentials.`;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal'
  ) {
    return `'${host}' points at an internal host.`;
  }
  if (isPrivateIp(host)) return `'${host}' is a private or reserved address.`;
  if (!host.includes('.') && !host.includes(':')) return `'${host}' is not a public hostname.`;
  return null;
}

function isPrivateIp(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (host.includes(':')) {
    return host === '::1' || host === '::' || /^f[cd]/.test(host) || host.startsWith('fe80') || host.startsWith('::ffff:');
  }
  return false;
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isSensitiveTool(tool: string): boolean {
  return SENSITIVE_TOOL.test(tool);
}

function toolList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : parseJsonSafe<unknown[]>(typeof raw === 'string' ? raw : null, []);
  return list.filter((t): t is string => typeof t === 'string');
}

function graphNodeTypes(graphJson: string | null | undefined): string[] {
  const graph = parseJsonSafe<{ nodes?: Array<{ type?: string; data?: { type?: string } }> }>(graphJson, {});
  const types = new Set<string>();
  for (const node of Array.isArray(graph.nodes) ? graph.nodes : []) {
    const type = String(node?.data?.type ?? node?.type ?? '').toLowerCase();
    if (type) types.add(type);
  }
  return [...types];
}

/**
 * Validates a listing's manifest + blueprint and derives what installing it
 * asks for. Never throws — callers turn `issues` into a 400 with the codes.
 */
export function evaluateAgentPackage(manifestJson: string, payloadJson: string): ManifestResult {
  const issues: ManifestIssue[] = [];

  const rawManifest = parseJsonSafe<unknown>(manifestJson, null);
  const parsedManifest = rawManifestSchema.safeParse(rawManifest ?? {});
  if (!parsedManifest.success) {
    for (const issue of parsedManifest.error.issues) {
      issues.push({ code: 'INVALID_MANIFEST', message: `manifest.${issue.path.join('.')}: ${issue.message}` });
    }
  }

  const payload = parseJsonSafe<{ blueprint?: unknown }>(payloadJson, {});
  // Seeded listings carry no blueprint — they install as a plain prompt agent.
  const blueprint = payload.blueprint === undefined ? undefined : blueprintSchema.safeParse(payload.blueprint);
  if (blueprint && !blueprint.success) {
    for (const issue of blueprint.error.issues) {
      issues.push({ code: 'INVALID_BLUEPRINT', message: `blueprint.${issue.path.join('.')}: ${issue.message}` });
    }
  }
  if (blueprint?.success && blueprint.data.graphJson) {
    if (Buffer.byteLength(blueprint.data.graphJson) > MAX_GRAPH_BYTES) {
      issues.push({ code: 'INVALID_BLUEPRINT', message: 'blueprint.graphJson is larger than 1 MB.' });
    } else if (parseJsonSafe<unknown>(blueprint.data.graphJson, null) === null) {
      issues.push({ code: 'INVALID_BLUEPRINT', message: 'blueprint.graphJson is not valid JSON.' });
    }
  }

  if (!parsedManifest.success) return { ok: false, issues };
  const m = parsedManifest.data;

  const tools = [...new Set([...m.capabilities, ...(blueprint?.success ? toolList(blueprint.data.tools) : [])])];
  for (const tool of tools) {
    if (!TOOL_ID.test(tool)) issues.push({ code: 'INVALID_MANIFEST', message: `Tool id '${tool.slice(0, 40)}' is not allowed.` });
  }
  if (tools.length > MAX_TOOLS) issues.push({ code: 'INVALID_MANIFEST', message: `At most ${MAX_TOOLS} tools are allowed.` });

  const externalServices = m.security.externalServices ?? [];
  for (const service of externalServices) {
    const problem = validateExternalUrl(service);
    if (problem) issues.push({ code: 'INVALID_URL', message: problem });
  }

  const keys = m.configSchema.map((f) => f.key);
  if (new Set(keys).size !== keys.length) {
    issues.push({ code: 'INVALID_MANIFEST', message: 'configSchema has duplicate keys.' });
  }
  for (const field of m.configSchema) {
    if (field.type === 'select' && !field.options?.length) {
      issues.push({ code: 'INVALID_MANIFEST', message: `configSchema.${field.key}: select needs options.` });
    }
  }

  if (compareSemver(m.minPlatformVersion, AGENT_PLATFORM_VERSION) > 0) {
    issues.push({
      code: 'INCOMPATIBLE',
      message: `Needs platform ${m.minPlatformVersion} or newer (this deployment is ${AGENT_PLATFORM_VERSION}).`,
    });
  }

  if (issues.length) return { ok: false, issues };

  const nodeTypes = blueprint?.success ? graphNodeTypes(blueprint.data.graphJson) : [];
  const manifest: AgentInstallManifest = {
    schemaVersion: m.schemaVersion,
    tools,
    externalServices,
    connectors: m.dependencies.connectors ?? [],
    configFields: m.configSchema,
    requiresAdmin: m.requiresAdmin,
    minPlatformVersion: m.minPlatformVersion,
    platforms: m.compatibility.platforms ?? [],
    graphNodeTypes: nodeTypes,
  };
  return { ok: true, manifest, permissions: derivePermissions(manifest) };
}

export function derivePermissions(manifest: AgentInstallManifest): PermissionRequest[] {
  const out: PermissionRequest[] = [
    {
      id: 'data:workspace',
      kind: 'data',
      label: 'Read workspace context',
      description: 'Uses the messages and records the person talking to it can already see.',
      sensitive: false,
    },
  ];
  for (const tool of manifest.tools) {
    const sensitive = isSensitiveTool(tool);
    out.push({
      id: `tool:${tool}`,
      kind: 'tool',
      label: `Tool: ${tool}`,
      description: sensitive
        ? 'Can change data or reach outside the workspace.'
        : 'Can use this tool on behalf of the person asking.',
      sensitive,
    });
  }
  for (const service of manifest.externalServices) {
    const host = new URL(service).hostname;
    out.push({
      id: `network:${host}`,
      kind: 'network',
      label: `Connects to ${host}`,
      description: 'Sends data to this external service.',
      sensitive: true,
    });
  }
  for (const slug of manifest.connectors) {
    out.push({
      id: `connector:${slug}`,
      kind: 'connector',
      label: `Uses the ${slug} connection`,
      description: 'Acts through a connected workspace integration.',
      sensitive: true,
    });
  }
  const executes = manifest.graphNodeTypes.filter((t) => SENSITIVE_NODE.has(t));
  if (executes.length) {
    out.push({
      id: 'code:graph-nodes',
      kind: 'code',
      label: `Runs ${executes.join(', ')} steps`,
      description: 'Workflow steps that execute logic or make network calls (sandboxed by the workflow engine).',
      sensitive: true,
    });
  }
  return out;
}

/** Permission ids in `next` that `granted` does not cover — what an update would add. */
export function newPermissions(granted: string[], next: PermissionRequest[]): PermissionRequest[] {
  const have = new Set(granted);
  return next.filter((p) => !have.has(p.id));
}

export interface ConfigValidation {
  errors: Record<string, string>;
  plain: Record<string, string | boolean>;
  secrets: Record<string, string>;
}

/** Checks submitted values against the manifest's fields; unknown keys are rejected. */
export function validateConfig(fields: ConfigField[], values: Record<string, unknown>): ConfigValidation {
  const errors: Record<string, string> = {};
  const plain: Record<string, string | boolean> = {};
  const secrets: Record<string, string> = {};
  const known = new Set(fields.map((f) => f.key));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) errors[key] = 'Unknown setting.';
  }
  for (const field of fields) {
    const value = values[field.key];
    const empty = value === undefined || value === null || value === '';
    if (empty) {
      if (field.required) errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') errors[field.key] = 'Must be true or false.';
      else plain[field.key] = value;
      continue;
    }
    if (typeof value !== 'string' || value.length > 4000) {
      errors[field.key] = 'Must be text under 4000 characters.';
      continue;
    }
    if (field.type === 'select' && !field.options?.includes(value)) {
      errors[field.key] = `Must be one of: ${field.options?.join(', ')}.`;
    } else if (field.type === 'url') {
      const problem = validateExternalUrl(value);
      if (problem) errors[field.key] = problem;
      else plain[field.key] = value;
    } else if (field.type === 'secret') {
      secrets[field.key] = value;
    } else {
      plain[field.key] = value;
    }
  }
  return { errors, plain, secrets };
}

export interface InstallAccess {
  mode: 'EVERYONE' | 'RESTRICTED';
  userIds: string[];
  roles: string[];
}

export function parseAccess(raw: string | null | undefined): InstallAccess {
  const a = parseJsonSafe<Partial<InstallAccess>>(raw, {});
  return {
    mode: a.mode === 'RESTRICTED' ? 'RESTRICTED' : 'EVERYONE',
    userIds: Array.isArray(a.userIds) ? a.userIds.filter((v) => typeof v === 'string') : [],
    roles: Array.isArray(a.roles) ? a.roles.filter((v) => typeof v === 'string') : [],
  };
}

/** Whether `user` may use an installed agent. Admins managing the workspace always may. */
export function canUseInstall(
  access: InstallAccess,
  user: { id: string; role?: string; isManager?: boolean },
): boolean {
  if (access.mode === 'EVERYONE' || user.isManager) return true;
  return access.userIds.includes(user.id) || (user.role !== undefined && access.roles.includes(user.role));
}

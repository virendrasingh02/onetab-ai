/**
 * The connector platform: one generic Connector → Capability → Tool model that
 * every app integration feeds automatically.
 *
 * A provider adapter (`libs/api/integrations/src/lib/providers/*`) declares
 * its capabilities and actions once. Everything here derives from that one
 * declaration: the App Connectors center, the Studio's node adder, an agent's
 * tool list, the engine's `PROVIDER.action` steps and app-event triggers. No
 * connector is special-cased — a new adapter shows up everywhere with no
 * extra wiring.
 *
 * Pure and dependency-free so the API, the Studio and tests share it.
 */
import type { AppActionDefinition, IntegrationAuthType, IntegrationScopeType } from './integrations.js';
import type { IsoDateString } from './entities.js';
import type { CustomConnectorDefinition } from './custom-connector.js';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type ConnectorCategory =
  | 'communication'
  | 'email'
  | 'calendar'
  | 'productivity'
  | 'project_management'
  | 'crm'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'hr'
  | 'commerce'
  | 'content'
  | 'developer_tools'
  | 'customer_support'
  | 'storage'
  | 'database'
  | 'analytics'
  | 'security'
  | 'automation'
  | 'browser_web'
  | 'ai'
  | 'internal'
  | 'custom';

export const CONNECTOR_CATEGORIES: ReadonlyArray<{ id: ConnectorCategory; label: string }> = [
  { id: 'communication', label: 'Communication' },
  { id: 'email', label: 'Email' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'project_management', label: 'Project Management' },
  { id: 'crm', label: 'CRM' },
  { id: 'sales', label: 'Sales' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'finance', label: 'Finance' },
  { id: 'hr', label: 'HR & People' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'content', label: 'Content & CMS' },
  { id: 'developer_tools', label: 'Developer Tools' },
  { id: 'customer_support', label: 'Customer Support' },
  { id: 'storage', label: 'Storage' },
  { id: 'database', label: 'Database' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'security', label: 'Security' },
  { id: 'automation', label: 'Automation' },
  { id: 'browser_web', label: 'Browser / Web' },
  { id: 'ai', label: 'AI' },
  { id: 'internal', label: 'Internal Apps' },
  { id: 'custom', label: 'Custom Apps' },
];

const CATEGORY_IDS = new Set<string>(CONNECTOR_CATEGORIES.map((c) => c.id));

/** Keyword fallbacks for a provider's free-text category, most specific first. */
const CATEGORY_KEYWORDS: ReadonlyArray<[RegExp, ConnectorCategory]> = [
  [/\bmail|inbox/i, 'email'],
  [/calendar|schedul/i, 'calendar'],
  [/support|helpdesk|ticket/i, 'customer_support'],
  [/chat|messag|communicat/i, 'communication'],
  [/project|issue|task/i, 'project_management'],
  [/crm|customer relationship/i, 'crm'],
  [/sales/i, 'sales'],
  [/marketing/i, 'marketing'],
  [/financ|payment|billing|invoice|accounting/i, 'finance'],
  [/\bhr\b|human resources|people|payroll|employee/i, 'hr'],
  [/commerce|shop|store|order/i, 'commerce'],
  [/cms|content|blog|publish/i, 'content'],
  [/developer|engineering|code|repo/i, 'developer_tools'],
  [/storage|file|drive/i, 'storage'],
  [/database|sql/i, 'database'],
  [/analytic|metric/i, 'analytics'],
  [/security|identity|auth/i, 'security'],
  [/automation|workflow/i, 'automation'],
  [/browser|web|scrap|crawl/i, 'browser_web'],
  [/\bai\b|llm|model/i, 'ai'],
  [/internal/i, 'internal'],
  [/productiv|doc|note|wiki|sheet/i, 'productivity'],
];

/**
 * A provider's category: its own `connectorCategory` when it declares one,
 * else the first keyword match on its free-text category, else `custom`.
 */
export function normalizeConnectorCategory(declared: string | undefined, freeText: string | undefined): ConnectorCategory {
  if (declared && CATEGORY_IDS.has(declared)) return declared as ConnectorCategory;
  const text = freeText ?? '';
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return 'custom';
}

// ---------------------------------------------------------------------------
// Capabilities, triggers, tools
// ---------------------------------------------------------------------------

/** `query` reads, `action` changes something in the app, `trigger` starts an agent. */
export type ConnectorCapabilityKind = 'action' | 'query' | 'trigger';

/** What kind of work a connector lets an agent do — derived, never hand-picked. */
export type AgentCapabilityTag =
  | 'communication'
  | 'notification'
  | 'collaboration'
  | 'email'
  | 'scheduling'
  | 'knowledge'
  | 'files'
  | 'project_tracking'
  | 'engineering'
  | 'crm'
  | 'finance'
  | 'support'
  | 'research'
  | 'automation';

export const AGENT_CAPABILITY_LABELS: Record<AgentCapabilityTag, string> = {
  communication: 'Communication',
  notification: 'Notifications',
  collaboration: 'Collaboration',
  email: 'Email',
  scheduling: 'Scheduling',
  knowledge: 'Knowledge',
  files: 'Files',
  project_tracking: 'Project tracking',
  engineering: 'Engineering',
  crm: 'CRM',
  finance: 'Finance',
  support: 'Support',
  research: 'Research',
  automation: 'Automation',
};

/**
 * An event that starts an agent. Triggers are polled: the platform runs one of
 * the connector's own read actions on a schedule and fires once per item it
 * hasn't seen before. That works for every connector with a list/search
 * action, without per-app webhook subscriptions.
 */
export interface ConnectorTriggerDefinition {
  id: string;
  label: string;
  description: string;
  /**
   * `poll` (default): the platform runs `pollActionId` on a schedule.
   * `webhook`: the app pushes the event to the connector webhook endpoint
   * (verified and de-duplicated there), for apps that can't be polled.
   */
  delivery?: 'poll' | 'webhook';
  /** The read action whose results are watched for new items (poll triggers). */
  pollActionId?: string;
  /** Input passed to the poll action, merged under the trigger node's own. */
  defaultInput?: Record<string, unknown>;
  /** JSON Schema for what the person may narrow the trigger to (a channel, a query). */
  inputSchema?: Record<string, unknown>;
  /** Dotted path from the action's `data` to the item list (`messages`, `issues`). */
  itemsPath: string;
  /** Field on each item that identifies it (`id`, `ts`). */
  idField: string;
}

export interface ConnectorCredentialField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  help?: string;
  /** Optional fields may be left empty. */
  optional?: boolean;
}

export interface ConnectorCapability {
  id: string;
  kind: Exclude<ConnectorCapabilityKind, 'trigger'>;
  label: string;
  description: string;
  permissionLevel: AppActionDefinition['permissionLevel'];
  requiresConfirmation: boolean;
  inputSchema: Record<string, unknown>;
  /** JSON Schema of the `data` the action returns, when the adapter declares it. */
  outputSchema?: Record<string, unknown>;
  /** The function name the agent runtime offers the model. */
  toolName: string;
  /** The `PROVIDER.action` reference a workflow step runs. */
  actionRef: string;
}

export interface ConnectorTrigger extends ConnectorTriggerDefinition {
  kind: 'trigger';
  /** The `connector:<PROVIDER>:<trigger>` id a compiled workflow listens on. */
  eventType: string;
}

export interface ConnectorManifest {
  /** Upper-case provider key (`SLACK`), the id every API uses. */
  provider: string;
  /** Lower-case slug for URLs and icons (`slack`). */
  slug: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  authType: IntegrationAuthType;
  scopes: Array<{ scope: string; description: string; required?: boolean }>;
  /** What a non-OAuth connector asks for when connecting; the Studio renders the form from this. */
  credentialFields?: ConnectorCredentialField[];
  /** False when the server is missing this connector's OAuth app credentials. */
  serverConfigured: boolean;
  /** Why it can't be connected here, when it can't. */
  unavailableReason?: string;
  supports: { sync: boolean; webhooks: boolean; messaging: boolean; customEndpoints: boolean };
  capabilities: ConnectorCapability[];
  triggers: ConnectorTrigger[];
  agentCapabilities: AgentCapabilityTag[];
  counts: { actions: number; queries: number; triggers: number };
  /** True for a connector this workspace defined itself (editable, deletable). */
  custom?: boolean;
}

/** Lower-case, underscore-only — the runtime's function-name rules. */
export function connectorToolName(provider: string, actionId: string): string {
  return `${provider}_${actionId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/** `SLACK.send_message` — what an engine tool step names. */
export function connectorActionRef(provider: string, actionId: string): string {
  return `${provider.toUpperCase()}.${actionId}`;
}

export function parseConnectorActionRef(ref: string): { provider: string; actionId: string } | null {
  const dot = ref.indexOf('.');
  if (dot <= 0 || dot === ref.length - 1) return null;
  return { provider: ref.slice(0, dot).toUpperCase(), actionId: ref.slice(dot + 1) };
}

export function connectorTriggerEventType(provider: string, triggerId: string): string {
  return `connector:${provider.toUpperCase()}:${triggerId}`;
}

export function parseConnectorTriggerEventType(eventType: string): { provider: string; triggerId: string } | null {
  const match = /^connector:([A-Z0-9_]+):(.+)$/.exec(eventType);
  return match ? { provider: match[1], triggerId: match[2] } : null;
}

const CATEGORY_AGENT_CAPABILITIES: Partial<Record<ConnectorCategory, AgentCapabilityTag[]>> = {
  communication: ['communication', 'notification', 'collaboration'],
  email: ['email', 'communication', 'notification'],
  calendar: ['scheduling'],
  productivity: ['knowledge', 'files'],
  storage: ['files', 'knowledge'],
  project_management: ['project_tracking', 'collaboration'],
  developer_tools: ['engineering'],
  crm: ['crm'],
  sales: ['crm'],
  marketing: ['communication'],
  finance: ['finance'],
  hr: ['collaboration'],
  customer_support: ['support', 'communication'],
  database: ['knowledge'],
  analytics: ['research'],
  browser_web: ['research'],
};

/** What an agent can do with a connector: its category's tags, plus research when it can read and automation when it can act. */
export function deriveAgentCapabilities(
  category: ConnectorCategory,
  capabilities: ReadonlyArray<Pick<ConnectorCapability, 'kind'>>,
  triggers: ReadonlyArray<unknown> = [],
): AgentCapabilityTag[] {
  const tags = new Set<AgentCapabilityTag>(CATEGORY_AGENT_CAPABILITIES[category] ?? []);
  if (capabilities.some((c) => c.kind === 'query')) tags.add('research');
  if (capabilities.some((c) => c.kind === 'action') || triggers.length > 0) tags.add('automation');
  return [...tags];
}

export interface ConnectorManifestSource {
  provider: string;
  displayName: string;
  description: string;
  category: string;
  connectorCategory?: string;
  authType: IntegrationAuthType;
  supportsSync: boolean;
  supportsWebhooks: boolean;
  supportsMessaging: boolean;
  supportsCustomEndpoints: boolean;
  scopes?: Array<{ scope: string; description: string; required?: boolean }>;
  credentialFields?: ConnectorCredentialField[];
}

/** One provider's manifest, from what its adapter declares. */
export function buildConnectorManifest(
  caps: ConnectorManifestSource,
  actions: ReadonlyArray<AppActionDefinition>,
  triggerDefs: ReadonlyArray<ConnectorTriggerDefinition> = [],
  server: { configured: boolean; reason?: string } = { configured: true },
): ConnectorManifest {
  const provider = caps.provider.toUpperCase();
  const category = normalizeConnectorCategory(caps.connectorCategory, caps.category);
  const capabilities: ConnectorCapability[] = actions.map((a) => ({
    id: a.id,
    kind: a.permissionLevel === 'read' ? 'query' : 'action',
    label: a.label,
    description: a.description,
    permissionLevel: a.permissionLevel,
    requiresConfirmation: a.requiresConfirmation,
    inputSchema: a.inputSchema ?? { type: 'object', properties: {} },
    ...(a.outputSchema ? { outputSchema: a.outputSchema } : {}),
    toolName: connectorToolName(provider, a.id),
    actionRef: connectorActionRef(provider, a.id),
  }));
  const readIds = new Set(capabilities.filter((c) => c.kind === 'query').map((c) => c.id));
  // A trigger has to watch one of the connector's own reads, or it can't run.
  const triggers: ConnectorTrigger[] = triggerDefs
    .filter((t) => t.delivery === 'webhook' || (!!t.pollActionId && readIds.has(t.pollActionId)))
    .map((t) => ({ ...t, kind: 'trigger', eventType: connectorTriggerEventType(provider, t.id) }));
  return {
    provider,
    slug: provider.toLowerCase(),
    name: caps.displayName,
    description: caps.description,
    category,
    authType: caps.authType,
    scopes: caps.scopes ?? [],
    ...(caps.credentialFields?.length ? { credentialFields: caps.credentialFields } : {}),
    serverConfigured: server.configured,
    ...(server.configured ? {} : { unavailableReason: server.reason ?? `${caps.displayName} isn’t set up on this server yet.` }),
    supports: {
      sync: caps.supportsSync,
      webhooks: caps.supportsWebhooks,
      messaging: caps.supportsMessaging,
      customEndpoints: caps.supportsCustomEndpoints,
    },
    capabilities,
    triggers,
    agentCapabilities: deriveAgentCapabilities(category, capabilities, triggers),
    counts: {
      actions: capabilities.filter((c) => c.kind === 'action').length,
      queries: capabilities.filter((c) => c.kind === 'query').length,
      triggers: triggers.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Connections and usage
// ---------------------------------------------------------------------------

export type ConnectorStatus = 'connected' | 'needs_attention' | 'not_connected' | 'unavailable';

export interface ConnectorConnection {
  id: string;
  provider: string;
  scopeType: IntegrationScopeType;
  status: string;
  displayName: string | null;
  accountEmail: string | null;
  accountName: string | null;
  scopes: string[];
  /** The caller's own personal connection (not a workspace-wide one). */
  mine: boolean;
  /** Where the app should send events, for connectors with push triggers. */
  webhookUrl?: string | null;
  lastSyncAt: IsoDateString | null;
  lastErrorAt: IsoDateString | null;
  lastErrorMessage: string | null;
  createdAt: IsoDateString;
}

export interface ConnectorUsage {
  windowDays: number;
  calls: number;
  failures: number;
  avgDurationMs: number | null;
  lastUsedAt: IsoDateString | null;
  topAction: string | null;
}

export interface ConnectorSummary extends ConnectorManifest {
  status: ConnectorStatus;
  connections: ConnectorConnection[];
  usage: ConnectorUsage;
}

export interface ConnectorActivityEntry {
  id: string;
  at: IsoDateString;
  /** Raw audit action (`APP_ACTION_SEND_MESSAGE`, `CONNECTION_TESTED`…). */
  action: string;
  /** Readable label: the capability's label when it is one. */
  label: string;
  status: 'SUCCESS' | 'FAILURE' | string;
  durationMs: number | null;
  userId: string | null;
  userName: string | null;
  error: string | null;
}

export interface ConnectorDetail extends ConnectorSummary {
  activity: ConnectorActivityEntry[];
  /** A custom connector's definition (no secrets) and the connection that stores it, for editing. */
  customDefinition?: CustomConnectorDefinition;
  customIntegrationId?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  durationMs: number;
  account?: { email?: string | null; name?: string | null };
  /** True when the failure means the person has to reconnect. */
  reconnect?: boolean;
}

/** Overall status: usable, broken, absent, or impossible on this server. */
export function connectorStatus(connections: ReadonlyArray<Pick<ConnectorConnection, 'status'>>, serverConfigured: boolean): ConnectorStatus {
  if (connections.some((c) => c.status === 'CONNECTED')) return 'connected';
  if (connections.some((c) => c.status === 'ERROR' || c.status === 'EXPIRED' || c.status === 'REVOKED')) return 'needs_attention';
  return serverConfigured ? 'not_connected' : 'unavailable';
}

export interface ConnectorAuditRow {
  action: string;
  status: string;
  durationMs: number | null;
  createdAt: Date | string;
}

/** The audit action an app action is logged under. */
export function connectorAuditAction(actionId: string): string {
  return `APP_ACTION_${actionId.toUpperCase()}`;
}

/** Calls, failures, latency and most-used action from audit rows (newest first). */
export function summarizeConnectorUsage(
  rows: ReadonlyArray<ConnectorAuditRow>,
  capabilities: ReadonlyArray<Pick<ConnectorCapability, 'id' | 'label'>>,
  windowDays: number,
): ConnectorUsage {
  const labelByAudit = new Map(capabilities.map((c) => [connectorAuditAction(c.id), c.label]));
  const calls = rows.filter((r) => r.action.startsWith('APP_ACTION_'));
  const durations = calls.map((r) => r.durationMs).filter((d): d is number => typeof d === 'number');
  const tally = new Map<string, number>();
  for (const r of calls) tally.set(r.action, (tally.get(r.action) ?? 0) + 1);
  let top: string | null = null;
  let topCount = 0;
  for (const [action, count] of tally) {
    if (count > topCount) {
      top = action;
      topCount = count;
    }
  }
  const last = calls[0]?.createdAt;
  return {
    windowDays,
    calls: calls.length,
    failures: calls.filter((r) => r.status !== 'SUCCESS').length,
    avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    lastUsedAt: last ? new Date(last).toISOString() : null,
    topAction: top ? (labelByAudit.get(top) ?? humanizeAuditAction(top)) : null,
  };
}

/** `APP_ACTION_SEND_MESSAGE` → `Send message`. */
export function humanizeAuditAction(action: string): string {
  const text = action.replace(/^APP_ACTION_/, '').toLowerCase().replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : action;
}

// ---------------------------------------------------------------------------
// Agent tool selection
// ---------------------------------------------------------------------------

export interface IntegrationToolRef {
  name: string;
  provider: string;
}

/**
 * Splits an agent's saved `tools` list into built-in names and connector
 * tool names, and picks the connector tools it may use.
 *
 * - Built-in tools: the listed built-ins, or (when only connector tools are
 *   listed) the default set — choosing Slack actions must not silently take
 *   away the agent's built-in tools.
 * - Connector tools: for a provider with any action listed, exactly those
 *   actions; for a linked provider with none listed, all of its actions.
 *   A canvas (inline) agent gets only what is drawn on it.
 */
export function selectAgentTools<T extends IntegrationToolRef>(
  allowed: readonly string[],
  integrationTools: readonly T[],
  isBuiltinName: (name: string) => boolean,
  opts: { inline?: boolean } = {},
): { builtinNames: string[]; useDefaultBuiltins: boolean; integrationTools: T[] } {
  const allowedSet = new Set(allowed);
  const builtinNames = allowed.filter((n) => isBuiltinName(n) || n.startsWith('mcp'));
  const restricted = new Set(integrationTools.filter((t) => allowedSet.has(t.name)).map((t) => t.provider));
  const picked = integrationTools.filter((t) =>
    opts.inline ? allowedSet.has(t.name) : !restricted.has(t.provider) || allowedSet.has(t.name),
  );
  return {
    builtinNames,
    useDefaultBuiltins: !opts.inline && builtinNames.length === 0,
    integrationTools: picked,
  };
}

// ---------------------------------------------------------------------------
// Polling triggers
// ---------------------------------------------------------------------------

/** Reads a dotted path (`data.messages`) from a value; undefined when absent. */
export function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let current: unknown = value;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * The items a poll returned that weren't seen before, oldest first, and the
 * ids to remember next time (bounded). The first poll only records what is
 * there — an agent switched on is never flooded with history.
 */
export function diffPolledItems(
  data: unknown,
  trigger: Pick<ConnectorTriggerDefinition, 'itemsPath' | 'idField'>,
  seen: readonly string[] | null,
  maxRemembered = 200,
): { fresh: Record<string, unknown>[]; seen: string[]; error?: string } {
  const list = readPath(data, trigger.itemsPath);
  if (!Array.isArray(list)) {
    return { fresh: [], seen: [...(seen ?? [])], error: `The app returned no list at '${trigger.itemsPath}'.` };
  }
  const items = list.filter((i): i is Record<string, unknown> => !!i && typeof i === 'object');
  const ids = items.map((i) => {
    const id = readPath(i, trigger.idField);
    return id === undefined || id === null ? null : String(id);
  });
  const known = new Set(seen ?? []);
  const fresh = seen === null ? [] : items.filter((_, idx) => ids[idx] !== null && !known.has(ids[idx] as string));
  const merged = [...ids.filter((id): id is string => id !== null), ...(seen ?? [])];
  const unique = [...new Set(merged)].slice(0, maxRemembered);
  // Apps list newest first; run the oldest new item first.
  return { fresh: fresh.reverse(), seen: unique };
}

// ---------------------------------------------------------------------------
// Connector groups
// ---------------------------------------------------------------------------

/** One app inside a group: whether it's on, and which of its actions are. */
export interface ConnectorGroupMember {
  provider: string;
  /** The connection to use; empty = whichever connected one the agent's owner has. */
  integrationId?: string | null;
  enabled: boolean;
  /** Switched-on action ids; null = every action of the app. */
  actions: string[] | null;
  /** Action ids an agent must ask a person about before running. */
  askBefore?: string[];
}

/**
 * A named set of apps that can be handed to an agent in one step, and reused
 * (as a template) for other agents.
 */
export interface ConnectorGroup {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  /** Shared with the whole workspace; otherwise only its creator sees it. */
  isTemplate: boolean;
  createdById: string;
  /** The caller made it (and may change it). */
  mine: boolean;
  members: ConnectorGroupMember[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ConnectorGroupInput {
  name: string;
  description?: string | null;
  isTemplate?: boolean;
  members: ConnectorGroupMember[];
}

/**
 * Tool names an agent keeps for one group member: the action ids that are on
 * (all of them when `actions` is null), as the runtime's function names. Empty
 * list = "no narrowing needed" is NOT implied here; callers compare lengths.
 */
export function groupMemberToolNames(
  member: Pick<ConnectorGroupMember, 'provider' | 'actions'>,
  allActionIds: ReadonlyArray<string>,
): string[] {
  const ids = member.actions === null ? allActionIds : allActionIds.filter((id) => member.actions?.includes(id));
  return ids.map((id) => connectorToolName(member.provider, id));
}

// ---------------------------------------------------------------------------
// OAuth app credentials (a workspace's own client id / secret per provider)
// ---------------------------------------------------------------------------

/** Where a provider family's OAuth client currently comes from. */
export type OAuthAppSource = 'workspace' | 'server' | 'none';

/** One provider family's OAuth app — never carries the secret itself. */
export interface OAuthAppStatus {
  /** Family key, e.g. GOOGLE (one app serves Gmail, Calendar, Drive, Docs and Sheets). */
  appKey: string;
  label: string;
  /** Provider ids that use this app. */
  providers: string[];
  providerNames: string[];
  /** `workspace` = this workspace's own app, `server` = the platform's env credentials, `none` = nothing yet. */
  source: OAuthAppSource;
  /** Whether people can connect these apps right now. */
  configured: boolean;
  clientId: string | null;
  secretSet: boolean;
  enabled: boolean;
  /** Whether the server also has credentials to fall back to. */
  serverFallback: boolean;
  /** Every redirect URL the provider's console must allow. */
  callbackUrls: Array<{ provider: string; url: string }>;
  setupUrl: string;
  setupHint: string;
  clientIdPlaceholder: string;
  updatedAt: string | null;
}

export interface OAuthAppInput {
  clientId: string;
  /** Omit to keep the stored secret when only the client id or switch changes. */
  clientSecret?: string;
  enabled?: boolean;
}

import type { ConnectorCategory } from './connectors.js';
import type { CoworkerTemplateKey } from './coworker-templates.js';

/**
 * The Coworkers page: each coworker as one Orchestrator (the coworker's own
 * runtime turn) over two kinds of nodes — specialist reasoning agents
 * (`CoworkerAgent` delegation links) and connector agents (app connections
 * attached through `CoworkerApp`). Every number is read from the database.
 */

/**
 * - `attached`: a working connection is attached; its actions are this coworker's tools.
 * - `ready_to_attach`: the workspace has a working connection, not attached to this coworker yet.
 * - `needs_reconnect`: the attached (or only) connection failed its last use.
 * - `needs_connection`: the connector works on this server; nobody has connected it.
 * - `not_set_up`: an OAuth app is missing on this server / workspace.
 * - `unavailable`: there is no adapter for this app in this build.
 */
export type RosterConnectorState =
  | 'attached'
  | 'ready_to_attach'
  | 'needs_reconnect'
  | 'needs_connection'
  | 'not_set_up'
  | 'unavailable';

export interface RosterConnector {
  provider: string;
  name: string;
  category: ConnectorCategory | null;
  state: RosterConnectorState;
  /** The attached connection, or the one "Attach" would use. */
  integrationId: string | null;
  connectionLabel: string | null;
  connectionScope: 'WORKSPACE' | 'USER' | null;
  readActions: number;
  writeActions: number;
  triggers: number;
  /** Other coworkers using the same canonical connection. */
  sharedWith: Array<{ id: string; name: string }>;
  /** False for a connection someone attached that this coworker's template doesn't list. */
  fromTemplate: boolean;
  reason: string | null;
}

export interface RosterSpecialist {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface RosterWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  /** Other coworkers the same workflow also calls. */
  sharedWith: Array<{ id: string; name: string }>;
}

export interface CoworkerRosterEntry {
  id: string;
  name: string;
  role: string;
  description: string | null;
  avatarUrl: string | null;
  status: string;
  isActive: boolean;
  creatorId: string | null;
  /** The creator's profile; null for seeded coworkers or a removed user. */
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  templateKey: CoworkerTemplateKey | null;
  adoptedFrom: string | null;
  /** Explicit model, or null when it follows the workspace default. */
  provider: string | null;
  model: string | null;
  orchestrator: {
    tools: number;
    grantedWrites: number;
    collaborators: Array<{ id: string; name: string }>;
  };
  specialists: RosterSpecialist[];
  connectors: RosterConnector[];
  workflows: RosterWorkflow[];
  channels: number;
  deployments: { total: number; active: number };
  activity: {
    runs30d: number;
    failed30d: number;
    waitingApproval: number;
    runsThisMonth: number;
    tokens30d: number;
    avgLatencyMs: number | null;
    lastRunAt: string | null;
    openTasks: number;
    completedTasks30d: number;
  };
}

export interface CoworkerRoster {
  coworkers: CoworkerRosterEntry[];
  /**
   * Every app with a working connection in this workspace, as `ready_to_attach`
   * nodes. "Add app" offers the ones a coworker doesn't already show.
   */
  connectableApps: RosterConnector[];
  /** The workspace plan's shared allocation; -1 = custom/unlimited. */
  plan: {
    name: string;
    requestsPerMonth: number;
    /** AI runs (agents, coworkers, workflows) recorded this calendar month. */
    aiRunsThisMonth: number;
    concurrentExecutions: number;
    runningNow: number;
    cpu: number;
    ramGb: number;
    maxExecutionTimeMs: number;
  };
  generatedAt: string;
}

/** What the connector registry knows about one app, reduced to what the roster needs. */
export interface RosterConnectorInput {
  provider: string;
  name: string;
  category: ConnectorCategory;
  serverConfigured: boolean;
  unavailableReason?: string;
  readActions: number;
  writeActions: number;
  triggers: number;
  connections: Array<{ id: string; status: string; scopeType: 'WORKSPACE' | 'USER'; displayName: string | null }>;
}

/** Friendly names for template connectors with no adapter in this build. */
const KNOWN_APP_NAMES: Record<string, string> = {
  RAZORPAYX_PAYROLL: 'RazorpayX Payroll',
};

const BROKEN = new Set(['ERROR', 'EXPIRED', 'REVOKED']);

/**
 * One coworker's connector nodes: every app its template lists, in order,
 * then any other connection someone attached to it. Pure, so the state
 * rules are tested without a database.
 */
export function buildRosterConnectors(input: {
  templateProviders: readonly string[];
  /** This coworker's `CoworkerApp` links. */
  attached: ReadonlyArray<{ integrationId: string; provider: string; status: string; displayName: string | null; scopeType: 'WORKSPACE' | 'USER' }>;
  registry: ReadonlyMap<string, RosterConnectorInput>;
  /** integrationId → other coworkers attached to it. */
  sharing: ReadonlyMap<string, Array<{ id: string; name: string }>>;
}): RosterConnector[] {
  const out: RosterConnector[] = [];
  const seen = new Set<string>();
  const providers = [...input.templateProviders, ...input.attached.map((a) => a.provider.toUpperCase())];
  for (const raw of providers) {
    const provider = raw.toUpperCase();
    if (seen.has(provider)) continue;
    seen.add(provider);
    const info = input.registry.get(provider);
    const fromTemplate = input.templateProviders.includes(provider);
    const base = {
      provider,
      name: info?.name ?? KNOWN_APP_NAMES[provider] ?? provider.charAt(0) + provider.slice(1).toLowerCase(),
      category: info?.category ?? null,
      readActions: info?.readActions ?? 0,
      writeActions: info?.writeActions ?? 0,
      triggers: info?.triggers ?? 0,
      fromTemplate,
    };
    const link = input.attached.find((a) => a.provider.toUpperCase() === provider);
    if (link) {
      const broken = BROKEN.has(link.status) || link.status !== 'CONNECTED';
      out.push({
        ...base,
        state: broken ? 'needs_reconnect' : 'attached',
        integrationId: link.integrationId,
        connectionLabel: link.displayName,
        connectionScope: link.scopeType,
        sharedWith: input.sharing.get(link.integrationId) ?? [],
        reason: broken ? `The ${base.name} connection reports ${link.status.toLowerCase()} — reconnect it.` : null,
      });
      continue;
    }
    if (!info) {
      out.push({ ...base, state: 'unavailable', integrationId: null, connectionLabel: null, connectionScope: null, sharedWith: [], reason: `There’s no ${base.name} connector in this build yet.` });
      continue;
    }
    // Prefer the workspace-wide connection over someone's personal one.
    const usable = [...info.connections]
      .filter((c) => c.status === 'CONNECTED')
      .sort((a, b) => (a.scopeType === b.scopeType ? 0 : a.scopeType === 'WORKSPACE' ? -1 : 1))[0];
    if (usable) {
      out.push({ ...base, state: 'ready_to_attach', integrationId: usable.id, connectionLabel: usable.displayName, connectionScope: usable.scopeType, sharedWith: input.sharing.get(usable.id) ?? [], reason: null });
    } else if (info.connections.some((c) => BROKEN.has(c.status))) {
      const broken = info.connections.find((c) => BROKEN.has(c.status))!;
      out.push({ ...base, state: 'needs_reconnect', integrationId: null, connectionLabel: broken.displayName, connectionScope: broken.scopeType, sharedWith: [], reason: `The ${base.name} connection needs to be reconnected.` });
    } else if (!info.serverConfigured) {
      out.push({ ...base, state: 'not_set_up', integrationId: null, connectionLabel: null, connectionScope: null, sharedWith: [], reason: info.unavailableReason ?? `${base.name} needs an OAuth app before anyone can connect it.` });
    } else {
      out.push({ ...base, state: 'needs_connection', integrationId: null, connectionLabel: null, connectionScope: null, sharedWith: [], reason: null });
    }
  }
  return out;
}

/**
 * Apps any coworker could attach right now: one node per provider with a
 * working connection (workspace-wide preferred over personal), by name.
 */
export function buildConnectableApps(input: {
  registry: ReadonlyMap<string, RosterConnectorInput>;
  /** integrationId → coworkers attached to it. */
  sharing: ReadonlyMap<string, Array<{ id: string; name: string }>>;
}): RosterConnector[] {
  const out: RosterConnector[] = [];
  for (const info of input.registry.values()) {
    const usable = info.connections
      .filter((c) => c.status === 'CONNECTED')
      .sort((a, b) => (a.scopeType === b.scopeType ? 0 : a.scopeType === 'WORKSPACE' ? -1 : 1))[0];
    if (!usable) continue;
    out.push({
      provider: info.provider.toUpperCase(),
      name: info.name,
      category: info.category,
      state: 'ready_to_attach',
      integrationId: usable.id,
      connectionLabel: usable.displayName,
      connectionScope: usable.scopeType,
      readActions: info.readActions,
      writeActions: info.writeActions,
      triggers: info.triggers,
      sharedWith: input.sharing.get(usable.id) ?? [],
      fromTemplate: false,
      reason: null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Ids of the coworkers an automation workflow's AI_COWORKER nodes call. */
export function workflowCoworkerIds(nodesJson: string | null | undefined): string[] {
  let nodes: unknown;
  try {
    nodes = JSON.parse(nodesJson || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(nodes)) return [];
  const ids = new Set<string>();
  for (const node of nodes as Array<Record<string, any>>) {
    if (!node || typeof node !== 'object') continue;
    // Same type/config resolution as the engine's `normalizeWorkflowNode`.
    const data = (node['data'] ?? {}) as Record<string, any>;
    const dataType = typeof data['type'] === 'string' ? data['type'] : '';
    const nodeType = typeof node['type'] === 'string' ? node['type'] : '';
    const type = (dataType && (!nodeType || nodeType.endsWith('Node')) ? dataType : nodeType || dataType).toUpperCase();
    if (type !== 'AI_COWORKER') continue;
    const cfg = { ...data, ...(data['config'] ?? {}), ...(node['config'] ?? {}) } as Record<string, unknown>;
    const id = cfg['coworkerId'] || cfg['entityId'];
    if (typeof id === 'string' && id) ids.add(id);
  }
  return [...ids];
}

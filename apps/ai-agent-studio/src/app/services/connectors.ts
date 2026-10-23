import { agentsApi, connectorsApi, coworkersApi, integrationsApi, queryKeys, workspaceApi } from '@org/api-client';
import {
  connectorToolName,
  type AIAgentDetail,
  type AppActionResult,
  type ConnectorCapability,
  type ConnectorDetail,
  type ConnectorGroup,
  type ConnectorGroupInput,
  type ConnectorGroupMember,
  type ConnectorSummary,
  type CustomConnectorInput,
} from '@org/types';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useStudioSession } from '../session-guard.js';
import { agentService } from './agentService.js';

/**
 * The Studio's connector layer — every call is the real API.
 *
 * Manifests, connections, usage and history come from `connectorsApi`;
 * connecting, disconnecting and running actions from `integrationsApi`. Which connectors a
 * person starred is saved with their workspace preferences.
 */

export const connectorKeys = {
  all: (workspaceId: string | undefined) => ['connectors', workspaceId] as const,
  detail: (workspaceId: string | undefined, provider: string) => ['connectors', workspaceId, provider] as const,
};

export function useConnectors() {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: connectorKeys.all(workspaceId),
    queryFn: () => connectorsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useConnectorDetail(provider: string | undefined) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: connectorKeys.detail(workspaceId, provider ?? ''),
    queryFn: () => connectorsApi.detail(workspaceId as string, provider as string),
    enabled: !!workspaceId && !!provider,
  });
}

/** Refreshes every connector view after a connect, disconnect or test. */
export function useInvalidateConnectors() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useStudioSession();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['connectors', activeWorkspace?.id] }),
    [queryClient, activeWorkspace?.id],
  );
}

export type ConnectOutcome =
  | { kind: 'connected' }
  | { kind: 'oauth'; popup: Window | null }
  | { kind: 'error'; message: string };

/**
 * Connects an app. OAuth apps open the provider's consent screen in a popup
 * (the API's callback page tells this window when it's done); API-key apps
 * send their credentials, which the server checks before saving them
 * encrypted.
 */
export async function connectApp(
  workspaceId: string,
  connector: Pick<ConnectorSummary, 'provider' | 'name' | 'authType'>,
  credentials?: Record<string, unknown>,
): Promise<ConnectOutcome> {
  try {
    const result = await integrationsApi.connect(workspaceId, connector.provider, credentials ? { config: credentials } : {});
    if (result?.authUrl) {
      const popup = window.open(result.authUrl, `connect-${connector.provider}`, 'width=620,height=720');
      return { kind: 'oauth', popup };
    }
    return { kind: 'connected' };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error, `Couldn’t connect ${connector.name}.`) };
  }
}

/**
 * Calls `onDone` when an OAuth popup reports success, or when the person
 * comes back to this window (the popup may have been closed by hand).
 */
export function useOAuthCompletion(onDone: () => void) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && (event.data as { type?: string }).type === 'INTEGRATION_CONNECTED') onDone();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onDone);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onDone);
    };
  }, [onDone]);
}

export async function disconnectConnection(workspaceId: string, integrationId: string) {
  return integrationsApi.disconnect(workspaceId, integrationId);
}

export async function testConnection(workspaceId: string, integrationId: string) {
  return connectorsApi.testConnection(workspaceId, integrationId);
}

/** Runs one action for real. Actions that need confirmation must be confirmed by the caller first. */
export async function runConnectorAction(
  workspaceId: string,
  integrationId: string,
  capability: Pick<ConnectorCapability, 'id' | 'requiresConfirmation'>,
  input: Record<string, unknown>,
): Promise<AppActionResult> {
  return integrationsApi.executeAction(workspaceId, integrationId, capability.id, {
    input,
    ...(capability.requiresConfirmation ? { confirm: true } : {}),
  });
}

/** The connection an action runs on: a connected one, the caller's own first. */
export function usableConnection(connector: Pick<ConnectorSummary, 'connections'>) {
  const connected = connector.connections.filter((c) => c.status === 'CONNECTED');
  return connected.find((c) => c.mine) ?? connected[0] ?? null;
}

// ---------------------------------------------------------------------------
// Agents ↔ connectors
// ---------------------------------------------------------------------------

type AgentWithApps = AIAgentDetail & {
  appLinks?: Array<{ integration: { id: string; provider: string; status: string } }>;
};

export function parseAgentTools(agent: Pick<AIAgentDetail, 'tools'> | null | undefined): string[] {
  const raw = agent?.tools as unknown;
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function linkedIntegrationIds(agent: AgentWithApps | null | undefined): string[] {
  return (agent?.appLinks ?? []).map((l) => l.integration.id);
}

/**
 * Gives an agent a connector: links the connection (that is what puts the
 * app's actions in front of the agent at run time) and narrows the app to the
 * picked actions in the agent's tool list. Built-in tools are left alone.
 */
export async function attachConnectorToAgent(
  workspaceId: string,
  agent: AgentWithApps,
  connector: Pick<ConnectorSummary, 'provider' | 'capabilities'>,
  integrationId: string,
  actionIds: string[],
) {
  const appToolNames = new Set(connector.capabilities.map((c) => c.toolName));
  const kept = parseAgentTools(agent).filter((t) => !appToolNames.has(t));
  const picked = connector.capabilities.filter((c) => actionIds.includes(c.id)).map((c) => c.toolName);
  // All actions picked = no narrowing needed (the link alone offers them all).
  const narrowed = picked.length === connector.capabilities.length ? [] : picked;
  if (!linkedIntegrationIds(agent).includes(integrationId)) {
    await coworkersApi.linkApp(workspaceId, agent.id, integrationId);
  }
  await agentsApi.update(workspaceId, agent.id, { tools: [...kept, ...narrowed] });
}

export async function detachConnectorFromAgent(
  workspaceId: string,
  agent: AgentWithApps,
  connector: Pick<ConnectorSummary, 'provider' | 'capabilities'>,
) {
  const appToolNames = new Set(connector.capabilities.map((c) => c.toolName));
  const links = (agent.appLinks ?? []).filter((l) => l.integration.provider.toUpperCase() === connector.provider);
  for (const link of links) await coworkersApi.unlinkApp(workspaceId, agent.id, link.integration.id);
  const tools = parseAgentTools(agent);
  if (tools.some((t) => appToolNames.has(t))) {
    await agentsApi.update(workspaceId, agent.id, { tools: tools.filter((t) => !appToolNames.has(t)) });
  }
}

/** Which of a connector's actions an agent can use: none (not linked), some, or all. */
export function agentConnectorActions(agent: AgentWithApps, connector: Pick<ConnectorSummary, 'provider' | 'capabilities'>): string[] {
  const linked = (agent.appLinks ?? []).some((l) => l.integration.provider.toUpperCase() === connector.provider);
  if (!linked) return [];
  const tools = new Set(parseAgentTools(agent));
  const narrowed = connector.capabilities.filter((c) => tools.has(c.toolName));
  return (narrowed.length ? narrowed : connector.capabilities).map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Starred connectors (per person, saved with their workspace preferences)
// ---------------------------------------------------------------------------

const STAR_KEY = 'studioStarredConnectors';

export function useStarredConnectors() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const key = queryKeys.workspaces.memberPreferences(activeWorkspace.id);
  const prefs = useQuery({
    queryKey: key,
    queryFn: () => workspaceApi.getMemberPreferences(activeWorkspace.id),
    staleTime: 60_000,
  });
  const raw = prefs.data?.[STAR_KEY];
  const starred = useMemo(
    () => (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []),
    [raw],
  );
  const save = useMutation({
    mutationFn: (next: string[]) => workspaceApi.saveMemberPreferences(activeWorkspace.id, { [STAR_KEY]: next }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, unknown>>(key);
      queryClient.setQueryData(key, { ...(previous ?? {}), [STAR_KEY]: next });
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Could not update starred connectors', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
  const toggle = useCallback(
    (provider: string) =>
      save.mutate(starred.includes(provider) ? starred.filter((p) => p !== provider) : [...starred, provider]),
    [starred, save],
  );
  return { starred, toggle };
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export const AUTH_LABELS: Record<string, string> = {
  OAUTH2: 'OAuth',
  BEARER: 'Bearer token',
  API_KEY_HEADER: 'API key',
  API_KEY_QUERY: 'API key',
  BASIC: 'Username & password',
  CUSTOM_HEADERS: 'Custom headers',
  NONE: 'No sign-in',
};

export const STATUS_META: Record<ConnectorSummary['status'], { label: string; variant: 'success' | 'warning' | 'neutral' | 'destructive' }> = {
  connected: { label: 'Connected', variant: 'success' },
  needs_attention: { label: 'Needs attention', variant: 'warning' },
  not_connected: { label: 'Not connected', variant: 'neutral' },
  unavailable: { label: 'Not set up', variant: 'neutral' },
};

/** Credentials a non-OAuth connector asks for when connecting. */
export function credentialFieldsFor(
  connector: Pick<ConnectorSummary, 'provider' | 'authType' | 'supports' | 'credentialFields'>,
): Array<{ key: string; label: string; secret?: boolean; placeholder?: string; help?: string; optional?: boolean }> | null {
  if (connector.authType === 'OAUTH2' || connector.authType === 'NONE') return null;
  // A connector describes its own form; the cases below are older connectors that don't yet.
  if (connector.credentialFields?.length) return connector.credentialFields;
  if (connector.supports.customEndpoints) {
    return [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com/v1' },
      { key: 'apiKeyHeader', label: 'API key header', placeholder: 'X-Api-Key (leave empty for a bearer token)' },
      { key: 'apiKey', label: 'API key or token', secret: true },
    ];
  }
  if (connector.provider === 'TRELLO') {
    return [
      { key: 'apiKey', label: 'API key', secret: true, help: 'From trello.com/power-ups/admin → your Power-Up → API key.' },
      { key: 'token', label: 'Token', secret: true, help: 'Generate it from the same page (“Token” link).' },
    ];
  }
  return [{ key: 'apiKey', label: 'API key', secret: true }];
}

/** A custom API's connect config from the simple form above. */
export function customApiConfig(values: Record<string, string>): Record<string, unknown> {
  const header = values['apiKeyHeader']?.trim();
  const key = values['apiKey']?.trim();
  return header
    ? { baseUrl: values['baseUrl']?.trim(), authType: 'API_KEY_HEADER', apiKeyHeader: header, apiKey: key }
    : { baseUrl: values['baseUrl']?.trim(), authType: key ? 'BEARER' : 'NONE', ...(key ? { bearerToken: key } : {}) };
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; response?: { data?: { message?: unknown } } };
    const fromResponse = e.response?.data?.message;
    if (typeof fromResponse === 'string' && fromResponse) return fromResponse;
    if (Array.isArray(fromResponse) && fromResponse.length) return String(fromResponse[0]);
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return fallback;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

// ---------------------------------------------------------------------------
// Connector groups
// ---------------------------------------------------------------------------

export function useConnectorGroups() {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['connector-groups', workspaceId],
    queryFn: () => connectorsApi.groups.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useInvalidateConnectorGroups() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useStudioSession();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['connector-groups', activeWorkspace?.id] }),
    [queryClient, activeWorkspace?.id],
  );
}

type RuntimeConfig = { rules?: { policies?: Record<string, string>; [key: string]: unknown }; [key: string]: unknown };

function agentRuntime(agent: AgentWithApps): RuntimeConfig {
  const config = (agent as unknown as { configuration?: { runtime?: RuntimeConfig } }).configuration;
  return config?.runtime && typeof config.runtime === 'object' ? config.runtime : {};
}

export interface GroupApplyResult {
  applied: string[];
  skipped: Array<{ provider: string; reason: string }>;
}

/**
 * Gives an agent every switched-on app in a group in one go: links each
 * connection, keeps the agent's built-in tools, narrows each app to the group's
 * actions, and makes the group's "ask first" actions wait for a person. An app
 * that isn't connected yet is skipped (and reported), never faked.
 */
export async function applyGroupToAgent(
  workspaceId: string,
  agent: AgentWithApps,
  group: Pick<ConnectorGroup, 'members'>,
  connectors: ConnectorSummary[],
): Promise<GroupApplyResult> {
  const result: GroupApplyResult = { applied: [], skipped: [] };
  const linked = new Set(linkedIntegrationIds(agent));
  let tools = parseAgentTools(agent);
  const policies: Record<string, string> = { ...(agentRuntime(agent).rules?.policies ?? {}) };

  for (const member of group.members) {
    if (!member.enabled) continue;
    const connector = connectors.find((c) => c.provider === member.provider);
    if (!connector) {
      result.skipped.push({ provider: member.provider, reason: 'This app isn’t available any more.' });
      continue;
    }
    const connection = connector.connections.find((c) => c.id === member.integrationId && c.status === 'CONNECTED') ?? usableConnection(connector);
    if (!connection) {
      result.skipped.push({ provider: member.provider, reason: `${connector.name} isn’t connected yet.` });
      continue;
    }
    if (!linked.has(connection.id)) {
      await coworkersApi.linkApp(workspaceId, agent.id, connection.id);
      linked.add(connection.id);
    }
    const allIds = connector.capabilities.map((c) => c.id);
    const wanted = member.actions === null ? allIds : allIds.filter((id) => member.actions?.includes(id));
    const ownNames = new Set(connector.capabilities.map((c) => c.toolName));
    tools = tools.filter((t) => !ownNames.has(t));
    // Every action on needs no narrowing: the link alone offers them all.
    if (wanted.length < allIds.length) tools.push(...wanted.map((id) => connectorToolName(connector.provider, id)));
    for (const id of allIds) {
      const name = connectorToolName(connector.provider, id);
      if (member.askBefore?.includes(id)) policies[name] = 'ask_user';
      else if (policies[name] === 'ask_user') delete policies[name];
    }
    result.applied.push(connector.name);
  }

  if (result.applied.length) {
    const runtime = agentRuntime(agent);
    await agentService.updateAgent(workspaceId, agent.id, {
      tools,
      configuration: { runtime: { ...runtime, rules: { ...(runtime.rules ?? {}), policies } } },
    });
  }
  return result;
}

/** The group an agent's current apps already form — the starting point for "Save as group". */
export function groupMembersFromAgent(agent: AgentWithApps, connectors: ConnectorSummary[]): ConnectorGroupMember[] {
  const policies = agentRuntime(agent).rules?.policies ?? {};
  const members: ConnectorGroupMember[] = [];
  for (const connector of connectors) {
    const actions = agentConnectorActions(agent, connector);
    if (!actions.length) continue;
    const link = (agent.appLinks ?? []).find((l) => l.integration.provider.toUpperCase() === connector.provider);
    const askBefore = connector.capabilities.filter((c) => policies[c.toolName] === 'ask_user').map((c) => c.id);
    members.push({
      provider: connector.provider,
      integrationId: link?.integration.id ?? null,
      enabled: true,
      actions: actions.length === connector.capabilities.length ? null : actions,
      ...(askBefore.length ? { askBefore } : {}),
    });
  }
  return members;
}

export const saveConnectorGroup = (workspaceId: string, input: ConnectorGroupInput, id?: string) =>
  id ? connectorsApi.groups.update(workspaceId, id, input) : connectorsApi.groups.create(workspaceId, input);

export type { ConnectorDetail, ConnectorSummary, AgentWithApps, ConnectorGroup, ConnectorGroupInput, ConnectorGroupMember };

// ---------------------------------------------------------------------------
// Custom connectors (built in the Studio)
// ---------------------------------------------------------------------------

export function createCustomConnector(workspaceId: string, input: CustomConnectorInput) {
  return connectorsApi.custom.create(workspaceId, input);
}

export function updateCustomConnector(workspaceId: string, integrationId: string, input: CustomConnectorInput) {
  return connectorsApi.custom.update(workspaceId, integrationId, input);
}

export function deleteCustomConnector(workspaceId: string, integrationId: string) {
  return connectorsApi.custom.remove(workspaceId, integrationId);
}

/** Checks the (possibly unsaved) connection settings against the real API. */
export function testCustomConnection(workspaceId: string, body: { connector: CustomConnectorInput; integrationId?: string }) {
  return connectorsApi.custom.testConnection(workspaceId, body);
}

/** Runs one action of the (possibly unsaved) definition against the real API. */
export function testCustomAction(
  workspaceId: string,
  body: { connector: CustomConnectorInput; actionId: string; values?: Record<string, unknown>; confirm?: boolean; integrationId?: string },
) {
  return connectorsApi.custom.testAction(workspaceId, body);
}

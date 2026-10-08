import { agentsApi, connectorsApi, coworkersApi, integrationsApi } from '@org/api-client';
import type {
  AIAgentDetail,
  AppActionResult,
  ConnectorCapability,
  ConnectorDetail,
  ConnectorSummary,
} from '@org/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useStudioSession } from '../session-guard.js';

/**
 * The Studio's connector layer — every call is the real API.
 *
 * Manifests, connections, usage and history come from `connectorsApi`;
 * connecting, disconnecting and running actions from `integrationsApi`. The
 * only thing kept in the browser is which connectors this person starred.
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
// Starred connectors (per person, this browser only)
// ---------------------------------------------------------------------------

const STAR_KEY = 'studio.connectors.starred';

function readStars(): string[] {
  try {
    const raw = window.localStorage.getItem(STAR_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function useStarredConnectors() {
  const [starred, setStarred] = useState<string[]>(readStars);
  const toggle = useCallback((provider: string) => {
    setStarred((prev) => {
      const next = prev.includes(provider) ? prev.filter((p) => p !== provider) : [...prev, provider];
      try {
        window.localStorage.setItem(STAR_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — the star just won't persist */
      }
      return next;
    });
  }, []);
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
  connector: Pick<ConnectorSummary, 'provider' | 'authType' | 'supports'>,
): Array<{ key: string; label: string; secret?: boolean; placeholder?: string; help?: string }> | null {
  if (connector.authType === 'OAUTH2' || connector.authType === 'NONE') return null;
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

export type { ConnectorDetail, ConnectorSummary, AgentWithApps };

import { useAppConnector } from '@org/chat-ui';
import {
  appLabel,
  describeAgentScope,
  describeEntityTool,
  getAppLogoUrl,
  type AgentAppConnectionNeed,
} from '@org/types';
import type {
  AIEntityProfileCapability,
  AIEntityProfileToolGroup,
  AIEntityProfileToolGroupStatus,
} from '@org/ui';
import { useMemo, useState } from 'react';

/** One app an agent or coworker acts in, as the viewer has it connected. */
export interface EntityAppConnection {
  /** Upper-case provider key (`SLACK`). */
  provider: string;
  label?: string;
  connected: boolean;
  needsReconnect?: boolean;
  /** Connected through a workspace-shared account. */
  shared?: boolean;
}

/** `tools` is stored either as a JSON array or a comma-separated list. */
export function parseEntityTools(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
    }
  } catch {
    // not JSON — fall through to the comma-separated form
  }
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

export interface EntityToolProfile {
  groups: AIEntityProfileToolGroup[];
  capabilities: AIEntityProfileCapability[];
  /** Apps the viewer still has to connect (or reconnect) for every tool to work. */
  missing: AgentAppConnectionNeed[];
  /** Tools that can't run until their app is connected. */
  blockedTools: number;
  connect: (need: AgentAppConnectionNeed) => void;
}

/**
 * What an agent or coworker can do and whether it can do it *for this viewer*:
 * its tools grouped by app with each app's connection state, the abilities
 * those tools add up to, and which apps still need connecting.
 *
 * `connections` is the entity's own answer (the agent connections endpoint, a
 * coworker's linked apps); anything it doesn't cover falls back to the
 * viewer's integrations.
 */
export function useEntityToolProfile({
  tools,
  providers = [],
  connections,
}: {
  tools: readonly string[];
  /** Apps the entity acts in beyond its own tools (canvas connectors). */
  providers?: readonly string[];
  connections?: readonly EntityAppConnection[];
}): EntityToolProfile {
  const connector = useAppConnector();
  const [connecting, setConnecting] = useState<string | null>(null);

  const connect = (need: AgentAppConnectionNeed) => {
    if (!connector) return;
    setConnecting(need.provider);
    void Promise.resolve(connector.connect(need.provider, need.label)).finally(() => setConnecting(null));
  };

  const base = useMemo(() => {
    const described = [...new Set(tools)].map(describeEntityTool);
    const appOrder = [
      ...new Set([
        ...described.flatMap((t) => (t.provider ? [t.provider] : [])),
        ...providers.map((p) => p.toUpperCase()),
      ]),
    ];

    const statusOf = (provider: string): { status: AIEntityProfileToolGroupStatus; label: string; shared?: boolean } => {
      const own = connections?.find((c) => c.provider.toUpperCase() === provider);
      const label = own?.label || appLabel(provider);
      if (own) {
        if (own.connected) return { status: 'connected', label, shared: own.shared };
        return { status: own.needsReconnect ? 'reconnect' : 'not_connected', label };
      }
      const known = connector?.isConnected(provider);
      if (known === undefined) return { status: 'unknown', label };
      return { status: known ? 'connected' : 'not_connected', label };
    };

    const builtin = described.filter((t) => !t.provider);
    const groups: Array<Omit<AIEntityProfileToolGroup, 'onConnect' | 'connecting'>> = [];
    if (builtin.length > 0) {
      groups.push({
        id: 'builtin',
        name: 'Onetab AI',
        note: 'Built into the workspace — always available',
        status: 'builtin',
        tools: builtin.map((t) => ({ key: t.key, label: t.label, access: t.access })),
      });
    }

    const missing: AgentAppConnectionNeed[] = [];
    const appStatus = new Map<string, AIEntityProfileToolGroupStatus>();
    for (const provider of appOrder) {
      const { status, label, shared } = statusOf(provider);
      appStatus.set(provider, status);
      if (status === 'not_connected' || status === 'reconnect') {
        missing.push({ provider, label, reason: status === 'reconnect' ? 'reconnect' : 'not_connected' });
      }
      const logoUrl = getAppLogoUrl(provider, label);
      const appTools = described.filter((t) => t.provider === provider);
      groups.push({
        id: provider,
        name: label,
        logo: logoUrl ? <img src={logoUrl} alt="" className="size-4 object-contain" /> : undefined,
        status,
        note:
          status === 'connected'
            ? shared
              ? 'Through the workspace account'
              : 'Through your account'
            : status === 'not_connected'
              ? 'Connect your account so it can work here'
              : status === 'reconnect'
                ? 'Your sign-in expired or was revoked'
                : undefined,
        tools: appTools.map((t) => ({ key: t.key, label: t.label, access: t.access })),
      });
    }

    // Abilities = the distinct scopes the tools need, in words.
    const capabilities: AIEntityProfileCapability[] = [];
    const seen = new Set<string>();
    for (const tool of described) {
      const scope = tool.scope ?? `tool:${tool.key}`;
      if (seen.has(scope)) continue;
      seen.add(scope);
      const info = tool.scope ? describeAgentScope(tool.scope) : { label: tool.label, description: undefined };
      const status = tool.provider ? appStatus.get(tool.provider) : undefined;
      const label = tool.provider ? statusOf(tool.provider).label : '';
      capabilities.push({
        id: scope,
        label: info.label,
        description: info.description,
        blockedBy:
          status === 'not_connected' ? `Connect ${label}` : status === 'reconnect' ? `Reconnect ${label}` : undefined,
      });
    }
    // An app the canvas uses but no tool names still deserves a line.
    for (const provider of appOrder) {
      if (described.some((t) => t.provider === provider)) continue;
      const status = appStatus.get(provider);
      const label = statusOf(provider).label;
      capabilities.push({
        id: `app:${provider}`,
        label: `Work in ${label}`,
        description: `Reads and acts in ${label} as part of its workflow`,
        blockedBy:
          status === 'not_connected' ? `Connect ${label}` : status === 'reconnect' ? `Reconnect ${label}` : undefined,
      });
    }

    const missingSet = new Set(missing.map((m) => m.provider));
    const blockedTools = described.filter((t) => t.provider && missingSet.has(t.provider)).length;
    return { groups, capabilities, missing, blockedTools };
  }, [tools, providers, connections, connector]);

  const groups = base.groups.map((group) => {
    const need = base.missing.find((m) => m.provider === group.id);
    return need && connector
      ? { ...group, onConnect: () => connect(need), connecting: connecting === need.provider }
      : group;
  });

  return { ...base, groups, connect };
}

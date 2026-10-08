import type { ConnectorSummary } from '@org/types';
import { Boxes, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useConnectors } from '../../services/connectors.js';
import type { CatalogNodeItem } from './node-library.js';

/**
 * Canvas cards for every connector capability, from the live connector
 * manifests — nothing per app is hard-coded. An action or read becomes an
 * `APP_CONNECTOR_ACTION` card (it runs as a `PROVIDER.action` step, or as a
 * tool when plugged into an agent); an event becomes an
 * `APP_CONNECTOR_TRIGGER` card the trigger poller watches.
 */
export function connectorCatalogNodes(connectors: readonly ConnectorSummary[]): CatalogNodeItem[] {
  const items: CatalogNodeItem[] = [];
  for (const c of connectors) {
    if (c.status === 'unavailable') continue;
    const connected = c.status === 'connected';
    for (const t of c.triggers) {
      items.push({
        key: `trigger:${c.provider}:${t.id}`,
        type: 'APP_CONNECTOR_TRIGGER',
        category: 'connectors',
        label: `${c.name} · ${t.label}`,
        subtitle: connected ? 'Starts the agent' : `Starts the agent · connect ${c.name}`,
        description: t.description,
        icon: Zap,
        badge: 'Trigger',
        defaultConfig: { provider: c.provider, connectorId: c.slug, triggerId: t.id, input: { ...(t.defaultInput ?? {}) } },
      });
    }
    for (const cap of c.capabilities) {
      items.push({
        key: `action:${c.provider}:${cap.id}`,
        type: 'APP_CONNECTOR_ACTION',
        category: 'connectors',
        label: `${c.name} · ${cap.label}`,
        subtitle: `${cap.kind === 'query' ? 'Reads' : cap.permissionLevel === 'destructive' ? 'Deletes' : 'Writes'}${connected ? '' : ` · connect ${c.name}`}`,
        description: cap.description || `${cap.label} in ${c.name}`,
        icon: Boxes,
        badge: c.name,
        defaultConfig: { provider: c.provider, connectorId: c.slug, actionId: cap.id, input: {} },
      });
    }
  }
  return items;
}

export function useConnectorCatalogNodes(): CatalogNodeItem[] {
  const connectors = useConnectors();
  return useMemo(() => connectorCatalogNodes(connectors.data ?? []), [connectors.data]);
}

/** Legacy cards named the app in their type or by slug (`microsoft-teams`). */
const LEGACY_PROVIDER: Record<string, string> = {
  TEAMS_SEND_MESSAGE: 'MICROSOFT_TEAMS',
  TEAMS_CREATE_MEETING: 'MICROSOFT_TEAMS',
  TEAMS_TRIGGER_MESSAGE: 'MICROSOFT_TEAMS',
};
const LEGACY_ID: Record<string, string> = {
  TEAMS_SEND_MESSAGE: 'send_channel_message',
  TEAMS_CREATE_MEETING: 'create_meeting',
  TEAMS_TRIGGER_MESSAGE: 'new_message',
};

/** What a connector card on the canvas points at, resolved against the live manifests. */
export function useConnectorNode(type: string | undefined, config: Record<string, unknown>) {
  const connectors = useConnectors();
  const upper = String(type ?? '').toUpperCase();
  const provider = String(config['provider'] ?? config['connectorId'] ?? LEGACY_PROVIDER[upper] ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  const isTrigger = upper.includes('TRIGGER');
  const id = String(config[isTrigger ? 'triggerId' : 'actionId'] ?? LEGACY_ID[upper] ?? '');
  const connector = (connectors.data ?? []).find((c) => c.provider === provider);
  const capability = isTrigger ? undefined : connector?.capabilities.find((c) => c.id === id);
  const trigger = isTrigger ? connector?.triggers.find((t) => t.id === id) : undefined;
  const connected = connector?.status === 'connected';
  return {
    loading: connectors.isLoading,
    provider,
    slug: connector?.slug ?? provider.toLowerCase(),
    connector,
    capability,
    trigger,
    connected,
    label: capability?.label ?? trigger?.label ?? (id ? id.replace(/_/g, ' ') : ''),
  };
}

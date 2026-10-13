import { automationsApi, coworkersApi, queryKeys } from '@org/api-client';
import type { MarketplaceInstallation } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAgents } from '../use-agents';

export type WorkspaceCatalogKind = 'agent' | 'coworker' | 'app' | 'automation';

/** One thing the workspace has — an agent, coworker, app or automation. */
export interface WorkspaceCatalogItem {
  /** Unique across kinds. */
  key: string;
  id: string;
  kind: WorkspaceCatalogKind;
  name: string;
  subtitle: string;
  description: string;
  /** `icon:<preset>` or an image URL, for `EntityIcon`. */
  icon?: string | null;
  status: 'active' | 'paused';
  /** Marketplace slug, for apps and installed marketplace agents. */
  slug?: string;
  /** The installation behind an app / marketplace agent. */
  installation?: MarketplaceInstallation;
  /** An automation that was planned in the AI Agent Studio (has a blueprint). */
  studioAgent?: boolean;
  updatedAt?: string;
}

function trimText(value: string | null | undefined, fallback: string): string {
  const text = (value ?? '').trim();
  return text || fallback;
}

/**
 * Everything the workspace owns, in one list: published agents, coworkers,
 * installed apps and automations. Agents appear only once published from the
 * AI Agent Studio (see `useAgents`); the other kinds are listed as they are.
 */
export function useWorkspaceCatalog(
  workspaceId: string,
  installations: MarketplaceInstallation[],
) {
  const agents = useAgents(workspaceId);
  const coworkers = useQuery({
    queryKey: queryKeys.coworkers.list(workspaceId),
    queryFn: () => coworkersApi.list(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  const automations = useQuery({
    queryKey: queryKeys.automations.list(workspaceId),
    queryFn: () => automationsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const items = useMemo<WorkspaceCatalogItem[]>(() => {
    const out: WorkspaceCatalogItem[] = [];

    for (const agent of agents.data ?? []) {
      out.push({
        key: `agent:${agent.id}`,
        id: agent.id,
        kind: 'agent',
        name: agent.name,
        subtitle: trimText(agent.role, 'AI agent'),
        description: trimText(
          agent.description ?? agent.systemPrompt,
          'No description yet.',
        ),
        icon: agent.avatarUrl || 'icon:bot',
        status: agent.isActive ? 'active' : 'paused',
        updatedAt: agent.updatedAt,
      });
    }

    for (const coworker of coworkers.data ?? []) {
      out.push({
        key: `coworker:${coworker.id}`,
        id: coworker.id,
        kind: 'coworker',
        name: coworker.name,
        subtitle: trimText(coworker.role, 'AI coworker'),
        description: trimText(
          coworker.description ?? coworker.systemPrompt,
          'No description yet.',
        ),
        icon: coworker.avatarUrl || 'icon:brain',
        status: coworker.isActive ? 'active' : 'paused',
        updatedAt: coworker.updatedAt,
      });
    }

    for (const workflow of automations.data ?? []) {
      if (workflow.archivedAt) continue;
      out.push({
        key: `automation:${workflow.id}`,
        id: workflow.id,
        kind: 'automation',
        name: workflow.name,
        subtitle: workflow.agentProfile
          ? 'Studio agent workflow'
          : `Trigger: ${workflow.triggerType}`,
        description: trimText(workflow.description, 'No description yet.'),
        icon: 'icon:layers',
        status: workflow.isActive ? 'active' : 'paused',
        studioAgent: Boolean(workflow.agentProfile),
        updatedAt: workflow.updatedAt,
      });
    }

    for (const inst of installations) {
      const kind = inst.kind ?? inst.listing?.kind;
      const slug = inst.listingSlug ?? inst.listing?.slug;
      out.push({
        key: `${kind === 'AGENT' ? 'agent' : 'app'}:inst:${inst.id}`,
        id: inst.id,
        kind: kind === 'AGENT' ? 'agent' : 'app',
        name: inst.name ?? inst.listing?.name ?? slug ?? 'Installed item',
        subtitle: kind === 'AGENT' ? 'Marketplace agent' : 'Installed app',
        description: trimText(
          inst.listing?.description,
          'Installed from the marketplace.',
        ),
        icon: inst.iconUrl ?? inst.listing?.iconUrl ?? null,
        status:
          (inst.enabled ?? inst.status === 'ACTIVE') ? 'active' : 'paused',
        slug,
        installation: inst,
        updatedAt: inst.lastActivityAt ?? inst.installedAt,
      });
    }

    return out;
  }, [agents.data, coworkers.data, automations.data, installations]);

  return {
    items,
    isLoading: agents.isLoading || coworkers.isLoading || automations.isLoading,
  };
}

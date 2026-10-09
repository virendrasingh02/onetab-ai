import { agentsApi, aiApi, knowledgeApi, promptTemplateApi } from '@org/api-client';
import type { AIModelCapabilities, AIModelMetadata, AIProviderMetadata, AgentVersion, KnowledgeBase, PromptTemplate } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useStudioSession } from '../../../session-guard.js';

/**
 * Live data the module drawer reads: models and providers, knowledge bases,
 * built-in tools, prompt templates and the agent's saved versions. All
 * workspace-scoped, cached by React Query and shared across drawers.
 */
const STALE = 60_000;

export function useWorkspaceId(): string {
  return useStudioSession().activeWorkspace.id;
}

export function useAiModels() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: ['studio-config', 'models', workspaceId],
    queryFn: () => aiApi.getModels(workspaceId),
    staleTime: STALE,
  });
}

export function useAiProviders() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: ['studio-config', 'providers', workspaceId],
    queryFn: () => aiApi.getProviders(workspaceId),
    staleTime: STALE,
  });
}

export function useKnowledgeBases() {
  const workspaceId = useWorkspaceId();
  return useQuery<KnowledgeBase[]>({
    queryKey: ['studio-config', 'knowledge-bases', workspaceId],
    queryFn: () => knowledgeApi.list(workspaceId),
    staleTime: STALE,
  });
}

export interface BuiltinTool {
  name: string;
  description: string;
  parameters: Record<string, { type?: string; description?: string }>;
}

export function useBuiltinTools() {
  const workspaceId = useWorkspaceId();
  return useQuery<BuiltinTool[]>({
    queryKey: ['studio-config', 'builtin-tools', workspaceId],
    queryFn: () => agentsApi.listMcpTools(workspaceId),
    staleTime: 5 * STALE,
  });
}

export function usePromptTemplates(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery<PromptTemplate[]>({
    queryKey: ['studio-config', 'prompt-templates', workspaceId],
    queryFn: () => promptTemplateApi.list(workspaceId),
    staleTime: STALE,
    enabled,
  });
}

/** The agent's saved versions, each with the canvas graph it had. */
export function useAgentVersionsWithGraphs(agentId: string | undefined, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery<AgentVersion[]>({
    // Same key the Versions tab uses, so a new snapshot shows up here too.
    queryKey: ['agent-versions', workspaceId, agentId],
    queryFn: () => (agentId ? agentsApi.getVersions(workspaceId, agentId) : Promise.resolve([])),
    enabled: enabled && Boolean(agentId),
    staleTime: STALE,
  });
}

/** Model capabilities arrive either as flags or as a list of names. */
export function modelCapabilities(model: AIModelMetadata | undefined): Partial<AIModelCapabilities> {
  if (!model) return {};
  if (Array.isArray(model.capabilities)) {
    return Object.fromEntries(model.capabilities.map((c) => [c, true])) as Partial<AIModelCapabilities>;
  }
  return model.capabilities;
}

/** Find a model by its id or its bare model name (`gpt-4o`). */
export function findModel(models: AIModelMetadata[] | undefined, id: string | undefined): AIModelMetadata | undefined {
  if (!id || !models) return undefined;
  return models.find((m) => m.id === id) ?? models.find((m) => m.model === id) ?? models.find((m) => m.id.endsWith(`/${id}`));
}

export function providerFor(providers: AIProviderMetadata[] | undefined, model: AIModelMetadata | undefined) {
  if (!model || !providers) return undefined;
  return providers.find((p) => p.id === model.provider);
}

/** Estimated USD for a call, from the model's published per-million prices. */
export function estimateCost(model: AIModelMetadata | undefined, inputTokens: number, outputTokens: number): number | null {
  const pricing = model?.pricing;
  if (!pricing || pricing.pricingType === 'free') return pricing?.pricingType === 'free' ? 0 : null;
  if (pricing.inputPricePerMillion === undefined && pricing.outputPricePerMillion === undefined) return null;
  return ((pricing.inputPricePerMillion ?? 0) * inputTokens + (pricing.outputPricePerMillion ?? 0) * outputTokens) / 1_000_000;
}

export const formatCost = (usd: number | null) =>
  usd === null ? 'Unknown' : usd === 0 ? 'Free' : usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;

/** A value that settles `delay` ms after it stops changing (search boxes, live lint). */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}

/** `matchMedia`, kept in sync — chooses the drawer's desktop / tablet / phone layout. */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Model picker options, grouped by provider, with connection state. */
export function useModelOptions(current: string | undefined) {
  const models = useAiModels();
  const providers = useAiProviders();
  const groups = useMemo(() => {
    const list = (models.data ?? []).filter((m) => m.enabled !== false && m.type !== 'embedding');
    const byProvider = new Map<string, AIModelMetadata[]>();
    for (const m of list) byProvider.set(m.provider, [...(byProvider.get(m.provider) ?? []), m]);
    const out = [...byProvider.entries()].map(([provider, ms]) => {
      const p = providers.data?.find((x) => x.id === provider);
      const connected = !p || p.status === 'CONNECTED' || !p.requiresApiKey;
      return {
        label: `${p?.name ?? provider}${connected ? '' : ' — not connected'}`,
        options: ms.map((m) => ({
          value: m.model,
          label: m.name || m.model,
          description: [m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k context` : '', connected ? '' : 'Connect the provider to use it']
            .filter(Boolean)
            .join(' · '),
        })),
      };
    });
    if (current && !list.some((m) => m.model === current || m.id === current)) {
      out.unshift({ label: 'Current', options: [{ value: current, label: current, description: 'Not in this workspace’s model list' }] });
    }
    return out;
  }, [models.data, providers.data, current]);
  return { groups, isLoading: models.isLoading || providers.isLoading, error: models.error ?? providers.error, refetch: () => { void models.refetch(); void providers.refetch(); } };
}

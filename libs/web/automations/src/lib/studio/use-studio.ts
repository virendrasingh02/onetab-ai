import { agentStudioApi, automationsApi, queryKeys, workspaceApi } from '@org/api-client';
import type { AgentBlueprint, StudioAgentDetail, StudioAgentState } from '@org/types';
import { toast } from '@org/ui';
import { errorText } from '@org/web-ai';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

/** The Studio's data: home summary, catalog, agents, plans and runs. */

export function useStudioHome(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agentStudio.home(workspaceId ?? ''),
    queryFn: () => agentStudioApi.home(workspaceId as string),
    enabled: Boolean(workspaceId),
    // Live updates arrive over `ai.run.updated`; this is the fallback.
    refetchInterval: 60_000,
  });
}

export function useStudioCatalog(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agentStudio.catalog(workspaceId ?? ''),
    queryFn: () => agentStudioApi.catalog(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
}

export function useStudioAgents(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agentStudio.list(workspaceId ?? ''),
    queryFn: () => agentStudioApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });
}

export function useStudioAgent(workspaceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agentStudio.detail(workspaceId ?? '', id ?? ''),
    queryFn: () => agentStudioApi.get(workspaceId as string, id as string),
    enabled: Boolean(workspaceId && id && id !== 'new'),
  });
}

export function useAgentVersions(workspaceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.automations.versions(workspaceId ?? '', id ?? ''),
    queryFn: () => automationsApi.versions(workspaceId as string, id as string),
    enabled: Boolean(workspaceId && id),
  });
}

export function useAgentVersion(workspaceId: string | undefined, id: string | undefined, version: number | null) {
  return useQuery({
    queryKey: queryKeys.agentStudio.version(workspaceId ?? '', id ?? '', version ?? 0),
    queryFn: () => agentStudioApi.version(workspaceId as string, id as string, version as number),
    enabled: Boolean(workspaceId && id && version),
    staleTime: Infinity,
  });
}

/** "Build me an agent that…" → a plan. Nothing is saved. */
export function usePlanAgent(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: (input: { prompt: string; templateId?: string }) =>
      agentStudioApi.plan(workspaceId as string, {
        ...input,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    // The create page shows a failed plan inline, with a retry.
    meta: { disableToast: true },
  });
}

/** Save, switch on/off, duplicate and run — each keeps the Studio's lists in step. */
export function useStudioMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = workspaceId ?? '';
  const refreshAgent = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.agentStudio.list(ws) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.agentStudio.home(ws) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.automations.list(ws) });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentStudio.detail(ws, id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.automations.versions(ws, id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(ws, id) });
    }
  };
  const setDetail = (detail: StudioAgentDetail) => queryClient.setQueryData(queryKeys.agentStudio.detail(ws, detail.id), detail);

  const create = useMutation({
    mutationFn: (input: { blueprint: AgentBlueprint; activate?: boolean }) => agentStudioApi.create(ws, input),
    onSuccess: (detail) => {
      setDetail(detail);
      refreshAgent(detail.id);
    },
    onError: (err) => toast.error('Could not save the agent', { description: errorText(err) }),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; blueprint: AgentBlueprint; overwriteCanvasEdits?: boolean }) =>
      agentStudioApi.update(ws, input.id, { blueprint: input.blueprint, overwriteCanvasEdits: input.overwriteCanvasEdits }),
    onSuccess: (detail) => {
      setDetail(detail);
      refreshAgent(detail.id);
    },
  });

  const setState = useMutation({
    mutationFn: (input: { id: string; state: StudioAgentState }) => agentStudioApi.setState(ws, input.id, input.state),
    onSuccess: (result) => {
      refreshAgent(result.id);
      toast.success(
        result.state === 'active'
          ? 'Switched on — it runs on its trigger'
          : result.state === 'paused'
            ? 'Paused — it won’t run until you switch it on'
            : result.state === 'archived'
              ? 'Archived'
              : 'Restored',
      );
    },
    onError: (err) => toast.error('Could not change the agent', { description: errorText(err) }),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => agentStudioApi.duplicate(ws, id),
    onSuccess: (detail) => {
      setDetail(detail);
      refreshAgent(detail.id);
      toast.success(`Created “${detail.name}”`);
    },
    onError: (err) => toast.error('Could not duplicate the agent', { description: errorText(err) }),
  });

  const run = useMutation({
    mutationFn: (input: { id: string; text?: string; mode?: 'live' | 'test'; event?: Record<string, unknown> }) =>
      agentStudioApi.run(ws, input.id, { text: input.text, mode: input.mode, event: input.event }),
    onSuccess: (_started, input) => {
      refreshAgent(input.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiExecutions.all(ws) });
    },
    onError: (err) => toast.error('Could not start the run', { description: errorText(err) }),
  });

  const restoreVersion = useMutation({
    mutationFn: (input: { id: string; version: number }) => automationsApi.restoreVersion(ws, input.id, input.version),
    onSuccess: (_row, input) => {
      refreshAgent(input.id);
      toast.success(`Rolled back to v${input.version}`, { description: 'The plan, steps and permissions are as they were then.' });
    },
    onError: (err) => toast.error('Could not roll back', { description: errorText(err) }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => automationsApi.publish(ws, id),
    onSuccess: (version, id) => {
      refreshAgent(id);
      toast.success(`Published v${version.versionNumber}`);
    },
    onError: (err) => toast.error('Could not publish', { description: errorText(err) }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => automationsApi.remove(ws, id),
    onSuccess: () => {
      refreshAgent();
      toast.success('Agent deleted');
    },
    onError: (err) => toast.error('Could not delete the agent', { description: errorText(err) }),
  });

  return { create, update, setState, duplicate, run, restoreVersion, publish, remove };
}

const FAVORITES_KEY = 'agentStudioFavorites';

/** The agents this member starred — kept with their workspace preferences, so they follow them across devices. */
export function useAgentFavorites(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const key = queryKeys.workspaces.memberPreferences(workspaceId ?? '');
  const prefs = useQuery({
    queryKey: key,
    queryFn: () => workspaceApi.getMemberPreferences(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const favorites = useMemo(() => {
    const raw = prefs.data?.[FAVORITES_KEY];
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []);
  }, [prefs.data]);
  const save = useMutation({
    mutationFn: (next: string[]) => workspaceApi.saveMemberPreferences(workspaceId as string, { [FAVORITES_KEY]: next }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, unknown>>(key);
      queryClient.setQueryData(key, { ...(previous ?? {}), [FAVORITES_KEY]: next });
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Could not update favorites', { description: errorText(err) });
    },
  });
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save.mutate([...next]);
    },
    [favorites, save],
  );
  return { favorites, toggle };
}

import { agentsApi, aiMemoryApi, queryKeys } from '@org/api-client';
import { RealtimeEventType, useRealtime } from '@org/realtime';
import type { AgentRunProgressPayload } from '@org/realtime';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/** How long a finished run stays visible in the live panel before it drops
 *  off (the historical log table below has already picked it up by then). */
const COMPLETED_RUN_VISIBLE_MS = 6_000;

export interface LiveAgentRun extends AgentRunProgressPayload {
  updatedAt: number;
}

/**
 * Live, per-entity run status driven by `AIRuntimeService`'s
 * `agent.run_progress` broadcast — no polling. Powers the "Live runs" panel
 * on the monitoring view; a completed/failed run stays visible briefly, then
 * is dropped once the historical log table has caught up.
 */
export function useAgentRunProgress(workspaceId: string | undefined) {
  const { bus } = useRealtime();
  const queryClient = useQueryClient();
  const [runs, setRuns] = useState<Record<string, LiveAgentRun>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!workspaceId) return;

    const unsubscribe = bus.on<AgentRunProgressPayload>(
      RealtimeEventType.AgentRunProgress,
      (event) => {
        const payload = event.payload;
        if (!payload || payload.workspaceId !== workspaceId) return;

        setRuns((prev) => ({
          ...prev,
          [payload.entityId]: { ...payload, updatedAt: Date.now() },
        }));

        const existingTimer = timers.current[payload.entityId];
        if (existingTimer) clearTimeout(existingTimer);

        if (payload.status === 'completed' || payload.status === 'failed') {
          queryClient.invalidateQueries({
            queryKey: queryKeys.agents.workspaceLogs(workspaceId),
          });
          timers.current[payload.entityId] = setTimeout(() => {
            setRuns((prev) => {
              const next = { ...prev };
              delete next[payload.entityId];
              return next;
            });
          }, COMPLETED_RUN_VISIBLE_MS);
        }
      },
    );

    return () => {
      unsubscribe();
      for (const timer of Object.values(timers.current)) clearTimeout(timer);
      timers.current = {};
    };
  }, [bus, queryClient, workspaceId]);

  return runs;
}

/**
 * Whether an agent has been published from the AI Agent Studio
 * (`AgentsService.publishAgent` sets `configuration.status`;
 * `unpublishAgent` sets it back to `draft`).
 */
export function isAgentPublished(agent: { configuration?: unknown }): boolean {
  const config = agent.configuration;
  return (
    !!config &&
    typeof config === 'object' &&
    (config as { status?: unknown }).status === 'published'
  );
}

/**
 * The workspace's agents as the app shows them: only agents published from the
 * AI Agent Studio. Drafts stay in the Studio until someone publishes them.
 * Pass `includeDrafts` where a draft must still resolve (looking an agent up
 * by id, or the Studio's own pickers). Both share one cache entry.
 */
export function useAgents(
  workspaceId: string | undefined,
  options: { includeDrafts?: boolean } = {},
) {
  const includeDrafts = options.includeDrafts ?? false;
  return useQuery({
    queryKey: queryKeys.agents.list(workspaceId ?? ''),
    queryFn: () => agentsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
    // Publishing happens in the AI Agent Studio (another app): refresh on return.
    refetchOnWindowFocus: 'always',
    select: (agents) => (includeDrafts ? agents : agents.filter(isAgentPublished)),
  });
}

/**
 * The apps a published agent acts in and which of them the signed-in member
 * has connected. The agent uses *their* accounts, so this is per person.
 */
export function useAgentConnections(
  workspaceId: string | undefined,
  agentId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.agents.connections(workspaceId ?? '', agentId ?? ''),
    queryFn: () => agentsApi.connections(workspaceId as string, agentId as string),
    enabled: !!workspaceId && !!agentId,
    staleTime: 30_000,
    // They connect in the Integration Hub, then come back to this tab.
    refetchOnWindowFocus: 'always',
  });
}

export function useAgentLogs(
  workspaceId: string | undefined,
  agentId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.agents.logs(workspaceId ?? '', agentId ?? ''),
    queryFn: () => agentsApi.logs(workspaceId as string, agentId as string),
    enabled: !!workspaceId && !!agentId,
  });
}

/** Recent executions across every agent — powers the telemetry table. */
export function useWorkspaceAgentLogs(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.workspaceLogs(workspaceId ?? ''),
    queryFn: () => agentsApi.workspaceLogs(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

/** Workspace memory — facts saved by any agent/coworker's `save_memory` tool. */
/** One agent, fresh from the API — the profile panel's source of truth. */
export function useAgent(workspaceId: string | undefined, agentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.detail(workspaceId ?? '', agentId ?? ''),
    queryFn: () => agentsApi.get(workspaceId as string, agentId as string),
    enabled: !!workspaceId && !!agentId,
    staleTime: 15_000,
  });
}

/** Workspace memory, or only one agent's entries when `agentId` is given. */
export function useAiMemory(workspaceId: string | undefined, agentId?: string) {
  return useQuery({
    queryKey: agentId
      ? [...queryKeys.agents.memory(workspaceId ?? ''), agentId]
      : queryKeys.agents.memory(workspaceId ?? ''),
    queryFn: () => aiMemoryApi.list(workspaceId as string, agentId ? { agentId } : undefined),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useDeleteAiMemory(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => aiMemoryApi.delete(workspaceId as string, key),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.memory(workspaceId ?? '') }),
  });
}

export function useAgentMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.agents.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof agentsApi.create>[1]) =>
      agentsApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      agentId,
      input,
    }: {
      agentId: string;
      input: Parameters<typeof agentsApi.update>[2];
    }) => agentsApi.update(workspaceId as string, agentId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (agentId: string) =>
      agentsApi.remove(workspaceId as string, agentId),
    onSuccess: invalidate,
  });

  /** Running an agent writes an execution log, so the log view goes stale. */
  const execute = useMutation({
    mutationFn: ({
      agentId,
      promptText,
    }: {
      agentId: string;
      promptText: string;
    }) => agentsApi.execute(workspaceId as string, agentId, promptText),
    onSuccess: invalidate,
  });

  return { create, update, remove, execute };
}

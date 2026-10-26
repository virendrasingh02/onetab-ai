import { coworkersApi, queryKeys } from '@org/api-client';
import type { AICoworkerDetail, CoworkerRosterEntry } from '@org/types';
import { RealtimeEventType, useRealtime } from '@org/realtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

/** One coworker of the workspace: the same record the sidebar lists, plus its live roster numbers. */
export interface WorkspaceCoworker {
  id: string;
  name: string;
  role: string;
  description: string;
  avatarUrl: string | null;
  isActive: boolean;
  updatedAt?: string;
  /** Connectors, specialists, workflows and activity — absent until the roster loads. */
  roster?: CoworkerRosterEntry;
}

function trimText(value: string | null | undefined, fallback: string): string {
  const text = (value ?? '').trim();
  return text || fallback;
}

/**
 * The workspace's coworkers — the same API list the sidebar's "AI Coworkers"
 * section reads, enriched with the roster (connectors, specialists, workflows,
 * 30-day activity). The roster is optional: the list renders without it.
 */
export function useWorkspaceCoworkers(workspaceId: string) {
  const queryClient = useQueryClient();
  const { bus } = useRealtime();

  // Coworkers are built in the AI Agent Studio (another tab): refresh when a
  // coworker changes or a run finishes, and again when this tab regains focus.
  useEffect(() => {
    if (!workspaceId) return;
    const refresh = (event: { payload?: { workspaceId?: string } }) => {
      if (event.payload?.workspaceId === workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.coworkers.list(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.coworkers.roster(workspaceId),
        });
      }
    };
    const offs = [
      bus.on(RealtimeEventType.CoworkerExecutionCompleted, refresh),
      bus.on(RealtimeEventType.CoworkerStatusChanged, refresh),
    ];
    return () => offs.forEach((off) => off());
  }, [bus, queryClient, workspaceId]);

  const list = useQuery<AICoworkerDetail[]>({
    queryKey: queryKeys.coworkers.list(workspaceId),
    queryFn: () => coworkersApi.list(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
    refetchOnWindowFocus: 'always',
  });
  const roster = useQuery({
    queryKey: queryKeys.coworkers.roster(workspaceId),
    queryFn: () => coworkersApi.roster(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
    refetchOnWindowFocus: 'always',
  });

  const coworkers = useMemo<WorkspaceCoworker[]>(() => {
    const byId = new Map(
      (roster.data?.coworkers ?? []).map((entry) => [entry.id, entry]),
    );
    return (list.data ?? []).map((cw) => ({
      id: cw.id,
      name: cw.name,
      role: trimText(cw.role, 'AI coworker'),
      description: trimText(
        cw.description ?? cw.systemPrompt,
        'No description yet.',
      ),
      avatarUrl: cw.avatarUrl ?? null,
      isActive: cw.isActive,
      updatedAt: cw.updatedAt,
      roster: byId.get(cw.id),
    }));
  }, [list.data, roster.data]);

  return {
    coworkers,
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: () => {
      void list.refetch();
      void roster.refetch();
    },
  };
}

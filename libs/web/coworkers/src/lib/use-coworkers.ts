import { coworkersApi, queryKeys } from '@org/api-client';
import { RealtimeEventType } from '@org/realtime';
import { useRealtime } from '@org/realtime';
import type {
  AICoworkerDetail,
  CoworkerStatus,
} from '@org/types';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The workspace's own coworkers. */
export function useCoworkers(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { bus } = useRealtime();

  useEffect(() => {
    if (!workspaceId) return;

    const unsubCreated = bus.on(
      RealtimeEventType.CoworkerCreated,
      (event) => {
        if (event.payload?.workspaceId === workspaceId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.coworkers.all(workspaceId),
          });
        }
      },
    );

    const unsubUpdated = bus.on(
      RealtimeEventType.CoworkerUpdated,
      (event) => {
        if (event.payload?.workspaceId === workspaceId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.coworkers.all(workspaceId),
          });
        }
      },
    );

    const unsubDeleted = bus.on(
      RealtimeEventType.CoworkerDeleted,
      (event) => {
        if (event.payload?.workspaceId === workspaceId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.coworkers.all(workspaceId),
          });
        }
      },
    );

    const unsubStatus = bus.on<{
      coworkerId: string;
      workspaceId: string;
      status: CoworkerStatus;
    }>(
      RealtimeEventType.CoworkerStatusChanged,
      (event) => {
        if (event.payload?.workspaceId === workspaceId) {
          const { coworkerId, status } = event.payload;
          queryClient.setQueryData<AICoworkerDetail[]>(
            queryKeys.coworkers.list(workspaceId),
            (old) =>
              old?.map((cw) =>
                cw.id === coworkerId ? { ...cw, status } : cw,
              ),
          );
          queryClient.setQueryData<AICoworkerDetail>(
            queryKeys.coworkers.detail(workspaceId, coworkerId),
            (old) => (old ? { ...old, status } : old),
          );
        }
      },
    );

    const unsubExecution = bus.on(
      RealtimeEventType.CoworkerExecutionCompleted,
      (event) => {
        if (event.payload?.workspaceId === workspaceId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.coworkers.workspaceLogs(workspaceId),
          });
        }
      },
    );

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubStatus();
      unsubExecution();
    };
  }, [bus, queryClient, workspaceId]);

  return useQuery({
    queryKey: queryKeys.coworkers.list(workspaceId ?? ''),
    queryFn: () => coworkersApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

/** Individual coworker detail. */
export function useCoworker(
  workspaceId: string | undefined,
  coworkerId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.coworkers.detail(workspaceId ?? '', coworkerId ?? ''),
    queryFn: () => coworkersApi.get(workspaceId as string, coworkerId as string),
    enabled: !!workspaceId && !!coworkerId,
    staleTime: 15_000,
  });
}

/** Execution logs for a specific coworker. */
export function useCoworkerLogs(
  workspaceId: string | undefined,
  coworkerId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.coworkers.logs(workspaceId ?? '', coworkerId ?? ''),
    queryFn: () => coworkersApi.logs(workspaceId as string, coworkerId as string),
    enabled: !!workspaceId && !!coworkerId,
  });
}

/** Recent executions across all coworkers in the workspace. */
export function useWorkspaceCoworkerLogs(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coworkers.workspaceLogs(workspaceId ?? ''),
    queryFn: () => coworkersApi.workspaceLogs(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

/** Channel-scoped coworker memberships. */
export function useChannelCoworkers(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.coworkers.channelList(workspaceId ?? '', channelId ?? ''),
    queryFn: () =>
      coworkersApi.listChannelCoworkers(workspaceId as string, channelId as string),
    enabled: !!workspaceId && !!channelId,
    staleTime: 30_000,
  });
}

/** Project-scoped coworker memberships. */
export function useProjectCoworkers(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.coworkers.projectList(workspaceId ?? '', projectId ?? ''),
    queryFn: () =>
      coworkersApi.listProjectCoworkers(workspaceId as string, projectId as string),
    enabled: !!workspaceId && !!projectId,
    staleTime: 30_000,
  });
}

export function useCoworkerMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.coworkers.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof coworkersApi.create>[1]) =>
      coworkersApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      coworkerId,
      input,
    }: {
      coworkerId: string;
      input: Parameters<typeof coworkersApi.update>[2];
    }) => coworkersApi.update(workspaceId as string, coworkerId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (coworkerId: string) =>
      coworkersApi.remove(workspaceId as string, coworkerId),
    onSuccess: invalidate,
  });

  const execute = useMutation({
    mutationFn: ({
      coworkerId,
      promptText,
      channelId,
      projectId,
    }: {
      coworkerId: string;
      promptText: string;
      channelId?: string;
      projectId?: string;
    }) =>
      coworkersApi.execute(workspaceId as string, coworkerId, {
        promptText,
        channelId,
        projectId,
      }),
    onSuccess: (_, { coworkerId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.logs(workspaceId ?? '', coworkerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.workspaceLogs(workspaceId ?? ''),
      });
    },
  });

  const linkAgent = useMutation({
    mutationFn: ({
      coworkerId,
      agentId,
    }: {
      coworkerId: string;
      agentId: string;
    }) => coworkersApi.linkAgent(workspaceId as string, coworkerId, agentId),
    onSuccess: invalidate,
  });

  const unlinkAgent = useMutation({
    mutationFn: ({
      coworkerId,
      agentId,
    }: {
      coworkerId: string;
      agentId: string;
    }) => coworkersApi.unlinkAgent(workspaceId as string, coworkerId, agentId),
    onSuccess: invalidate,
  });

  const linkApp = useMutation({
    mutationFn: ({
      coworkerId,
      integrationId,
    }: {
      coworkerId: string;
      integrationId: string;
    }) => coworkersApi.linkApp(workspaceId as string, coworkerId, integrationId),
    onSuccess: invalidate,
  });

  const unlinkApp = useMutation({
    mutationFn: ({
      coworkerId,
      integrationId,
    }: {
      coworkerId: string;
      integrationId: string;
    }) => coworkersApi.unlinkApp(workspaceId as string, coworkerId, integrationId),
    onSuccess: invalidate,
  });

  // Channel memberships
  const addChannelCoworker = useMutation({
    mutationFn: ({
      channelId,
      coworkerId,
    }: {
      channelId: string;
      coworkerId: string;
    }) =>
      coworkersApi.addChannelCoworker(
        workspaceId as string,
        channelId,
        coworkerId,
      ),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.channelList(workspaceId ?? '', channelId),
      });
    },
  });

  const removeChannelCoworker = useMutation({
    mutationFn: ({
      channelId,
      coworkerId,
    }: {
      channelId: string;
      coworkerId: string;
    }) =>
      coworkersApi.removeChannelCoworker(
        workspaceId as string,
        channelId,
        coworkerId,
      ),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.channelList(workspaceId ?? '', channelId),
      });
    },
  });

  const setChannelCoworkerEnabled = useMutation({
    mutationFn: ({
      channelId,
      coworkerId,
      isEnabled,
    }: {
      channelId: string;
      coworkerId: string;
      isEnabled: boolean;
    }) =>
      coworkersApi.setChannelCoworkerEnabled(
        workspaceId as string,
        channelId,
        coworkerId,
        isEnabled,
      ),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.channelList(workspaceId ?? '', channelId),
      });
    },
  });

  // Project memberships
  const addProjectCoworker = useMutation({
    mutationFn: ({
      projectId,
      coworkerId,
    }: {
      projectId: string;
      coworkerId: string;
    }) =>
      coworkersApi.addProjectCoworker(
        workspaceId as string,
        projectId,
        coworkerId,
      ),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.projectList(workspaceId ?? '', projectId),
      });
    },
  });

  const removeProjectCoworker = useMutation({
    mutationFn: ({
      projectId,
      coworkerId,
    }: {
      projectId: string;
      coworkerId: string;
    }) =>
      coworkersApi.removeProjectCoworker(
        workspaceId as string,
        projectId,
        coworkerId,
      ),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.coworkers.projectList(workspaceId ?? '', projectId),
      });
    },
  });

  return {
    create,
    update,
    remove,
    execute,
    linkAgent,
    unlinkAgent,
    linkApp,
    unlinkApp,
    addChannelCoworker,
    removeChannelCoworker,
    setChannelCoworkerEnabled,
    addProjectCoworker,
    removeProjectCoworker,
  };
}

interface SidebarFavoritesStoreState {
  favoritesByWorkspace: Record<string, Record<string, string[]>>;
  toggleFavorite: (workspaceId: string, type: string, id: string) => void;
  isFavorite: (workspaceId: string, type: string, id: string) => boolean;
}

export const useSidebarCoworkerFavoritesStore = create<SidebarFavoritesStoreState>()(
  persist(
    (set, get) => ({
      favoritesByWorkspace: {},
      isFavorite: (workspaceId: string, type: string, id: string) => {
        if (!workspaceId) return false;
        return (
          get().favoritesByWorkspace[workspaceId]?.[type]?.includes(id) ?? false
        );
      },
      toggleFavorite: (workspaceId: string, type: string, id: string) => {
        if (!workspaceId) return;
        set((state) => {
          const currentWorkspace = state.favoritesByWorkspace[workspaceId] ?? {};
          const currentList = currentWorkspace[type] ?? [];
          const exists = currentList.includes(id);
          const nextList = exists
            ? currentList.filter((item) => item !== id)
            : [...currentList, id];

          if (exists) {
            toast.info('Removed Coworker from favorites');
          } else {
            toast.success('Added Coworker to favorites');
          }

          return {
            favoritesByWorkspace: {
              ...state.favoritesByWorkspace,
              [workspaceId]: {
                ...currentWorkspace,
                [type]: nextList,
              },
            },
          };
        });
      },
    }),
    {
      name: 'onetab-sidebar-favorites',
    },
  ),
);

export function useCoworkerFavorites(workspaceId: string | undefined) {
  const isFavorite = useSidebarCoworkerFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useSidebarCoworkerFavoritesStore(
    (s) => s.toggleFavorite,
  );
  const activeWorkspaceId = workspaceId ?? '';

  return {
    isFavorite: (coworkerId: string) =>
      isFavorite(activeWorkspaceId, 'coworker', coworkerId),
    toggleFavorite: (coworkerId: string) =>
      toggleFavorite(activeWorkspaceId, 'coworker', coworkerId),
  };
}


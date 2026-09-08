import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { intelligenceApi, queryKeys, workToolsApi } from '@org/api-client';
import type { AttentionItem, CatchUpSummary } from '@org/types';

export function useAttention(workspaceId: string | undefined) {
  return useQuery<AttentionItem[]>({
    queryKey: workspaceId ? queryKeys.intelligence.attention(workspaceId) : ['intelligence', 'none'],
    queryFn: () => (workspaceId ? intelligenceApi.attention(workspaceId) : Promise.resolve([])),
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
  });
}

export function useAttentionMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (workspaceId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.intelligence.attention(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.intelligence.catchUp(workspaceId),
      });
    }
  };

  const snoozeMutation = useMutation({
    mutationFn: ({
      itemKey,
      durationMinutes = 60,
    }: {
      itemKey: string;
      durationMinutes?: number;
    }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return intelligenceApi.snooze(workspaceId, itemKey, durationMinutes);
    },
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (itemKey: string) => {
      if (!workspaceId) throw new Error('Workspace required');
      return intelligenceApi.dismiss(workspaceId, itemKey);
    },
    onSuccess: invalidate,
  });

  const markCompleteMutation = useMutation({
    mutationFn: (taskId: string) => {
      if (!workspaceId) throw new Error('Workspace required');
      return workToolsApi.updateTask(workspaceId, taskId, {
        status: 'DONE',
      });
    },
    onSuccess: () => {
      invalidate();
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: ['tasks', workspaceId],
        });
      }
    },
  });

  return {
    snooze: snoozeMutation.mutateAsync,
    dismiss: dismissMutation.mutateAsync,
    markComplete: markCompleteMutation.mutateAsync,
    isSnoozing: snoozeMutation.isPending,
    isDismissing: dismissMutation.isPending,
    isCompleting: markCompleteMutation.isPending,
  };
}

export function useCatchUp(workspaceId: string | undefined) {
  return useQuery<CatchUpSummary | null>({
    queryKey: workspaceId ? queryKeys.intelligence.catchUp(workspaceId) : ['intelligence', 'catch-up', 'none'],
    queryFn: () => (workspaceId ? intelligenceApi.catchUp(workspaceId) : Promise.resolve(null)),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

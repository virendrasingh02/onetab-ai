import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contextLinksApi, queryKeys } from '@org/api-client';
import type {
  ContextOverviewDto,
  CreateCrossObjectLinkInput,
} from '@org/types';

export function useContextOverview(
  workspaceId: string | undefined,
  targetType: string | undefined,
  targetId: string | undefined,
) {
  return useQuery<ContextOverviewDto | null>({
    queryKey:
      workspaceId && targetType && targetId
        ? queryKeys.context.overview(workspaceId, targetType, targetId)
        : ['context', 'overview', 'none'],
    queryFn: () =>
      workspaceId && targetType && targetId
        ? contextLinksApi.getContext(workspaceId, targetType, targetId)
        : Promise.resolve(null),
    enabled: Boolean(workspaceId && targetType && targetId),
  });
}

export function useContextLinkMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const createLinkMutation = useMutation({
    mutationFn: (input: CreateCrossObjectLinkInput) => {
      if (!workspaceId) throw new Error('Workspace required');
      return contextLinksApi.createLink(workspaceId, input);
    },
    onSuccess: (_, variables) => {
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.context.overview(
            workspaceId,
            variables.sourceType,
            variables.sourceId,
          ),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.context.overview(
            workspaceId,
            variables.targetType,
            variables.targetId,
          ),
        });
      }
    },
  });

  return {
    createLink: createLinkMutation.mutateAsync,
    isCreatingLink: createLinkMutation.isPending,
  };
}

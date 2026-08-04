import { memberApi, queryKeys } from '@org/api-client';
import type { UpdateMemberRoleInput } from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export function useMemberSearch(
  workspaceId: string | undefined,
  query: string,
) {
  return useQuery({
    queryKey: queryKeys.members.search(workspaceId ?? '', query),
    queryFn: () => memberApi.search(workspaceId as string, query),
    enabled: !!workspaceId,
    // Search results age out quickly; keep them briefly to avoid refetch churn
    // while the user types.
    staleTime: 15_000,
  });
}

export function useMemberMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.members.all(workspaceId ?? ''),
    });

  const updateRole = useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: UpdateMemberRoleInput;
    }) => memberApi.updateRole(workspaceId as string, userId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (userId: string) =>
      memberApi.remove(workspaceId as string, userId),
    onSuccess: invalidate,
  });

  const leave = useMutation({
    mutationFn: () => memberApi.leave(workspaceId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
    },
  });

  return { updateRole, remove, leave };
}

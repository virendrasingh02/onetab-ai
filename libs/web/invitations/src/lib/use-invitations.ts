import { invitationApi, queryKeys } from '@org/api-client';
import type { InviteMembersInput } from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useInvitations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invitations.list(workspaceId ?? ''),
    queryFn: () => invitationApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export function useInvitationMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.invitations.all(workspaceId ?? ''),
    });

  const invite = useMutation({
    mutationFn: (input: InviteMembersInput) =>
      invitationApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) =>
      invitationApi.revoke(workspaceId as string, invitationId),
    onSuccess: invalidate,
  });

  return { invite, revoke };
}

/** Redeems an invitation token for the signed-in user. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => invitationApi.accept(token),
    onSuccess: () => {
      // The user just gained a workspace — the switcher must refetch.
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
    },
  });
}

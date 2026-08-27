import { invitationApi, queryKeys } from '@org/api-client';
import type {
  CreateInvitationLinkInput,
  InviteMembersInput,
  UpdateInvitationLinkInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useInvitations(
  workspaceId: string | undefined,
  filters?: { status?: string; search?: string; scope?: string },
) {
  return useQuery({
    queryKey: queryKeys.invitations.list(workspaceId ?? '', filters),
    queryFn: () =>
      invitationApi.list(workspaceId as string, filters),
    enabled: !!workspaceId,
  });
}

export function useInvitationLinks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invitations.links(workspaceId ?? ''),
    queryFn: () => invitationApi.listLinks(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invitations.preview(token ?? ''),
    queryFn: () => invitationApi.preview(token as string),
    enabled: !!token,
    retry: 1,
  });
}

export function useInvitationMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.invitations.all(workspaceId ?? ''),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.members.all(workspaceId ?? ''),
    });
  };

  const invite = useMutation({
    mutationFn: (input: InviteMembersInput) =>
      invitationApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const resend = useMutation({
    mutationFn: (invitationId: string) =>
      invitationApi.resend(workspaceId as string, invitationId),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) =>
      invitationApi.revoke(workspaceId as string, invitationId),
    onSuccess: invalidate,
  });

  // Link mutations
  const createLink = useMutation({
    mutationFn: (input: CreateInvitationLinkInput) =>
      invitationApi.createLink(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const updateLink = useMutation({
    mutationFn: ({
      linkId,
      input,
    }: {
      linkId: string;
      input: UpdateInvitationLinkInput;
    }) =>
      invitationApi.updateLink(workspaceId as string, linkId, input),
    onSuccess: invalidate,
  });

  const revokeLink = useMutation({
    mutationFn: (linkId: string) =>
      invitationApi.revokeLink(workspaceId as string, linkId),
    onSuccess: invalidate,
  });

  const regenerateLink = useMutation({
    mutationFn: (linkId: string) =>
      invitationApi.regenerateLink(workspaceId as string, linkId),
    onSuccess: invalidate,
  });

  return {
    invite,
    resend,
    revoke,
    createLink,
    updateLink,
    revokeLink,
    regenerateLink,
  };
}

/** Redeems an invitation token for the signed-in user. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => invitationApi.accept(token),
    onSuccess: () => {
      // The user just gained a workspace/channel — refetch workspaces & channels.
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.channels.all('') });
    },
  });
}

/** Declines an invitation. */
export function useDeclineInvitation() {
  return useMutation({
    mutationFn: (token: string) => invitationApi.decline(token),
  });
}

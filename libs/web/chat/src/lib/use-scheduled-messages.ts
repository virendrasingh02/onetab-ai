import { queryKeys, scheduledMessagesApi } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * A member's own scheduled sends for the workspace — server-persisted and
 * delivered by the API's per-minute sweep even if this browser is closed by
 * the time it's due. Replaces the previous `localStorage`-only stub in
 * `@org/chat-ui`, which could never actually fire once the tab that scheduled
 * it was gone.
 */
export function useScheduledMessages(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scheduledMessages.list(workspaceId ?? ''),
    queryFn: () => scheduledMessagesApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useScheduledMessageMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.scheduledMessages.list(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: {
      conversationId: string;
      channelName?: string;
      body: string;
      scheduledFor: string;
    }) => scheduledMessagesApi.create(workspaceId as string, input),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Could not schedule the message'),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { body?: string; scheduledFor?: string };
    }) => scheduledMessagesApi.update(workspaceId as string, id, input),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Could not reschedule the message'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      scheduledMessagesApi.cancel(workspaceId as string, id),
    onSuccess: () => {
      invalidate();
      toast.info('Scheduled message cancelled');
    },
    onError: () => toast.error('Could not cancel the scheduled message'),
  });

  return { create, update, cancel };
}

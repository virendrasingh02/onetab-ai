import { channelAgentsApi, queryKeys } from '@org/api-client';
import type { ChannelAgentView } from '@org/types';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * The AI agents added to a channel — persisted server-side in `ChannelAgent`
 * and read by `AgentMatrixBridgeService` to decide who may answer in the
 * channel's Matrix room. Replaces the browser-`localStorage` list that used to
 * live in `use-channel-agents-apps.ts`.
 */
export function useChannelAgents(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.channels.agents(workspaceId ?? '', channelId ?? ''),
    queryFn: () =>
      channelAgentsApi.list(workspaceId as string, channelId as string),
    enabled: !!workspaceId && !!channelId,
    staleTime: 30_000,
  });
}

export function useChannelAgentMutations(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.channels.agents(workspaceId ?? '', channelId ?? ''),
    });
  const seed = (rows: ChannelAgentView[]) =>
    queryClient.setQueryData(
      queryKeys.channels.agents(workspaceId ?? '', channelId ?? ''),
      rows,
    );

  const add = useMutation({
    mutationFn: (agentId: string) =>
      channelAgentsApi.add(workspaceId as string, channelId as string, agentId),
    onSuccess: (rows) => {
      seed(rows);
      toast.success('Agent added to channel');
    },
    onError: () => toast.error('Could not add the agent to this channel'),
  });

  const setEnabled = useMutation({
    mutationFn: ({
      agentId,
      isEnabled,
    }: {
      agentId: string;
      isEnabled: boolean;
    }) =>
      channelAgentsApi.setEnabled(
        workspaceId as string,
        channelId as string,
        agentId,
        isEnabled,
      ),
    onSuccess: (rows) => seed(rows),
    onError: () => toast.error('Could not update the agent'),
  });

  const remove = useMutation({
    mutationFn: (agentId: string) =>
      channelAgentsApi.remove(
        workspaceId as string,
        channelId as string,
        agentId,
      ),
    onSuccess: () => {
      invalidate();
      toast.info('Agent removed from channel');
    },
    onError: () => toast.error('Could not remove the agent'),
  });

  return { add, setEnabled, remove };
}

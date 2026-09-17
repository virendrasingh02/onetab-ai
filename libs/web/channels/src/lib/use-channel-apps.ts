import { channelAppsApi, queryKeys } from '@org/api-client';
import type { ChannelAppView } from '@org/types';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * The apps (`ExternalIntegration`) added to a channel — persisted
 * server-side in `ChannelIntegration` and read by `AppMatrixBridgeService`
 * to decide which connected app may act in the channel's Matrix room.
 */
export function useChannelApps(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.channels.apps(workspaceId ?? '', channelId ?? ''),
    queryFn: () =>
      channelAppsApi.list(workspaceId as string, channelId as string),
    enabled: !!workspaceId && !!channelId,
    staleTime: 30_000,
  });
}

export function useChannelAppMutations(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.channels.apps(workspaceId ?? '', channelId ?? ''),
    });
  const seed = (rows: ChannelAppView[]) =>
    queryClient.setQueryData(
      queryKeys.channels.apps(workspaceId ?? '', channelId ?? ''),
      rows,
    );

  const add = useMutation({
    mutationFn: (integrationId: string) =>
      channelAppsApi.add(
        workspaceId as string,
        channelId as string,
        integrationId,
      ),
    onSuccess: (rows) => {
      seed(rows);
      toast.success('App added to channel');
    },
    onError: () => toast.error('Could not add the app to this channel'),
  });

  const setEnabled = useMutation({
    mutationFn: ({
      integrationId,
      isEnabled,
    }: {
      integrationId: string;
      isEnabled: boolean;
    }) =>
      channelAppsApi.setEnabled(
        workspaceId as string,
        channelId as string,
        integrationId,
        isEnabled,
      ),
    onSuccess: (rows) => seed(rows),
    onError: () => toast.error('Could not update the app'),
  });

  const remove = useMutation({
    mutationFn: (integrationId: string) =>
      channelAppsApi.remove(
        workspaceId as string,
        channelId as string,
        integrationId,
      ),
    onSuccess: () => {
      invalidate();
      toast.info('App disconnected from channel');
    },
    onError: () => toast.error('Could not disconnect the app'),
  });

  return { add, setEnabled, remove };
}

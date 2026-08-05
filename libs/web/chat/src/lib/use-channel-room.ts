import { matrixApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMatrix } from './matrix-provider.js';

/**
 * Resolves the Matrix room backing a channel.
 *
 * Unlike the timeline — a push stream that would be wrong to model as a query —
 * this is a plain server resource, so it belongs in TanStack Query: the room id
 * is stable for the life of the channel and provisioning it on the first open
 * costs a round trip worth caching.
 *
 * Disabled until the Matrix client is connected, so a deployment without a
 * homeserver never provisions rooms it cannot use.
 */
export function useChannelRoom(channelId: string | undefined) {
  const { client, enabled } = useMatrix();

  const query = useQuery({
    queryKey: queryKeys.matrix.channelRoom(channelId ?? ''),
    queryFn: () => matrixApi.channelRoom(channelId as string),
    enabled: !!channelId && enabled && !!client,
    // The mapping does not change, so refetching on focus only adds load.
    staleTime: Infinity,
    retry: 1,
  });

  return {
    roomId: query.data?.roomId ?? null,
    isLoading: query.isLoading,
    error: query.isError
      ? 'This channel could not be connected to chat.'
      : null,
  };
}

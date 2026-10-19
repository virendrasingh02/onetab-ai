import { channelApi, matrixApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Conversation } from '../../../components/conversation';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui';
import { useMatrixClient } from '../../../lib/use-matrix';
import { useWorkspace } from '../../../lib/workspace';

export default function ChannelScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const channel = useQuery({
    queryKey: queryKeys.channels.detail(workspaceId, slug),
    queryFn: () => channelApi.bySlug(workspaceId, slug),
    enabled: Boolean(slug),
  });
  const matrix = useMatrixClient();

  const roomId = useQuery({
    queryKey: ['mobile', 'channel-room', channel.data?.id],
    enabled: Boolean(channel.data),
    staleTime: Infinity,
    queryFn: async () => {
      const current = channel.data;
      if (!current) throw new Error('Channel not loaded.');
      return (
        current.matrixRoomId ?? (await matrixApi.channelRoom(current.id)).roomId
      );
    },
  });

  const channelId = channel.data?.id;
  const markChannelRead = useCallback(() => {
    if (channelId)
      void channelApi.markRead(workspaceId, channelId).catch(() => undefined);
  }, [workspaceId, channelId]);

  const openThread = useCallback(
    (rootId: string) => {
      if (!roomId.data) return;
      router.push({
        pathname: '/thread/[rootId]',
        params: {
          rootId,
          roomId: roomId.data,
          title: channel.data ? `# ${channel.data.name}` : '',
          canPost: channel.data?.canPost === false ? '0' : '1',
          allowFiles: channel.data?.allowFileUploads === false ? '0' : '1',
        },
      });
    },
    [router, roomId.data, channel.data],
  );

  const title = channel.data ? `# ${channel.data.name}` : 'Channel';

  let body;
  if (
    channel.isPending ||
    matrix.isPending ||
    (channel.data && roomId.isPending)
  ) {
    body = <LoadingState label="Opening channel…" />;
  } else if (channel.error || matrix.error || roomId.error) {
    body = (
      <ErrorState
        error={channel.error ?? matrix.error ?? roomId.error}
        onRetry={() => {
          void channel.refetch();
          void matrix.refetch();
          void roomId.refetch();
        }}
      />
    );
  } else if (!matrix.client) {
    body = (
      <EmptyState
        icon="chatbubbles-outline"
        title="Chat isn't set up on this server"
        description="Ask your workspace admin to enable messaging."
      />
    );
  } else if (channel.data && roomId.data) {
    body = (
      <Conversation
        key={`${roomId.data}:${matrix.client.userId}`}
        client={matrix.client}
        roomId={roomId.data}
        canPost={channel.data.canPost}
        allowFiles={channel.data.allowFileUploads}
        onRead={markChannelRead}
        onOpenThread={openThread}
        onSessionInvalid={matrix.resetSession}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {body}
    </>
  );
}

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Conversation } from '../../../components/conversation';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui';
import { directRoomTitle } from '../../../lib/direct-rooms';
import { useDirectRooms } from '../../../lib/use-direct-rooms';
import { useMatrixClient } from '../../../lib/use-matrix';

/** A 1:1 or group direct message. */
export default function DirectMessageScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const matrix = useMatrixClient();
  // Usually a cache hit from the DM list; only used for the title.
  const rooms = useDirectRooms(matrix.client);
  const room = rooms.data?.find((r) => r.roomId === roomId);
  const title = room ? directRoomTitle(room) : 'Direct message';

  const openThread = useCallback(
    (rootId: string) =>
      router.push({
        pathname: '/thread/[rootId]',
        params: { rootId, roomId, title },
      }),
    [router, roomId, title],
  );

  let body;
  if (matrix.isPending) body = <LoadingState label="Opening conversation…" />;
  else if (matrix.error)
    body = (
      <ErrorState error={matrix.error} onRetry={() => void matrix.refetch()} />
    );
  else if (!matrix.client)
    body = (
      <EmptyState
        icon="chatbubbles-outline"
        title="Chat isn't set up on this server"
        description="Ask your workspace admin to enable messaging."
      />
    );
  else if (roomId)
    body = (
      <Conversation
        key={`${roomId}:${matrix.client.userId}`}
        client={matrix.client}
        roomId={roomId}
        onOpenThread={openThread}
        onSessionInvalid={matrix.resetSession}
      />
    );

  return (
    <>
      <Stack.Screen options={{ title }} />
      {body}
    </>
  );
}

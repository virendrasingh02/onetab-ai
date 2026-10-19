import { Stack, useLocalSearchParams } from 'expo-router';
import { Conversation } from '../../../components/conversation';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui';
import { useMatrixClient } from '../../../lib/use-matrix';

/** One thread (`m.thread` replies to `rootId`) in a channel or DM room. */
export default function ThreadScreen() {
  const { rootId, roomId, title, canPost, allowFiles } = useLocalSearchParams<{
    rootId: string;
    roomId: string;
    title?: string;
    canPost?: string;
    allowFiles?: string;
  }>();
  const matrix = useMatrixClient();

  let body;
  if (matrix.isPending) body = <LoadingState label="Opening thread…" />;
  else if (matrix.error)
    body = (
      <ErrorState error={matrix.error} onRetry={() => void matrix.refetch()} />
    );
  else if (!matrix.client || !roomId || !rootId)
    body = (
      <EmptyState
        icon="chatbubbles-outline"
        title="Thread unavailable"
        description="Open it again from the conversation."
      />
    );
  else
    body = (
      <Conversation
        key={`${roomId}:${rootId}:${matrix.client.userId}`}
        client={matrix.client}
        roomId={roomId}
        threadRootId={rootId}
        canPost={canPost !== '0'}
        allowFiles={allowFiles !== '0'}
        onSessionInvalid={matrix.resetSession}
      />
    );

  return (
    <>
      <Stack.Screen
        options={{ title: 'Thread', headerBackTitle: title || undefined }}
      />
      {body}
    </>
  );
}

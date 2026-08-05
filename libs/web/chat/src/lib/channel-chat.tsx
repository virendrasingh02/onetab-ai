import { ErrorState, LoadingState } from '@org/ui';
import { ChatPanel } from './chat-panel.js';
import { useMatrix } from './matrix-provider.js';
import { useChannelRoom } from './use-channel-room.js';

export interface ChannelChatProps {
  channelId: string;
  title: string;
  subtitle?: string;
}

/**
 * A channel's conversation, room resolution included.
 *
 * This is the seam that keeps Matrix out of `@org/web-channels`: that library
 * passes a channel id and gets a working conversation back, without learning
 * that rooms — or Matrix — exist.
 */
export function ChannelChat({ channelId, title, subtitle }: ChannelChatProps) {
  const { enabled } = useMatrix();
  const { roomId, isLoading, error } = useChannelRoom(channelId);

  // `ChatPanel` renders its own "not configured" state, so hand off early
  // rather than reporting a room failure the deployment was never going to have.
  if (!enabled) {
    return <ChatPanel roomId={null} title={title} subtitle={subtitle} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Chat unavailable for this channel"
        description={error}
      />
    );
  }

  if (isLoading || !roomId) {
    return <LoadingState label="Opening conversation…" />;
  }

  return <ChatPanel roomId={roomId} title={title} subtitle={subtitle} />;
}

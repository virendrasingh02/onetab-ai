import { ErrorState, LoadingState } from '@org/ui';
import { ChatPanel } from './chat-panel.js';
import { useMatrix } from './matrix-provider.js';
import { SampleChatPanel } from './mock/sample-chat-panel.js';
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
 *
 * It is also where a deployment without a homeserver falls back to sample data
 * instead of an empty state. The two panels render the same surface, so the
 * fallback is a change of data source, not a second design to keep in step.
 */
export function ChannelChat({ channelId, title, subtitle }: ChannelChatProps) {
  const { enabled } = useMatrix();
  const { roomId, isLoading, error } = useChannelRoom(channelId);

  if (!enabled) {
    return (
      <SampleChatPanel
        channelId={channelId}
        title={title}
        subtitle={subtitle}
      />
    );
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

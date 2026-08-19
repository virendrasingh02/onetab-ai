import { ErrorState, LoadingState } from '@org/ui';
import { ChatPanel } from './chat-panel.js';
import { useMatrix } from './matrix-provider.js';
import { useChannelRoom } from './use-channel-room.js';

export interface ChannelChatProps {
  channelId: string;
  title: string;
  subtitle?: string;
  /**
   * Element in the host page's channel header to render the conversation's
   * actions into. Passing it also drops the surface's own header, so the
   * channel is titled once rather than twice.
   */
  headerActionsSlot?: HTMLElement | null;
}

/**
 * A channel's conversation, room resolution included.
 *
 * This is the seam that keeps Matrix out of `@org/web-channels`: that library
 * passes a channel id and gets a working conversation back, without learning
 * that rooms — or Matrix — exist.
 *
 * A deployment with no homeserver falls through to `ChatPanel`, which says so.
 * This used to render a scripted sample conversation instead, which meant a
 * misconfigured deployment looked like a working one with other people's
 * messages in it.
 */
export function ChannelChat({
  channelId,
  title,
  subtitle,
  headerActionsSlot,
}: ChannelChatProps) {
  const { enabled } = useMatrix();
  const { roomId, isLoading, error } = useChannelRoom(channelId);

  // `ChatPanel` renders the "chat is not configured" state itself.
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

  return (
    <ChatPanel
      roomId={roomId}
      title={title}
      subtitle={subtitle}
      headerActionsSlot={headerActionsSlot}
    />
  );
}

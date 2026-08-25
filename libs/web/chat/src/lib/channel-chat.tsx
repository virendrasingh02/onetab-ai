import { ErrorState } from '@org/ui';
import { ChatPanel } from './chat-panel.js';
import type { ChatSurfaceWelcome } from './chat-surface.js';
import { useMatrix } from './matrix-provider.js';
import { useChannelRoom } from './use-channel-room.js';

export interface ChannelChatProps {
  channelId: string;
  title: string;
  subtitle?: string;
  workspaceId?: string;
  /**
   * Element in the host page's channel header to render the conversation's
   * actions into. Passing it also drops the surface's own header, so the
   * channel is titled once rather than twice.
   */
  headerActionsSlot?: HTMLElement | null;
  /**
   * Element inside the host page's own "⋯" menu to render the conversation's
   * menu entries into — pinned messages, today. See `ChatSurface`.
   */
  headerMenuSlot?: HTMLElement | null;
  /**
   * Off when the host lists the roster somewhere better — the channel page puts
   * it in the right rail's details panel, so the header does not repeat it.
   */
  showMembers?: boolean;
  /**
   * Channel metadata and setup actions for the block that introduces the
   * channel at the top of its timeline. Omitting it leaves the block out.
   */
  welcome?: ChatSurfaceWelcome;
  /**
   * Bumped by the host to ask the conversation to start a huddle.
   *
   * A counter rather than a boolean: the request has to be repeatable, and the
   * huddle's own state stays here in the surface where the bar that renders it
   * lives.
   */
  huddleRequest?: number;
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
  workspaceId,
  headerActionsSlot,
  headerMenuSlot,
  showMembers,
  welcome,
  huddleRequest,
}: ChannelChatProps) {
  const { enabled } = useMatrix();
  const { roomId, error } = useChannelRoom(channelId);

  // `ChatPanel` renders the "chat is not configured" state itself.
  if (!enabled) {
    return (
      <ChatPanel
        roomId={null}
        title={title}
        subtitle={subtitle}
        workspaceId={workspaceId}
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

  /*
   * `roomId` is null while it is still being resolved for `channelId` — on
   * every channel switch, not just the first visit. `ChatPanel` is rendered
   * through that rather than being swapped for a `LoadingState` here: the
   * header, composer and layout it draws are already fully known from the
   * props above even though the room is not yet, so replacing the whole
   * conversation for that gap would unmount and remount chrome that had
   * nothing to do with what was actually loading. `ChatPanel` shows the wait
   * inline instead — see its `isConnecting`.
   */
  return (
    <ChatPanel
      roomId={roomId}
      title={title}
      subtitle={subtitle}
      workspaceId={workspaceId}
      headerActionsSlot={headerActionsSlot}
      headerMenuSlot={headerMenuSlot}
      showMembers={showMembers}
      welcome={welcome}
      huddleRequest={huddleRequest}
    />
  );
}

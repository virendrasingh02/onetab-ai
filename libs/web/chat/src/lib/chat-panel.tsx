import { ConnectionBanner } from '@org/chat-ui';
import { Button, EmptyState, LoadingState } from '@org/ui';
import { MessageSquareOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ChatSurface } from './chat-surface.js';
import { useMatrix } from './matrix-provider.js';
import { usePresence, useRoom, useRoomActions } from './use-chat.js';

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

export interface ChatPanelProps {
  /** Matrix room backing the channel. Null while it is being provisioned. */
  roomId: string | null;
  title: string;
  subtitle?: string;
  /** Host-rendered element to portal the header actions into. See `ChatSurface`. */
  headerActionsSlot?: HTMLElement | null;
}

/**
 * The Matrix-backed conversation surface for a channel.
 *
 * It owns no layout of its own: everything visible comes from `ChatSurface`,
 * and this component's whole job is to bind that surface to a live room.
 */
export function ChatPanel({
  roomId,
  title,
  subtitle,
  headerActionsSlot,
}: ChatPanelProps) {
  const { client, status, enabled, error } = useMatrix();
  const room = useRoom(roomId ?? undefined);
  const actions = useRoomActions(roomId ?? undefined);

  // Pins and saved items have no Matrix account-data binding yet, so they live
  // here for the session. The surface does not care where they come from.
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const memberIds = useMemo(
    () => room.members.map((member) => member.userId),
    [room.members],
  );
  const presenceOf = usePresence(memberIds);

  const togglePin = useCallback(
    (eventId: string) => setPinnedIds((current) => toggle(current, eventId)),
    [],
  );
  const toggleSave = useCallback(
    (eventId: string) => setSavedIds((current) => toggle(current, eventId)),
    [],
  );

  if (!enabled) {
    return (
      <EmptyState
        size="lg"
        icon={<MessageSquareOff />}
        title="Chat is not configured"
        description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to turn on messaging."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        size="lg"
        icon={<MessageSquareOff />}
        title="Could not connect to chat"
        description={error}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }

  if (!client || !roomId)
    return <LoadingState fullPage label="Connecting to chat…" />;

  return (
    <ChatSurface
      title={title}
      subtitle={subtitle}
      headerActionsSlot={headerActionsSlot}
      isEncrypted={client.getRoom(roomId)?.isEncrypted ?? false}
      banner={<ConnectionBanner status={status} />}
      myUserId={client.getSession()?.userId}
      messages={room.messages}
      members={room.members}
      typingNames={room.typingNames}
      isLoading={room.isLoading}
      isLoadingOlder={room.isLoadingOlder}
      hasMore={room.hasMore}
      error={room.error}
      onLoadOlder={() => void room.loadOlder()}
      presenceOf={presenceOf}
      pinnedIds={pinnedIds}
      savedIds={savedIds}
      onSend={actions.send}
      onEdit={actions.edit}
      onDelete={actions.remove}
      onReact={actions.toggleReaction}
      onTyping={actions.setTyping}
      onAttach={actions.attach}
      onTogglePin={togglePin}
      onToggleSave={toggleSave}
    />
  );
}

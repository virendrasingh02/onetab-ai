import { Badge } from '@org/ui';
import { FlaskConical } from 'lucide-react';
import { ChatSurface } from '../chat-surface.js';
import { MOCK_USER_ID } from './mock-conversation.js';
import { useMockRoom } from './use-mock-room.js';

export interface SampleChatPanelProps {
  channelId: string;
  title: string;
  subtitle?: string;
}

/**
 * The channel conversation running on sample data.
 *
 * Shown when the deployment has no homeserver, which is every local checkout.
 * It renders the same `ChatSurface` as the live panel, so what is being
 * designed and reviewed here is the real thing — but the banner says so
 * plainly, because a conversation that looks live and is not is the one thing
 * this must never be mistaken for.
 */
export function SampleChatPanel({
  channelId,
  title,
  subtitle,
}: SampleChatPanelProps) {
  const room = useMockRoom(channelId, title);

  return (
    <ChatSurface
      title={title}
      subtitle={subtitle}
      isEncrypted
      myUserId={MOCK_USER_ID}
      banner={
        <div className="gap-2 px-4 py-1.5 text-xs flex shrink-0 items-center justify-center border-b border-border bg-surface-muted text-muted-foreground">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          <span>
            Sample conversation — nothing here is sent or stored. Connect a
            Matrix homeserver to use real messages.
          </span>
          <Badge variant="warning">Preview</Badge>
        </div>
      }
      messages={room.messages}
      members={room.members}
      typingNames={room.typingNames}
      isLoading={room.isLoading}
      isLoadingOlder={room.isLoadingOlder}
      hasMore={room.hasMore}
      error={room.error}
      onLoadOlder={() => void room.loadOlder()}
      // Presence has no source here, and a member list of grey dots reads as
      // broken rather than as sample data.
      presenceOf={() => 'online'}
      bookmarks={room.bookmarks}
      huddleParticipants={room.huddleParticipants}
      pinnedIds={room.pinnedIds}
      savedIds={room.savedIds}
      firstUnreadId={room.firstUnreadId}
      onSend={room.send}
      onEdit={room.edit}
      onDelete={room.remove}
      onReact={room.toggleReaction}
      onTyping={room.setTyping}
      onAttach={room.attach}
      onTogglePin={room.togglePin}
      onToggleSave={room.toggleSave}
    />
  );
}

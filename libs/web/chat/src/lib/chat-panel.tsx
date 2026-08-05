import {
  AttachmentRenderer,
  ChatBubble,
  ChatHeader,
  ChatLayout,
  ChatSearchPlaceholder,
  Composer,
  ConnectionBanner,
  MemberList,
  MessageList,
  ThreadPanel,
  TypingIndicator,
} from '@org/chat-ui';
import type { Message } from '@org/matrix-client';
import { Button, EmptyState, Hint, LoadingState } from '@org/ui';
import { MessageSquareOff, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useMatrix } from './matrix-provider.js';
import { usePresence, useRoom, useRoomActions } from './use-chat.js';

export interface ChatPanelProps {
  /** Matrix room backing the channel. Null while it is being provisioned. */
  roomId: string | null;
  title: string;
  subtitle?: string;
}

type SidePanel = 'none' | 'members' | 'thread' | 'search';

/**
 * The conversation surface for a channel.
 *
 * Composes the presentational pieces from `@org/chat-ui` with the live room
 * state; it owns no Matrix knowledge of its own beyond the domain model.
 */
export function ChatPanel({ roomId, title, subtitle }: ChatPanelProps) {
  const { client, status, enabled, error } = useMatrix();
  const room = useRoom(roomId ?? undefined);
  const actions = useRoomActions(roomId ?? undefined);

  const [panel, setPanel] = useState<SidePanel>('none');
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);

  const memberIds = useMemo(
    () => room.members.map((member) => member.userId),
    [room.members],
  );
  const presenceOf = usePresence(memberIds);

  const myMatrixId = client?.getSession()?.userId;

  const threadReplies = useMemo(
    () =>
      threadRootId
        ? room.messages.filter(
            (message) => message.threadRootId === threadRootId,
          )
        : [],
    [room.messages, threadRootId],
  );

  const threadRoot = useMemo(
    () => room.messages.find((message) => message.id === threadRootId) ?? null,
    [room.messages, threadRootId],
  );

  const renderMessage = useCallback(
    (message: Message, grouped: boolean) => (
      <ChatBubble
        message={message}
        isOwn={message.senderId === myMatrixId}
        isGrouped={grouped}
        threadReplyCount={
          room.messages.filter((m) => m.threadRootId === message.id).length
        }
        onReact={(key) =>
          void actions.toggleReaction(
            message.id,
            key,
            message.reactions.some(
              (reaction) => reaction.key === key && reaction.reactedByMe,
            ),
          )
        }
        onEdit={() => setEditing(message)}
        onDelete={() => void actions.remove(message.id)}
        onOpenThread={() => {
          setThreadRootId(message.threadRootId ?? message.id);
          setPanel('thread');
        }}
        attachmentSlot={
          message.attachment ? (
            <AttachmentRenderer
              attachment={message.attachment}
              kind={message.kind}
            />
          ) : null
        }
      />
    ),
    [actions, myMatrixId, room.messages],
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
    <ChatLayout
      banner={<ConnectionBanner status={status} />}
      header={
        <ChatHeader
          title={title}
          subtitle={subtitle}
          isEncrypted={client.getRoom(roomId)?.isEncrypted ?? false}
          memberCount={room.members.length}
          onToggleMembers={() =>
            setPanel((current) => (current === 'members' ? 'none' : 'members'))
          }
          actions={
            <Hint label="Search in conversation">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Search in conversation"
                onClick={() =>
                  setPanel((current) =>
                    current === 'search' ? 'none' : 'search',
                  )
                }
              >
                <Search />
              </Button>
            </Hint>
          }
        />
      }
      sidePanelTitle={
        panel === 'members'
          ? 'Members'
          : panel === 'search'
            ? 'Search'
            : 'Thread'
      }
      onCloseSidePanel={() => setPanel('none')}
      sidePanel={
        panel === 'members' ? (
          <MemberList members={room.members} presenceOf={presenceOf} />
        ) : panel === 'search' ? (
          <ChatSearchPlaceholder />
        ) : panel === 'thread' && threadRoot ? (
          <ThreadPanel
            replyCount={threadReplies.length}
            rootSlot={renderMessage(threadRoot, false)}
            repliesSlot={threadReplies.map((reply) => (
              <div key={reply.id}>{renderMessage(reply, false)}</div>
            ))}
            composerSlot={
              <Composer
                members={room.members}
                placeholder="Reply in thread…"
                onSend={(body) => actions.send(body, threadRoot.id)}
                onTyping={actions.setTyping}
                onAttach={(files) => void actions.attach(files, threadRoot.id)}
              />
            }
          />
        ) : null
      }
    >
      <MessageList
        messages={room.messages.filter((message) => !message.threadRootId)}
        isLoading={room.isLoading}
        isLoadingOlder={room.isLoadingOlder}
        hasMore={room.hasMore}
        error={room.error}
        onLoadOlder={() => void room.loadOlder()}
        renderMessage={renderMessage}
      />

      <TypingIndicator names={room.typingNames} />

      <Composer
        members={room.members}
        onTyping={actions.setTyping}
        onAttach={(files) => void actions.attach(files)}
        placeholder={editing ? 'Edit your message…' : `Message ${title}`}
        contextSlot={
          editing ? (
            <div className="mb-2 gap-2 px-2 py-1 text-xs flex items-center rounded-md bg-muted">
              <span className="flex-1 truncate">Editing: {editing.body}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            </div>
          ) : null
        }
        onSend={async (body) => {
          if (editing) {
            await actions.edit(editing.id, body);
            setEditing(null);
          } else {
            await actions.send(body);
          }
        }}
      />
    </ChatLayout>
  );
}

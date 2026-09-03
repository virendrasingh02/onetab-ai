import { integrationsApi, workToolsApi } from '@org/api-client';
import {
  ConnectionBanner,
  executeStructuredAction,
  type ActionExecutionContext,
  type ActionExecutionResult,
} from '@org/chat-ui';
import type {
  Message,
  StructuredChatMessage,
  StructuredMessageAction,
} from '@org/matrix-client';
import { Button, EmptyState, toast, useRightPanelStore } from '@org/ui';
import { MessageSquareOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatSurface, type ChatSurfaceWelcome } from './chat-surface.js';
import { useSavedIds, useToggleSaved } from './use-saved-messages.js';
import { useMatrix } from './matrix-provider.js';
import {
  usePresence,
  useRoom,
  useRoomActions,
  useRoomThreads,
} from './use-chat.js';

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

/**
 * The `customHandler` `executeStructuredAction` runs for an app's card
 * button — the real backend call the fallback `toast.success` used to stand
 * in for. `universal-card-renderer` already gated a confirmation dialog
 * before this ever runs for a `requiresConfirmation` action, so `confirm:
 * true` reflects a real "yes" from the person who clicked it — the server
 * still enforces this independently (`IntegrationsService.executeAction`
 * refuses a `requiresConfirmation` action without it, regardless of caller).
 */
async function runAppAction(
  workspaceId: string,
  action: StructuredMessageAction,
  context: ActionExecutionContext,
): Promise<ActionExecutionResult> {
  return integrationsApi.executeAction(workspaceId, context.appId as string, action.id, {
    input: (action.payload ?? {}) as Record<string, unknown>,
    confirm: true,
    roomId: context.roomId,
  });
}

export interface ChatPanelProps {
  /** Matrix room backing the channel. Null while it is being provisioned. */
  roomId: string | null;
  title: string;
  subtitle?: string;
  workspaceId?: string;
  /** Host-rendered element to portal the header actions into. See `ChatSurface`. */
  headerActionsSlot?: HTMLElement | null;
  /**
   * Element inside the host page's own "⋯" menu to render the conversation's
   * menu entries into — pinned messages, today. See `ChatSurface`.
   */
  headerMenuSlot?: HTMLElement | null;
  /** Off for direct messages, which have a fixed roster of two. */
  showMembers?: boolean;
  /**
   * Off for direct messages: Matrix DM rooms are encrypted by default, but
   * that is a transport detail, not something a DM's header should call out
   * the way a channel's would.
   */
  showEncryptedBadge?: boolean;
  /** Channel metadata for the welcome block. See `ChatSurface`. */
  welcome?: ChatSurfaceWelcome;
  /** Starts a huddle when it changes. See `ChatSurface`. */
  huddleRequest?: number;
  onCreateTask?: (message: Message) => void;
  onCreateDoc?: (message: Message) => void;
  onAskAI?: (message: Message) => void;
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
  workspaceId,
  headerActionsSlot,
  headerMenuSlot,
  showMembers = true,
  showEncryptedBadge = true,
  welcome,
  huddleRequest,
  onCreateTask,
  onCreateDoc,
  onAskAI,
}: ChatPanelProps) {
  const { client, status, enabled, error } = useMatrix();
  const room = useRoom(roomId ?? undefined);
  const actions = useRoomActions(roomId ?? undefined);
  const threads = useRoomThreads(roomId ?? undefined);

  /*
   * The URL is the source of truth for which thread is open and which message
   * is being jumped to — that is what makes a thread or a notification a
   * shareable link, and what lets browser back close the thread. `?thread=` and
   * `?msg=` are read here and handed to `ChatSurface`; opening or closing a
   * thread there writes the param back.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const threadParam = searchParams.get('thread');
  const messageParam = searchParams.get('msg');

  const handleThreadChange = useCallback(
    (threadRootId: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (threadRootId) next.set('thread', threadRootId);
          else next.delete('thread');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleThreadRead = useCallback(
    (threadRootId: string) => {
      if (client && roomId) void client.markThreadRead(roomId, threadRootId);
    },
    [client, roomId],
  );

  const unreadThreadRootIds = useMemo(
    () => threads.filter((thread) => thread.hasUnread).map((thread) => thread.rootId),
    [threads],
  );

  // Pins have no Matrix account-data binding yet, so they live here for the
  // session. The surface does not care where they come from.
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  /*
   * Saved items do outlive the visit: they are listed on the sidebar's Saved
   * page, which never opens this room. See `use-saved-messages`.
   */
  const savedIds = useSavedIds(roomId ?? undefined);
  const setSaved = useToggleSaved();

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
    (eventId: string) => {
      const message = room.messages.find((entry) => entry.id === eventId);
      if (!message || !roomId) return;

      setSaved(
        {
          id: eventId,
          roomId,
          channelName: title,
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatarUrl: message.senderAvatarUrl,
          body: message.body,
          sentAt: message.timestamp,
          savedAt: Date.now(),
        },
        savedIds.includes(eventId),
      );
    },
    [room.messages, roomId, title, savedIds, setSaved],
  );

  const handleAssignToMe = useCallback(
    async (message: Message) => {
      if (!workspaceId) {
        toast.error('Workspace context required');
        return;
      }
      const myUserId = client?.getSession()?.userId;
      try {
        const snippet =
          message.body.slice(0, 60).replace(/\n/g, ' ') || 'New Task';
        await workToolsApi.createTask(workspaceId, {
          title: snippet,
          description: `Created from message in #${title} by ${message.senderName}:\n\n${message.body}`,
          status: 'TODO',
          priority: 'MEDIUM',
          assigneeId: myUserId ?? undefined,
        });
        toast.success('Task assigned to you', {
          description: `"${snippet}" created and assigned to you.`,
        });
      } catch {
        toast.error('Failed to assign task');
      }
    },
    [workspaceId, client, title],
  );

  const handleCreateTask = useCallback(
    async (message: Message) => {
      if (onCreateTask) {
        onCreateTask(message);
        return;
      }
      if (!workspaceId) {
        toast.error('Workspace context required');
        return;
      }
      try {
        const snippet =
          message.body.slice(0, 60).replace(/\n/g, ' ') || 'New Task';
        await workToolsApi.createTask(workspaceId, {
          title: snippet,
          description: `Created from message in #${title} by ${message.senderName}:\n\n${message.body}`,
          status: 'TODO',
          priority: 'MEDIUM',
        });
        toast.success('Task created from message', {
          description: `"${snippet}" added to Tasks.`,
        });
      } catch {
        toast.error('Failed to create task from message');
      }
    },
    [onCreateTask, workspaceId, title],
  );

  const handleCreateDoc = useCallback(
    async (message: Message) => {
      if (onCreateDoc) {
        onCreateDoc(message);
        return;
      }
      if (!workspaceId) {
        toast.error('Workspace context required');
        return;
      }
      try {
        const docTitle = `Note from #${title} (${new Date().toLocaleDateString()})`;
        await workToolsApi.createDocument(workspaceId, {
          title: docTitle,
          content: message.body,
          kind: 'NOTE',
        });
        toast.success('Document created from message', {
          description: `"${docTitle}" added to Documents.`,
        });
      } catch {
        toast.error('Failed to create document from message');
      }
    },
    [onCreateDoc, workspaceId, title],
  );

  const handleAskAI = useCallback(
    (message: Message) => {
      if (onAskAI) {
        onAskAI(message);
        return;
      }
      useRightPanelStore.getState().setView('assistant');
      toast.info('AI Copilot ready', {
        description: `Context: "${message.body.slice(0, 50)}..."`,
      });
    },
    [onAskAI],
  );

  const handleAction = useCallback(
    async (message: Message, action: StructuredMessageAction) => {
      if (!client || !roomId) return;

      // Handle approval actions directly
      if (action.actionType === 'approval.approved' || action.id === 'approve') {
        if (message.structuredEvent?.type === 'mie.approval') {
          const updatedApproval = {
            ...message.structuredEvent,
            status: 'approved' as const,
            approverId: client.getSession()?.userId,
            decidedAt: Date.now(),
          };
          await client.updateStructuredMessage(roomId, message.id, updatedApproval);
          toast.success('Action approved and state updated.');
          return;
        }
      }

      if (action.actionType === 'approval.rejected' || action.id === 'reject') {
        if (message.structuredEvent?.type === 'mie.approval') {
          const updatedApproval = {
            ...message.structuredEvent,
            status: 'rejected' as const,
            approverId: client.getSession()?.userId,
            decidedAt: Date.now(),
          };
          await client.updateStructuredMessage(roomId, message.id, updatedApproval);
          toast.info('Action rejected.');
          return;
        }
      }

      // Handle form submission
      if (action.id === 'submit_form' && action.payload) {
        if (message.structuredEvent?.type === 'mie.form') {
          const updatedForm = {
            ...message.structuredEvent,
            status: 'submitted' as const,
            submittedValues: action.payload,
            submittedAt: Date.now(),
            submittedBy: client.getSession()?.userId,
          };
          await client.updateStructuredMessage(roomId, message.id, updatedForm);
          toast.success('Form response recorded.');
          return;
        }
      }

      // Handle universal card in-place action updates
      if (message.structuredEvent?.type === 'mie.card') {
        if (action.actionType === 'update_record' || action.id === 'toggle_done') {
          const prevData = message.structuredEvent.data || {};
          const isCompleted = Boolean(prevData['completed']);
          const updatedCard = {
            ...message.structuredEvent,
            data: {
              ...prevData,
              completed: !isCompleted,
            },
            actionResults: {
              ...(message.structuredEvent.actionResults || {}),
              [action.id]: {
                executedAt: Date.now(),
                executedBy: client.getSession()?.userId,
                success: true,
              },
            },
          };
          await client.updateStructuredMessage(roomId, message.id, updatedCard);
          toast.success('Card updated.');
          return;
        }
      }

      const context: ActionExecutionContext = {
        roomId,
        messageId: message.id,
        senderId: message.senderId,
        appId:
          message.structuredEvent?.type === 'mie.app.response'
            ? message.structuredEvent.appId
            : undefined,
        agentId:
          message.structuredEvent?.type === 'mie.ai.agent'
            ? message.structuredEvent.agentId
            : undefined,
      };

      await executeStructuredAction(
        action,
        context,
        context.appId && workspaceId
          ? (executedAction, executedContext) =>
              runAppAction(workspaceId, executedAction, executedContext)
          : undefined,
      );
    },
    [client, roomId, workspaceId],
  );

  const handleSendCard = useCallback(
    async (cardId: string, version: number, data: Record<string, unknown>) => {
      if (!client || !roomId) return;
      const cardMessage: StructuredChatMessage = {
        type: 'mie.card',
        cardId,
        version,
        data,
      };
      await client.sendStructuredMessage(roomId, cardMessage, {
        fallbackBody: `[Universal Card: ${cardId} (v${version})]`,
      });
    },
    [client, roomId],
  );

  const handleRetryAgent = useCallback(
    async (message: Message) => {
      if (!client || !roomId) return;
      if (message.structuredEvent?.type !== 'mie.ai.agent') return;

      /*
       * Re-running means asking the agent the same question again, not
       * cosmetically flipping this event back to `running` — that left the
       * room stuck showing "running" forever with nothing actually
       * happening, since nothing re-invoked the agent. Resending the human
       * message that triggered this turn as a new room message is what
       * actually does: `AgentMatrixBridgeService` on the API picks it up
       * through the same inbound path a fresh prompt would take.
       */
      const ownIndex = room.messages.findIndex((entry) => entry.id === message.id);
      const trigger = room.messages
        .slice(0, ownIndex === -1 ? undefined : ownIndex)
        .reverse()
        .find((entry) => entry.senderId !== message.senderId && !entry.structuredEvent);

      if (!trigger) {
        toast.error('Could not find the original message to retry.');
        return;
      }

      await client.sendMessage(roomId, trigger.body);
      toast.info('Re-running agent execution…');
    },
    [client, roomId, room.messages],
  );

  /*
   * "Mark as read" from the timeline's sticky new-messages bar. Sending a read
   * receipt for the newest event zeroes the room's unread count, which is what
   * both the unread divider and the sidebar's live activity dot read from.
   */
  const handleMarkRead = useCallback(() => {
    if (!client || !roomId) return;
    const last = room.messages.at(-1);
    if (last) void client.markRead(roomId, last.id);
  }, [client, roomId, room.messages]);

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

  /*
   * True while the room this `roomId` should resolve to is still being
   * provisioned — the gap between opening a channel/DM and its Matrix room
   * being known. `ChatSurface` renders through this rather than being
   * replaced by a full-page loader: the header, composer and layout are
   * already known (`title`, `subtitle`, …) even though the room is not, so
   * unmounting the whole surface for it would tear down and rebuild chrome
   * that had nothing to wait for. `MessageList` shows the wait inline. See
   * `ChannelChat` for the matching change one level up.
   */
  const isConnecting = !client || !roomId;

  return (
    <ChatSurface
      title={title}
      subtitle={subtitle}
      headerActionsSlot={headerActionsSlot}
      headerMenuSlot={headerMenuSlot}
      showMembers={showMembers}
      welcome={welcome}
      huddleRequest={huddleRequest}
      isEncrypted={
        showEncryptedBadge &&
        !!client &&
        !!roomId &&
        (client.getRoom(roomId)?.isEncrypted ?? false)
      }
      banner={<ConnectionBanner status={status} />}
      connectionState={status.state}
      myUserId={client?.getSession()?.userId}
      conversationId={roomId}
      messages={isConnecting ? [] : room.messages}
      members={isConnecting ? [] : room.members}
      typingNames={isConnecting ? [] : room.typingNames}
      isLoading={isConnecting || room.isLoading}
      isLoadingOlder={room.isLoadingOlder}
      hasMore={room.hasMore}
      error={room.error}
      onLoadOlder={() => void room.loadOlder()}
      presenceOf={presenceOf}
      pinnedIds={pinnedIds}
      savedIds={savedIds}
      deepLinkThreadId={threadParam}
      onDeepLinkThreadChange={handleThreadChange}
      deepLinkMessageId={messageParam}
      unreadThreadRootIds={unreadThreadRootIds}
      onThreadRead={handleThreadRead}
      onMarkRead={handleMarkRead}
      onSend={actions.send}
      onEdit={actions.edit}
      onDelete={actions.remove}
      onReact={actions.toggleReaction}
      onTyping={actions.setTyping}
      onAttach={actions.attach}
      onTogglePin={togglePin}
      onToggleSave={toggleSave}
      onAssignToMe={handleAssignToMe}
      onCreateTask={handleCreateTask}
      onCreateDoc={handleCreateDoc}
      onAskAI={handleAskAI}
      onAction={handleAction}
      onRetryAgent={handleRetryAgent}
      onSendCard={handleSendCard}
    />
  );
}

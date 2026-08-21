import { workToolsApi } from '@org/api-client';
import { ConnectionBanner, executeStructuredAction } from '@org/chat-ui';
import type { Message, StructuredMessageAction } from '@org/matrix-client';
import { Button, EmptyState, LoadingState, toast, useRightPanelStore } from '@org/ui';
import { MessageSquareOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ChatSurface, type ChatSurfaceWelcome } from './chat-surface.js';
import { useSavedIds, useToggleSaved } from './use-saved-messages.js';
import { useMatrix } from './matrix-provider.js';
import { usePresence, useRoom, useRoomActions } from './use-chat.js';

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

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
  welcome,
  huddleRequest,
  onCreateTask,
  onCreateDoc,
  onAskAI,
}: ChatPanelProps) {
  const { client, status, enabled, error } = useMatrix();
  const room = useRoom(roomId ?? undefined);
  const actions = useRoomActions(roomId ?? undefined);

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

      await executeStructuredAction(action, {
        roomId,
        messageId: message.id,
        senderId: message.senderId,
      });
    },
    [client, roomId],
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
        fallbackText: `[Universal Card: ${cardId} (v${version})]`,
      });
    },
    [client, roomId],
  );

  const handleRetryAgent = useCallback(
    async (message: Message) => {
      if (!client || !roomId) return;
      if (message.structuredEvent?.type === 'mie.ai.agent') {
        const runningEvent = {
          ...message.structuredEvent,
          status: 'running' as const,
          errorMessage: undefined,
        };
        await client.updateStructuredMessage(roomId, message.id, runningEvent);
        toast.info('Re-running agent execution…');
      }
    },
    [client, roomId],
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
      headerMenuSlot={headerMenuSlot}
      showMembers={showMembers}
      welcome={welcome}
      huddleRequest={huddleRequest}
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
      onCreateTask={handleCreateTask}
      onCreateDoc={handleCreateDoc}
      onAskAI={handleAskAI}
      onAction={handleAction}
      onRetryAgent={handleRetryAgent}
      onSendCard={handleSendCard}
    />
  );
}

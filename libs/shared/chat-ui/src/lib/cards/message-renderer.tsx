import type {
  Message,
  RoomKind,
  RoomMember,
  StructuredMessageAction,
  SystemEventEntity,
  WorkspacePolicy,
} from '@org/types';
import { memo, type ReactNode } from 'react';
import { ChatBubble } from '../chat-bubble.js';
import { AgentMessageCard } from './agent-message-card.js';
import { AppResponseCard } from './app-response-card.js';
import { ApprovalCard } from './approval-card.js';
import { FileResponseCard } from './file-response-card.js';
import { FormCard } from './form-card.js';
import { SystemEventCard } from './system-event-card.js';
import { SystemMessageCard } from './system-message-card.js';
import { UniversalCardRenderer } from './universal-card-renderer.js';
import { WorkflowCard } from './workflow-card.js';

export interface MessageRendererProps {
  message: Message;
  isOwn: boolean;
  isGrouped?: boolean;
  senderBadge?: ReactNode;
  avatarSlot?: ReactNode;
  attachmentSlot?: ReactNode;
  isPinned?: boolean;
  isSaved?: boolean;
  isHighlighted?: boolean;
  density?: 'comfy' | 'compact';
  mentionNames?: string[];
  threadReplyCount?: number;
  threadHasUnread?: boolean;
  threadParticipants?: RoomMember[];
  lastReplyAt?: number;
  onReact?: (key: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenThread?: () => void;
  onTogglePin?: () => void;
  onToggleSave?: () => void;
  onCopyLink?: () => void;
  onCopyText?: () => void;
  onForward?: () => void;
  onAssignToMe?: () => void;
  onCreateTask?: () => void;
  onCreateDoc?: () => void;
  onAskAI?: () => void;
  onViewContext?: () => void;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
  onRetry?: () => void;
  entityKind?: 'app' | 'doc' | 'task' | 'kanban' | 'agent' | 'thread';
  /** Whether the viewer can manage this conversation — gates a system
   * event's admin-only actions (delete/hide). */
  canManageConversation?: boolean;
  /** Holds `WorkspacePermission.MODERATE_MESSAGES` — may delete another
   * member's message, not just their own. */
  canModerateMessages?: boolean;
  /** `WorkspacePolicy.messageEditWindowMinutes` — null/unset means unlimited. */
  editWindowMinutes?: number | null;
  /** A system event's named entity (member/app/agent/coworker/channel) was
   * clicked — the host resolves it to a profile/details view. */
  onViewSystemEventEntity?: (entity: SystemEventEntity) => void;
  linkPreviewsEnabled?: boolean;
  workspacePolicy?: WorkspacePolicy;
  roomKind?: RoomKind;
  /** "Mark unread" from this message — see `ChatBubble`. */
  onMarkUnread?: () => void;
  /** "Remind me about this" with the chosen time — see `ChatBubble`. */
  onRemind?: (remindAt: Date) => void;
  /** Turns reply notifications for this message's thread off / on. */
  onToggleReplyNotifications?: () => void;
  replyNotificationsMuted?: boolean;
}

export const MessageRenderer = memo(function MessageRenderer(
  props: MessageRendererProps,
) {
  const {
    message,
    isHighlighted,
    onOpenThread,
    onToggleSave,
    isSaved,
    onAction,
    onRetry,
    onReact,
    onDelete,
    canManageConversation,
    onViewSystemEventEntity,
  } = props;
  const structured = message.structuredEvent;

  if (structured) {
    switch (structured.type) {
      case 'mie.ai.agent':
        return (
          <div className="px-4">
            <AgentMessageCard
              message={message}
              event={structured}
              isOwn={props.isOwn}
              isHighlighted={isHighlighted}
              onAction={onAction}
              onRetry={onRetry}
              onOpenThread={onOpenThread}
              onToggleSave={onToggleSave}
              isSaved={isSaved}
            />
          </div>
        );

      case 'mie.app.response':
        return (
          <div className="px-4">
            <AppResponseCard
              message={message}
              event={structured}
              isOwn={props.isOwn}
              isHighlighted={isHighlighted}
              onAction={onAction}
              onOpenThread={onOpenThread}
            />
          </div>
        );

      case 'mie.approval':
        return (
          <div className="px-4">
            <ApprovalCard
              message={message}
              event={structured}
              isOwn={props.isOwn}
              isHighlighted={isHighlighted}
              onAction={onAction}
            />
          </div>
        );

      case 'mie.form':
        return (
          <div className="px-4">
            <FormCard
              message={message}
              event={structured}
              isHighlighted={isHighlighted}
              onSubmit={(values) => {
                if (onAction) {
                  return onAction({
                    id: 'submit_form',
                    label: 'Submit Form',
                    payload: values,
                  });
                }
              }}
            />
          </div>
        );

      case 'mie.file':
        return (
          <div className="px-4">
            <FileResponseCard
              message={message}
              event={structured}
              isHighlighted={isHighlighted}
            />
          </div>
        );

      case 'mie.workflow':
        return (
          <div className="px-4">
            <WorkflowCard
              message={message}
              event={structured}
              isHighlighted={isHighlighted}
            />
          </div>
        );

      case 'mie.system':
        return (
          <div className="px-4">
            <SystemMessageCard
              message={message}
              event={structured}
              isHighlighted={isHighlighted}
              onAction={onAction}
            />
          </div>
        );

      case 'mie.system_event':
        return (
          <SystemEventCard
            message={message}
            event={structured}
            isHighlighted={isHighlighted}
            canManage={canManageConversation}
            onReact={onReact}
            onViewEntity={onViewSystemEventEntity}
            onDelete={onDelete}
          />
        );

      case 'mie.card':
        return (
          <div className="px-4">
            <UniversalCardRenderer
              cardId={structured.cardId}
              version={structured.version}
              data={structured.data}
              context={{
                surface: 'matrix',
                roomId: message.roomId,
                userId: message.senderId,
                messageId: message.id,
              }}
              isHighlighted={isHighlighted}
              onAction={(act, currentData) => {
                if (onAction) {
                  return onAction({
                    id: act.id,
                    label: act.label,
                    actionType: act.type,
                    payload: currentData,
                  });
                }
              }}
            />
          </div>
        );
    }
  }

  // Standard fallback to ChatBubble for standard Matrix messages
  return <ChatBubble {...props} />;
});

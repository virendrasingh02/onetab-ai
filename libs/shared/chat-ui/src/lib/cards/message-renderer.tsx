import type {
  Message,
  RoomMember,
  StructuredMessageAction,
} from '@org/types';
import { memo, type ReactNode } from 'react';
import { ChatBubble } from '../chat-bubble.js';
import { AgentMessageCard } from './agent-message-card.js';
import { AppResponseCard } from './app-response-card.js';
import { ApprovalCard } from './approval-card.js';
import { FileResponseCard } from './file-response-card.js';
import { FormCard } from './form-card.js';
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
  onCreateTask?: () => void;
  onCreateDoc?: () => void;
  onAskAI?: () => void;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
  onRetry?: () => void;
}

export const MessageRenderer = memo(function MessageRenderer(
  props: MessageRendererProps,
) {
  const { message, isHighlighted, onOpenThread, onToggleSave, isSaved, onAction, onRetry } = props;
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

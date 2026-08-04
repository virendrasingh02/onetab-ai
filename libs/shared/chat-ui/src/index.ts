/**
 * @org/chat-ui — presentational chat components.
 *
 * Same contract as @org/ui: props in, callbacks out, no data fetching. These
 * live in their own library because they speak the chat domain model from
 * @org/matrix-client, which general-purpose UI should not depend on.
 */

export {
  ChatBubble,
  DateSeparator,
  type ChatBubbleProps,
} from './lib/chat-bubble.js';

export {
  Composer,
  EmojiPicker,
  type ComposerProps,
  type EmojiPickerProps,
} from './lib/composer.js';

export {
  AttachmentCard,
  AttachmentRenderer,
  ImagePreview,
  VideoPreview,
  VoiceMessage,
  type AttachmentCardProps,
  type ImagePreviewProps,
  type VoiceMessageProps,
} from './lib/attachments.js';

export {
  ConnectionBanner,
  EncryptionBadge,
  MemberList,
  PresenceBadge,
  TypingIndicator,
  type ConnectionBannerProps,
  type MemberListProps,
  type TypingIndicatorProps,
} from './lib/indicators.js';

export {
  MessageList,
  buildRows,
  type MessageListProps,
} from './lib/message-list.js';

export {
  ChatHeader,
  ChatLayout,
  ChatSearchPlaceholder,
  ThreadPanel,
  type ChatHeaderProps,
  type ChatLayoutProps,
  type ThreadPanelProps,
} from './lib/chat-layout.js';

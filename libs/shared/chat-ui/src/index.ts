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
  ReactionPicker,
  formatShortTimestamp,
  formatFullTimestamp,
  type ChatBubbleProps,
} from './lib/chat-bubble.js';

export {
  UserProfileCard,
  UserProfileRightPanel,
  type UserProfileCardProps,
} from './lib/user-profile-card.js';

export {
  Composer,
  DEFAULT_SLASH_COMMANDS,
  type ComposerProps,
  type SlashCommand,
} from './lib/composer.js';

export {
  DiscordEmojiGifPicker,
  EMOJI_CATEGORIES,
  POPULAR_GIFS,
  type DiscordEmojiGifPickerProps,
  type EmojiCategory,
  type GifItem,
} from './lib/discord-emoji-gif-picker.js';

export {
  LexicalComposerInput,
  LexicalToolbar,
  type LexicalComposerInputProps,
  type LexicalEditorRef,
} from './lib/lexical-composer.js';

export {
  AddBookmarkDialog,
  type AddBookmarkDialogProps,
} from './lib/add-bookmark-dialog.js';

export {
  BookmarksBar,
  ConversationSearch,
  HuddleBar,
  PinnedPanel,
  SavedPanel,
  ThreadListPanel,
  UnreadDivider,
  type BookmarksBarProps,
  type ChannelBookmark,
  type ConversationSearchProps,
  type HuddleBarProps,
  type PinnedPanelProps,
  type SavedPanelProps,
  type ThreadListPanelProps,
  type ThreadSummaryItem,
} from './lib/channel-extras.js';

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
  getUserColor,
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

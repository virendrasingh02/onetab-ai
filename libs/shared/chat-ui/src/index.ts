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

export { Composer, type ComposerProps } from './lib/composer.js';
export {
  useDraftsStore,
  type ConversationDraft,
} from './lib/drafts-store.js';

export {
  DEFAULT_SLASH_COMMANDS,
  type SlashCommand,
} from './lib/slash-commands.js';

export {
  ChannelWelcome,
  type ChannelWelcomeProps,
} from './lib/channel-welcome.js';

export {
  MarkdownMessage,
  type MarkdownMessageProps,
} from './lib/markdown-message.js';

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
  type MentionCandidate,
} from './lib/lexical-composer.js';

export { CHAT_TRANSFORMERS } from './lib/lexical-markdown.js';

export {
  $createCommandNode,
  $createMentionNode,
  $getChipTarget,
  $isCommandNode,
  $isMentionNode,
  CommandNode,
  MentionNode,
} from './lib/lexical-nodes.js';

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
  MediaPreview,
  PdfPreviewCard,
  VideoPreview,
  VoiceMessage,
  type AttachmentCardProps,
  type ImagePreviewProps,
  type MediaPreviewProps,
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

export {
  AIErrorRow,
  AIMessage,
  AIThinkingRow,
  type AIDensity,
  type AIErrorRowProps,
  type AIMessageProps,
  type AITranscriptMessage,
} from './lib/ai-message.js';

/* --- Rich Message Cards --- */
export {
  MessageRenderer,
  type MessageRendererProps,
} from './lib/cards/message-renderer.js';

export {
  AgentMessageCard,
  formatDuration,
  type AgentMessageCardProps,
} from './lib/cards/agent-message-card.js';

export {
  AppResponseCard,
  type AppResponseCardProps,
} from './lib/cards/app-response-card.js';

export {
  appCardRegistry,
  type CustomAppCardRenderer,
} from './lib/cards/app-card-registry.js';

export {
  ApprovalCard,
  type ApprovalCardProps,
} from './lib/cards/approval-card.js';

export {
  FormCard,
  type FormCardProps,
} from './lib/cards/form-card.js';

export {
  WorkflowCard,
  type WorkflowCardProps,
} from './lib/cards/workflow-card.js';

export {
  FileResponseCard,
  type FileResponseCardProps,
} from './lib/cards/file-response-card.js';

export {
  SystemMessageCard,
  type SystemMessageCardProps,
} from './lib/cards/system-message-card.js';

export {
  UniversalCardRenderer,
  type UniversalCardRendererProps,
} from './lib/cards/universal-card-renderer.js';

export {
  SendCardDialog,
  type SendCardDialogProps,
} from './lib/cards/send-card-dialog.js';

export {
  useCardRegistryStore,
  SYSTEM_CARD_TEMPLATES,
  type CardRegistryState,
} from './lib/cards/card-registry-store.js';

export {
  evaluateTemplate,
  evaluateCondition,
  applyFilter,
  getNestedValue,
} from './lib/cards/card-evaluator.js';

export {
  CardSettingsDialog,
  type CardSettingsDialogProps,
} from './lib/cards/card-settings-dialog.js';

export {
  useAICardPreferencesStore,
  DEFAULT_AI_CARD_PREFERENCES,
  type AICardPreferences,
  type AICardPreferencesState,
  type CardDensity,
} from './lib/cards/card-preferences-store.js';

export {
  executeStructuredAction,
  isActionSensitive,
  type ActionExecutionContext,
  type ActionExecutionResult,
  type ActionHandlerFn,
} from './lib/cards/action-handler.js';

/* --- Entity Management Primitives --- */
export {
  ChatEntityManager,
  type ChatEntityManagerProps,
} from './lib/entities/chat-entity-manager.js';

export {
  ChannelGroup,
  type ChannelGroupProps,
} from './lib/entities/channel-group.js';

export {
  EntityList,
  type EntityListProps,
} from './lib/entities/entity-list.js';

export {
  EntityItem,
  type EntityItemProps,
} from './lib/entities/entity-item.js';

export {
  EntityActions,
  type EntityActionsProps,
} from './lib/entities/entity-actions.js';

export {
  EntityPreviewDrawer,
  type EntityPreviewDrawerProps,
} from './lib/entities/entity-preview-drawer.js';

export {
  type ChatAppEntity,
  type ChannelEntityGroup,
  type EntityActionHandlers,
  type EntityKind,
} from './lib/entities/types.js';


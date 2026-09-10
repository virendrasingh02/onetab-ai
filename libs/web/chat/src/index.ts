export { MatrixProvider, useMatrix } from './lib/matrix-provider.js';
export { AuthenticatedMediaBridge } from './lib/authenticated-media-bridge.js';
export { CallModal } from './lib/call-modal.js';
export { CallOverlayBridge } from './lib/call-overlay-bridge.js';
export { useCall, type UseCallResult } from './lib/use-call.js';
export {
  NotificationSoundBridge,
  type NotificationSoundBridgeProps,
} from './lib/notification-sound-bridge.js';
export {
  setActiveConversation,
  getActiveConversation,
  subscribeActiveConversation,
  useRegisterActiveConversation,
} from './lib/active-conversation.js';
export {
  useGroupDirectMessages,
  usePresence,
  useRoom,
  useRoomActions,
  useRoomSummary,
  useRoomThreads,
  type GroupDirectMessageSummary,
  type RoomSummary,
} from './lib/use-chat.js';
export { useChannelRoom } from './lib/use-channel-room.js';
export { useDirectRoom } from './lib/use-direct-room.js';
export {
  useLiveRoomActivity,
  type LiveRoomActivity,
  type RoomActivityEntry,
} from './lib/use-live-room-activity.js';
export {
  useUnreadMentions,
  selectNextUnreadMention,
  type UnreadMentionsState,
  type UseUnreadMentionsOptions,
} from './lib/use-unread-mentions.js';
export {
  useMentionNavigation,
  type MentionNavigation,
  type UseMentionNavigationParams,
} from './lib/use-mention-navigation.js';
export {
  useMessageScrollTarget,
  type ScrollToMessageOptions,
  type UseMessageScrollTargetParams,
} from './lib/use-message-scroll-target.js';
export {
  useCreateConversation,
  type CreatedConversation,
  type CreateConversationInput,
} from './lib/use-create-conversation.js';
export { PeoplePicker, type PeoplePickerProps } from './lib/people-picker.js';
export {
  GroupConversation,
  type GroupConversationProps,
} from './lib/GroupConversation.js';
export {
  useAllThreads,
  type CrossRoomThread,
  type ThreadParticipant,
} from './lib/use-all-threads.js';
export {
  useThreadConversation,
  type ThreadConversation,
} from './lib/use-thread-conversation.js';
export {
  useWorkspaceRoomFiles,
  type RoomFile,
} from './lib/use-workspace-room-files.js';
export {
  ConversationFilesPanel,
  ConversationTabsShell,
  type ConversationFilesPanelProps,
  type ConversationTabsShellProps,
} from './lib/conversation-files-panel.js';
export { ChatPanel, type ChatPanelProps } from './lib/chat-panel.js';
export {
  ChatSurface,
  type ChatSurfaceProps,
  type ChatSurfaceWelcome,
  type ConversationMentions,
} from './lib/chat-surface.js';
export { ChannelChat, type ChannelChatProps } from './lib/channel-chat.js';
export {
  ChannelMentions,
  ChannelThreads,
  type ChannelActivityProps,
} from './lib/channel-activity-views.js';
export {
  deriveMentions,
  deriveThreads,
  groupReplies,
  type ChannelMention,
} from './lib/derive-threads.js';
export {
  DirectMessagesView,
} from './lib/DirectMessagesView.js';
export {
  useDirectMessagePreferences,
  useDirectMessagePreferencesStore,
  type DirectMessagePreferences,
} from './lib/use-dm-preferences.js';
export { useDirectMessageBookmarks } from './lib/use-dm-bookmarks.js';
export { ThreadsView } from './lib/ThreadsView.js';
export { SavedView } from './lib/SavedView.js';
export {
  useSavedIds,
  useSavedMessagesStore,
  useToggleSaved,
  type SavedMessage,
} from './lib/use-saved-messages.js';
export {
  useBookmarks,
  useBookmarkMutations,
} from './lib/use-bookmarks.js';
export { EncryptionSecurityPanel } from './lib/encryption-security-panel.js';


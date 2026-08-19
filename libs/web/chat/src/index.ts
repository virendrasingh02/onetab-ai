export { MatrixProvider, useMatrix } from './lib/matrix-provider.js';
export { usePresence, useRoom, useRoomActions } from './lib/use-chat.js';
export { useChannelRoom } from './lib/use-channel-room.js';
export { useDirectRoom } from './lib/use-direct-room.js';
export {
  useAllThreads,
  type CrossRoomThread,
} from './lib/use-all-threads.js';
export { ChatPanel, type ChatPanelProps } from './lib/chat-panel.js';
export {
  ChatSurface,
  type ChatSurfaceProps,
  type ChatSurfaceWelcome,
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
export { DirectMessagesView } from './lib/DirectMessagesView.js';
export {
  useDirectMessagePreferences,
  useDirectMessagePreferencesStore,
  type DirectMessagePreferences,
} from './lib/use-dm-preferences.js';
export { ThreadsView } from './lib/ThreadsView.js';

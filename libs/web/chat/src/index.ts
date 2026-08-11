export { MatrixProvider, useMatrix } from './lib/matrix-provider.js';
export { usePresence, useRoom, useRoomActions } from './lib/use-chat.js';
export { useChannelRoom } from './lib/use-channel-room.js';
export { ChatPanel, type ChatPanelProps } from './lib/chat-panel.js';
export { ChatSurface, type ChatSurfaceProps } from './lib/chat-surface.js';
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
  type DirectConversation,
} from './lib/DirectMessagesView.js';
export { ThreadsView, type ThreadSummary } from './lib/ThreadsView.js';

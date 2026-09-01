export { NotificationBadge } from './lib/notification-badge.js';

export {
  NotificationAvatar,
  type NotificationAvatarProps,
} from './lib/notification-avatar.js';

export {
  NotificationBell,
  type NotificationBellProps,
} from './lib/notification-bell.js';

export {
  useNotificationList,
  useNotificationMutations,
  useNotificationUnreadCount,
} from './lib/use-notification-center.js';

export {
  NotificationEnableBar,
  useNotificationPermissionBar,
  type NotificationEnableBarProps,
  type UseNotificationPermissionBarReturn,
} from './lib/notification-enable-bar.js';

export {
  useChannelActivity,
  useMarkChannelSeen,
  useMarkChannelUnread,
  useNotificationFeed,
  useNotificationPreferenceMutations,
  useNotificationPreferences,
  useNotificationUnread,
  usePushDeviceMutations,
  usePushDevices,
  useWorkspaceActivity,
  type ActivityIndicator,
  type NotificationUnread,
} from './lib/use-notifications.js';

export {
  notificationService,
  type NotificationPayload,
  type NotificationResult,
} from './lib/notification-service.js';

export {
  setActiveCallState,
  isCallOrMeetingActive,
  subscribeActiveCallState,
} from './lib/active-call-detector.js';


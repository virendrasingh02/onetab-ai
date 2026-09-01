import type { IsoDateString, ThemeConfig } from './entities.js';

export type MessageDensity = 'comfy' | 'compact';
export type OpenChatPosition = 'last-read' | 'newest';
export type NotificationPosition =
  | 'bottom-right'
  | 'top-right'
  | 'bottom-left'
  | 'top-left';
export type NotificationSize = 'comfy' | 'compact';
export type NotificationDismissDuration =
  | 3000
  | 5000
  | 10000
  | 15000
  | 30000
  | null;

export interface ChatPreferences {
  messageDensity: MessageDensity;
  openPosition: OpenChatPosition;
  readReceipts: boolean;
}

export interface NotificationDisplayPreferences {
  showContentPreview: boolean;
  showDuringCalls: boolean;
  flashTaskbar: boolean;
  dismissDuration: NotificationDismissDuration;
  position: NotificationPosition;
  size: NotificationSize;
}

export interface UserPreferences {
  chat: ChatPreferences;
  notifications: NotificationDisplayPreferences;
  theme?: ThemeConfig;
}

export interface NotificationPreference {
  /** Null until the user saves — reads return schema defaults, not a row. */
  id: string | null;
  userId: string;
  workspaceId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  /** Notify only on direct mentions rather than every message. */
  mentionsOnly: boolean;
  mutedChannelIds: string[];
  /** Local time, e.g. "22:00". */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

/** A row in the Inbox's notification feed. */
export interface ActivityFeedItem {
  id: string;
  kind: string;
  occurredAt: IsoDateString;
  /**
   * Whether the row named the signed-in user. Resolved server-side per caller,
   * which is what lets the sidebar show a red dot for "someone called you" and
   * a grey one for everything else.
   */
  isMention: boolean;
  /** Pre-rendered one-liner for non-chat rows ("created task WEB-42"). Null for
   *  chat rows, which the client renders from the channel. */
  summary: string | null;
  /** The subject the row is about, so a click can deep-link it. */
  resourceType: string | null;
  resourceId: string | null;
  /** For chat rows: the Matrix event id, so a click jumps to the message
   *  (`c/<slug>?msg=<id>`). Null for non-chat rows. */
  messageEventId: string | null;
  channel: { id: string; name: string; slug: string } | null;
  user: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export type NotificationKind =
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'MENTION'
  | 'CHANNEL_INVITE'
  | 'WORKSPACE_INVITE'
  | 'PROJECT_CREATED'
  | 'DOCUMENT_SHARED'
  | 'SYSTEM';

export interface NotificationWorkspaceInfo {
  id: string;
  name: string;
  slug?: string;
  avatarUrl?: string | null;
  icon?: string | null;
  iconColor?: string | null;
}

/**
 * One row in the bell menu — a notification addressed to the signed-in user,
 * with server-side read state (unlike {@link ActivityFeedItem}, which is a
 * workspace-wide log).
 */
export interface NotificationView {
  id: string;
  workspaceId: string;
  kind: NotificationKind | string;
  title: string;
  body: string | null;
  /** Workspace-relative route the row opens, e.g. `tasks/abc123`. */
  deepLink: string | null;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: IsoDateString;
  actor: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  workspace?: NotificationWorkspaceInfo | null;
  workspaceName?: string | null;
  workspaceIcon?: string | null;
}

/**
 * A registered push target.
 *
 * No `pushKey`: it is a delivery credential and the API never returns it.
 */
export interface PushDevice {
  id: string;
  appId: string;
  deviceDisplayName: string | null;
  createdAt: IsoDateString;
}

export type SearchCategory =
  | 'channels'
  | 'docs'
  | 'files'
  | 'tasks'
  | 'projects'
  | 'people';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  snippet?: string;
  /** Workspace-relative route the result opens. */
  href?: string;
  metadata?: Record<string, unknown>;
}

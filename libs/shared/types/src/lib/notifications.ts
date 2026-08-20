import type { IsoDateString } from './entities.js';

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
  channel: { id: string; name: string; slug: string } | null;
  user: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
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

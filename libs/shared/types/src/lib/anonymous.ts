/**
 * Anonymous messaging (brief §2) — DTOs shared by the API and web client.
 *
 * The one field that must never appear here in a non-moderation response is the
 * real author. `AnonymousModerationRow` deliberately omits it; the author only
 * comes back from the permission-gated `reveal` call as an
 * `AnonymousRevealResult`, and that call is audited server-side.
 */

import type { PublicUser } from './entities.js';
import type { WorkspaceRole } from './enums.js';

export const ANON_DISPLAY_NAME = 'Anonymous Participant';

export type AnonymousModerationKind =
  | 'REPORT'
  | 'REVEAL_AUTHOR'
  | 'REMOVE_MESSAGE';

/** A channel's anonymous-posting configuration, as any member sees it. */
export interface ChannelAnonymousSettingsView {
  channelId: string;
  isEnabled: boolean;
  /** Roles allowed to post anonymously; empty ⇒ every channel member. */
  allowedRoles: WorkspaceRole[];
  allowReplies: boolean;
  /** Whether *the calling member* may post anonymously here right now. */
  canPostAnonymously: boolean;
  /** Whether the caller can open the moderation surface. */
  canModerate: boolean;
}

/** One anonymous message in the moderation list — no author, by design. */
export interface AnonymousModerationRow {
  id: string;
  matrixEventId: string;
  isReply: boolean;
  createdAt: string;
  removedAt: string | null;
  reportCount: number;
  /** The most recent report reason, if any. */
  lastReportReason: string | null;
}

/** The result of a permission-gated, audited author reveal. */
export interface AnonymousRevealResult {
  anonymousMessageId: string;
  author: PublicUser;
}

/** One row of the moderation audit trail. */
export interface AnonymousModerationEventView {
  id: string;
  kind: AnonymousModerationKind;
  actor: PublicUser;
  anonymousMessageId: string;
  reason: string | null;
  createdAt: string;
}

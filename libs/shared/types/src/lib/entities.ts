import type {
  ChannelRole,
  ChannelVisibility,
  InvitationStatus,
  PresenceStatus,
  SystemRole,
  WorkspaceRole,
} from './enums.js';

/** ISO-8601 timestamp. Transport is always a string; parse at the edge. */
export type IsoDateString = string;

/** A user as exposed to other members. Never includes credentials. */
export interface PublicUser {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  presence: PresenceStatus;
  lastSeenAt: IsoDateString | null;
  /*
   * IANA zone, e.g. `Asia/Kolkata`. Public because "what time is it where they
   * are" is a question colleagues ask constantly, and because a stored offset
   * would be wrong twice a year — the zone id survives DST, an offset does not.
   */
  timezone: string;
}

/** The authenticated user's own profile — adds private fields. */
export interface CurrentUser extends PublicUser {
  email: string;
  bio: string | null;
  systemRole: SystemRole;
  emailVerifiedAt: IsoDateString | null;
  createdAt: IsoDateString;
}

/**
 * A chosen icon, as it is stored and transported.
 *
 * `icon` is one of three things, told apart by inspecting the value rather than
 * by a discriminator: a Lucide icon name from the shared registry ("Rocket"),
 * an emoji ("🚀"), or an `http(s)` image URL. `iconColor` is a hex colour and
 * only applies to the registry case — emoji and images carry their own colour.
 *
 * Both are nullable everywhere: "no icon chosen" is a real state, and every
 * render site falls back to something derived from the entity itself.
 */
export interface IconSelection {
  icon: string | null;
  iconColor: string | null;
}

export interface Workspace extends IconSelection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** A workspace in the switcher, with the viewer's own role attached. */
export interface WorkspaceSummary extends Workspace {
  role: WorkspaceRole;
  memberCount: number;
  channelCount: number;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  joinedAt: IsoDateString;
  user: PublicUser;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  topic: string | null;
  description: string | null;
  visibility: ChannelVisibility;
  isArchived: boolean;
  archivedAt: IsoDateString | null;
  createdById: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** A channel in the sidebar, with the viewer's membership state folded in. */
export interface ChannelSummary extends Channel {
  memberCount: number;
  /** Null when the viewer is not a member (public channel they can preview). */
  membership: {
    role: ChannelRole;
    isFavorite: boolean;
    isMuted: boolean;
    lastReadAt: IsoDateString | null;
  } | null;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  role: ChannelRole;
  isFavorite: boolean;
  isMuted: boolean;
  joinedAt: IsoDateString;
  user: PublicUser;
}

export interface ChannelPin {
  id: string;
  channelId: string;
  title: string;
  url: string | null;
  note: string | null;
  pinnedById: string;
  pinnedAt: IsoDateString;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  expiresAt: IsoDateString;
  acceptedAt: IsoDateString | null;
  createdAt: IsoDateString;
  invitedBy: PublicUser;
}

export interface Upload {
  id: string;
  workspaceId: string;
  channelId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: IsoDateString;
  uploader: PublicUser;
}

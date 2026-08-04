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
}

/** The authenticated user's own profile — adds private fields. */
export interface CurrentUser extends PublicUser {
  email: string;
  bio: string | null;
  timezone: string;
  systemRole: SystemRole;
  emailVerifiedAt: IsoDateString | null;
  createdAt: IsoDateString;
}

export interface Workspace {
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

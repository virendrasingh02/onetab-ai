import type {
  Channel,
  ChannelMember,
  ChannelPin,
  Invitation,
  PublicUser,
  Upload,
  Workspace,
} from '@org/types';

/**
 * Persistence -> DTO mappers.
 *
 * Declared against structural shapes rather than Prisma model types so this
 * library stays free of a database dependency. Their job is twofold: drop
 * fields that must never leave the server (password hashes, token digests) and
 * convert `Date` to ISO strings, which is what the transport contract says.
 */

interface UserRow {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  presence: string;
  lastSeenAt: Date | null;
}

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    presence: user.presence as PublicUser['presence'],
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toWorkspace(workspace: WorkspaceRow): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    avatarUrl: workspace.avatarUrl,
    ownerId: workspace.ownerId,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

interface ChannelRow {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  topic: string | null;
  description: string | null;
  visibility: string;
  isArchived: boolean;
  archivedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toChannel(channel: ChannelRow): Channel {
  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    name: channel.name,
    slug: channel.slug,
    topic: channel.topic,
    description: channel.description,
    visibility: channel.visibility as Channel['visibility'],
    isArchived: channel.isArchived,
    archivedAt: channel.archivedAt?.toISOString() ?? null,
    createdById: channel.createdById,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

interface ChannelMemberRow {
  id: string;
  channelId: string;
  role: string;
  isFavorite: boolean;
  isMuted: boolean;
  joinedAt: Date;
  user: UserRow;
}

export function toChannelMember(row: ChannelMemberRow): ChannelMember {
  return {
    id: row.id,
    channelId: row.channelId,
    role: row.role as ChannelMember['role'],
    isFavorite: row.isFavorite,
    isMuted: row.isMuted,
    joinedAt: row.joinedAt.toISOString(),
    user: toPublicUser(row.user),
  };
}

interface ChannelPinRow {
  id: string;
  channelId: string;
  title: string;
  url: string | null;
  note: string | null;
  pinnedById: string;
  pinnedAt: Date;
}

export function toChannelPin(row: ChannelPinRow): ChannelPin {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    url: row.url,
    note: row.note,
    pinnedById: row.pinnedById,
    pinnedAt: row.pinnedAt.toISOString(),
  };
}

interface InvitationRow {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  invitedBy: UserRow;
}

export function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role as Invitation['role'],
    status: row.status as Invitation['status'],
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    invitedBy: toPublicUser(row.invitedBy),
  };
}

interface UploadRow {
  id: string;
  workspaceId: string;
  channelId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
  uploader: UserRow;
}

export function toUpload(row: UploadRow): Upload {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    channelId: row.channelId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    createdAt: row.createdAt.toISOString(),
    uploader: toPublicUser(row.uploader),
  };
}

/** Columns every serializer above needs; spread into a Prisma `select`. */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  presence: true,
  lastSeenAt: true,
} as const;

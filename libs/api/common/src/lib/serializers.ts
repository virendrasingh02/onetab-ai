import type {
  Channel,
  ChannelMember,
  ChannelPin,
  Invitation,
  PublicUser,
  Upload,
  Workspace,
  WorkspaceStatus,
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
  statusText?: string | null;
  statusEmoji?: string | null;
  statusExpiresAt?: Date | null;
  lastSeenAt: Date | null;
  timezone: string;
}

export function toPublicUser(user: UserRow): PublicUser {
  const isExpired =
    user.statusExpiresAt && new Date(user.statusExpiresAt) < new Date();

  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    presence: user.presence as PublicUser['presence'],
    statusText: isExpired ? null : user.statusText ?? null,
    statusEmoji: isExpired ? null : user.statusEmoji ?? null,
    statusExpiresAt: isExpired
      ? null
      : (user.statusExpiresAt?.toISOString() ?? null),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    timezone: user.timezone,
  };
}

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  icon: string | null;
  iconColor: string | null;
  ownerId: string;
  status: string;
  archivedAt: Date | null;
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
    icon: workspace.icon,
    iconColor: workspace.iconColor,
    ownerId: workspace.ownerId,
    status: workspace.status as WorkspaceStatus,
    archivedAt: workspace.archivedAt?.toISOString() ?? null,
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
  email: string | null;
  role: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  channelId?: string | null;
  teamId?: string | null;
  projectId?: string | null;
  message?: string | null;
  maxUses?: number | null;
  useCount?: number;
  isLink?: boolean;
  invitedBy: UserRow;
  workspace?: {
    id: string;
    name: string;
    slug: string;
    avatarUrl?: string | null;
    icon?: string | null;
    iconColor?: string | null;
  } | null;
  channel?: { id: string; name: string; slug: string } | null;
  team?: { id: string; name: string; key: string } | null;
  project?: { id: string; name: string; slug: string } | null;
}

export function toInvitation(row: InvitationRow): Invitation {
  const toIso = (d: Date | string | null | undefined): string | null => {
    if (!d) return null;
    return typeof d === 'string' ? d : d.toISOString();
  };

  const createdIso = toIso(row.createdAt) ?? new Date().toISOString();

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role as Invitation['role'],
    status: row.status as Invitation['status'],
    expiresAt: toIso(row.expiresAt) ?? new Date().toISOString(),
    acceptedAt: toIso(row.acceptedAt),
    declinedAt: toIso(row.declinedAt),
    revokedAt: toIso(row.revokedAt),
    createdAt: createdIso,
    updatedAt: toIso(row.updatedAt) ?? createdIso,
    invitedBy: toPublicUser(row.invitedBy),
    workspace: row.workspace ?? null,
    channelId: row.channelId ?? null,
    channel: row.channel ?? null,
    teamId: row.teamId ?? null,
    team: row.team ?? null,
    projectId: row.projectId ?? null,
    project: row.project ?? null,
    message: row.message ?? null,
    maxUses: row.maxUses ?? null,
    useCount: row.useCount ?? 0,
    isLink: row.isLink ?? false,
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
  statusText: true,
  statusEmoji: true,
  statusExpiresAt: true,
  lastSeenAt: true,
  timezone: true,
} as const;

import type {
  MigrationCapabilityReport,
  MigrationScope,
} from '@org/types';

export interface SourceWorkspaceMetadata {
  id: string;
  name: string;
  domain?: string;
  iconUrl?: string;
  enterpriseId?: string;
}

export interface SourceUser {
  id: string;
  name: string;
  realName?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  timezone?: string;
  isAdmin: boolean;
  isOwner: boolean;
  isBot: boolean;
  isDeleted: boolean;
  raw?: Record<string, unknown>;
}

export interface SourceChannel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  isPrivate: boolean;
  isArchived: boolean;
  created?: number;
  creatorId?: string;
  memberCount?: number;
  raw?: Record<string, unknown>;
}

export interface SourceMessageReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SourceFileAttachment {
  id: string;
  name: string;
  title?: string;
  mimeType: string;
  size: number;
  urlPrivate?: string;
  permalink?: string;
  isExternal?: boolean;
}

export interface SourceMessage {
  id: string;
  channelId: string;
  userId: string;
  text: string;
  timestamp: string; // Slack ts: e.g. "1712000000.123456"
  threadTs?: string;
  replyCount?: number;
  reactions?: SourceMessageReaction[];
  files?: SourceFileAttachment[];
  edited?: {
    user: string;
    ts: string;
  };
  subtype?: string;
  raw?: Record<string, unknown>;
}

export interface SourceFile {
  id: string;
  name: string;
  title?: string;
  mimeType: string;
  size: number;
  urlPrivate?: string;
  permalink?: string;
  isExternal: boolean;
  userId?: string;
  timestamp?: number;
  channels?: string[];
}

export interface BatchResult<T> {
  items: T[];
  nextCursor?: string;
  totalEstimate?: number;
}

export interface MigrationProvider {
  readonly providerId: string;
  readonly displayName: string;

  checkCapabilities(
    authOrConfig: string | Record<string, unknown>,
  ): Promise<MigrationCapabilityReport>;

  fetchWorkspaceMetadata(
    authOrConfig: string | Record<string, unknown>,
  ): Promise<SourceWorkspaceMetadata>;

  fetchUsers(
    authOrConfig: string | Record<string, unknown>,
    cursor?: string,
    limit?: number,
  ): Promise<BatchResult<SourceUser>>;

  fetchChannels(
    authOrConfig: string | Record<string, unknown>,
    scope: MigrationScope,
    cursor?: string,
    limit?: number,
  ): Promise<BatchResult<SourceChannel>>;

  fetchChannelMembers(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
  ): Promise<string[]>;

  fetchMessages(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
    options: {
      cursor?: string;
      limit?: number;
      oldest?: string;
      latest?: string;
    },
  ): Promise<BatchResult<SourceMessage>>;

  fetchThreadReplies(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
    threadTs: string,
  ): Promise<SourceMessage[]>;

  fetchFiles(
    authOrConfig: string | Record<string, unknown>,
    channelId?: string,
    cursor?: string,
    limit?: number,
  ): Promise<BatchResult<SourceFile>>;
}

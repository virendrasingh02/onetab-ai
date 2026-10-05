import type { IsoDateString } from './entities.js';

export type MigrationCapabilityStatus =
  | 'available'
  | 'unavailable'
  | 'permission_required'
  | 'plan_restricted'
  | 'admin_required'
  | 'unsupported'
  | 'unknown';

export type MigrationCapabilityKey =
  | 'workspace_metadata'
  | 'members'
  | 'public_channels'
  | 'private_channels'
  | 'channel_members'
  | 'messages'
  | 'threads'
  | 'reactions'
  | 'mentions'
  | 'files'
  | 'file_links'
  | 'dms'
  | 'group_dms'
  | 'canvases'
  | 'lists'
  | 'message_history'
  | 'user_profiles';

export interface MigrationCapabilityItem {
  key: MigrationCapabilityKey;
  name: string;
  description: string;
  status: MigrationCapabilityStatus;
  reason?: string;
  missingScopes?: string[];
  details?: Record<string, unknown>;
}

export interface MigrationCapabilityReport {
  capabilities: Record<MigrationCapabilityKey, MigrationCapabilityItem>;
  workspace: {
    id: string;
    name: string;
    domain?: string;
    iconUrl?: string;
  };
  connectedAccount: {
    id: string;
    name: string;
    email?: string;
    isAdmin: boolean;
  };
  scopes: string[];
  canMigrate: boolean;
  blockers: string[];
  warnings: string[];
  checkedAt: IsoDateString;
}

export type ReadinessCheckSeverity = 'passed' | 'warning' | 'blocker';

export interface MigrationReadinessCheck {
  id: string;
  title: string;
  category: 'access' | 'permissions' | 'compatibility' | 'data' | 'retention' | 'storage';
  status: ReadinessCheckSeverity;
  message: string;
  details?: string;
  resolutionHint?: string;
}

export interface MigrationReadinessReport {
  checks: MigrationReadinessCheck[];
  canProceed: boolean;
  estimates: {
    membersCount: number;
    channelsCount: number;
    messagesCount: number;
    filesCount: number;
    estimatedStorageMb: number;
    estimatedDurationMinutes: [number, number];
  };
  passedCount: number;
  warningCount: number;
  blockerCount: number;
  generatedAt: IsoDateString;
}

export interface MigrationScope {
  mode: 'all' | 'selected';
  channelIds?: string[];
  dateRange?: {
    from?: IsoDateString;
    to?: IsoDateString;
  };
  includePublicChannels: boolean;
  includePrivateChannels: boolean;
  includeDms: boolean;
  includeGroupDms: boolean;
  includeFiles: boolean;
  structureOnly: boolean;
  maxMessagesPerChannel?: number;
}

export type UserMatchType =
  | 'linked_identity'
  | 'verified_email'
  | 'existing_member'
  | 'admin_mapped'
  | 'invite'
  | 'unmatched';

export interface UserMappingPreviewItem {
  sourceId: string;
  sourceName: string;
  sourceEmail?: string;
  sourceAvatarUrl?: string;
  matchType: UserMatchType;
  destinationUserId?: string;
  destinationName?: string;
  destinationEmail?: string;
  conflict?: string;
  resolution: 'USE_EXISTING' | 'INVITE' | 'CREATE_PLACEHOLDER' | 'SKIP';
}

export type ChannelConflictType =
  | 'name_collision'
  | 'already_imported'
  | 'archived'
  | 'none';

export interface ChannelMappingPreviewItem {
  sourceId: string;
  sourceName: string;
  topic?: string;
  isPrivate: boolean;
  memberCount: number;
  messageCount: number;
  conflictType: ChannelConflictType;
  existingChannelId?: string;
  suggestedSlug: string;
  resolution: 'USE_EXISTING' | 'RENAME' | 'MERGE' | 'ARCHIVE' | 'SKIP';
}

export interface MigrationMappingPreview {
  users: UserMappingPreviewItem[];
  channels: ChannelMappingPreviewItem[];
  files: {
    totalFiles: number;
    supportedFiles: number;
    externalLinkOnly: number;
    unsupportedFiles: number;
    estimatedSizeMb: number;
  };
  summary: {
    totalUsers: number;
    matchedUsers: number;
    unmatchedUsers: number;
    totalChannels: number;
    conflictingChannels: number;
  };
}

export interface MigrationConflictResolutionInput {
  userResolutions?: Record<
    string,
    {
      resolution: 'USE_EXISTING' | 'INVITE' | 'CREATE_PLACEHOLDER' | 'SKIP';
      destinationUserId?: string;
    }
  >;
  channelResolutions?: Record<
    string,
    {
      resolution: 'USE_EXISTING' | 'RENAME' | 'MERGE' | 'ARCHIVE' | 'SKIP';
      targetChannelId?: string;
      renameTo?: string;
    }
  >;
}

export interface MigrationStageProgress {
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  percent: number;
}

export interface MigrationRecentActivity {
  id: string;
  timestamp: IsoDateString;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface MigrationLiveProgress {
  migrationId: string;
  status:
    | 'PENDING'
    | 'READY'
    | 'IN_PROGRESS'
    | 'PAUSED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  currentStage: string;
  percentComplete: number;
  startedAt?: IsoDateString;
  pausedAt?: IsoDateString;
  completedAt?: IsoDateString;
  throughput: {
    recordsPerSecond: number;
    currentItem?: string;
  };
  stageProgress: {
    members: MigrationStageProgress;
    channels: MigrationStageProgress;
    messages: MigrationStageProgress;
    threads: MigrationStageProgress;
    reactions: MigrationStageProgress;
    files: MigrationStageProgress;
  };
  recentActivities: MigrationRecentActivity[];
  totalErrors: number;
  totalWarnings: number;
}

export interface ValidationDiscrepancy {
  category: string;
  description: string;
  expected: number;
  actual: number;
  severity: 'low' | 'medium' | 'high';
}

export interface BrokenRelationshipItem {
  entityType: string;
  id: string;
  missingRef: string;
  description: string;
}

export interface MigrationValidationReport {
  score: number;
  passed: boolean;
  metrics: {
    expectedUsers: number;
    importedUsers: number;
    expectedChannels: number;
    importedChannels: number;
    expectedMessages: number;
    importedMessages: number;
    expectedThreads: number;
    importedThreads: number;
    expectedReactions: number;
    importedReactions: number;
    expectedFiles: number;
    importedFiles: number;
  };
  discrepancies: ValidationDiscrepancy[];
  brokenReferences: BrokenRelationshipItem[];
  verifiedAt: IsoDateString;
}

export interface AIAdoptionRecommendation {
  id: string;
  title: string;
  category: 'channels' | 'projects' | 'tasks' | 'scheduler' | 'tracker' | 'coworkers';
  rationale: string;
  channelId?: string;
  channelName?: string;
  suggestedAction: string;
  actionType:
    | 'create_project'
    | 'create_task'
    | 'setup_scheduler'
    | 'setup_tracker'
    | 'archive_channel';
  applied?: boolean;
}

export interface MigrationFinalReport {
  migrationId: string;
  sourceWorkspace: {
    id: string;
    name: string;
    provider: string;
  };
  destinationWorkspace: {
    id: string;
    name: string;
  };
  startedAt: IsoDateString;
  completedAt: IsoDateString;
  durationSeconds: number;
  validationScore: number;
  counts: {
    members: number;
    channels: number;
    messages: number;
    threads: number;
    reactions: number;
    files: number;
    dms: number;
  };
  skippedItems: Array<{
    type: string;
    count: number;
    reason: string;
  }>;
  warnings: string[];
  errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
  aiAdoptionInsights: AIAdoptionRecommendation[];
}

export interface MigrationSessionDto {
  id: string;
  workspaceId: string;
  sourceProvider: string;
  sourceWorkspaceId?: string | null;
  sourceWorkspaceName?: string | null;
  createdById: string;
  status:
    | 'PENDING'
    | 'READY'
    | 'IN_PROGRESS'
    | 'PAUSED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  currentStage: string;
  scope: MigrationScope;
  capabilities: MigrationCapabilityReport;
  readinessReport?: MigrationReadinessReport | null;
  aiRecommendations?: AIAdoptionRecommendation[] | null;
  errorMessage?: string | null;
  startedAt?: IsoDateString | null;
  pausedAt?: IsoDateString | null;
  completedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

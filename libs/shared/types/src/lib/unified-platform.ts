export type AttentionCategory =
  | 'URGENT'
  | 'IMPORTANT'
  | 'NEEDS_ACTION'
  | 'INFORMATIONAL';

export interface AttentionAction {
  id: string;
  label: string;
  kind: 'primary' | 'secondary' | 'danger';
  href?: string;
  actionType?: 'MARK_COMPLETE' | 'SNOOZE' | 'DISMISS' | 'NAVIGATE';
}

export interface AttentionItem {
  id: string;
  itemKey: string;
  category: AttentionCategory;
  title: string;
  description: string | null;
  priorityScore: number;
  sourceType: 'task' | 'mention' | 'dm' | 'meeting' | 'approval' | 'system';
  sourceId: string;
  deepLink: string;
  timestamp: string;
  actor?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  dueDate?: string | null;
  actions: AttentionAction[];
}

export interface CatchUpSummary {
  workspaceId: string;
  lastActiveAt: string | null;
  sinceHours: number;
  greeting: string;
  unreadMentionsCount: number;
  unreadDMsCount: number;
  tasksCompletedCount: number;
  tasksAssignedCount: number;
  activeHuddlesCount: number;
  decisionsMadeCount: number;
  keyUpdates: Array<{
    id: string;
    type: 'mention' | 'task' | 'decision' | 'document' | 'milestone';
    title: string;
    summary: string;
    timestamp: string;
    href: string;
    actor?: {
      name: string;
      avatarUrl?: string | null;
    };
  }>;
}

export type RecentItemType =
  | 'channel'
  | 'dm'
  | 'project'
  | 'task'
  | 'document'
  | 'file'
  | 'agent';

export interface RecentItem {
  id: string;
  type: RecentItemType;
  title: string;
  subtitle?: string;
  href: string;
  icon?: string;
  lastVisitedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ContinuityDraft {
  id: string;
  contextType: 'channel' | 'dm' | 'task_comment' | 'doc';
  contextId: string;
  title: string;
  preview: string;
  updatedAt: string;
  href: string;
}

export interface ContinuityState {
  workspaceId: string;
  lastChannelSlug?: string | null;
  lastProjectId?: string | null;
  lastTaskId?: string | null;
  lastDocId?: string | null;
  recentItems: RecentItem[];
  drafts: ContinuityDraft[];
}

export interface CrossObjectLinkDto {
  id: string;
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateCrossObjectLinkInput {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateBookmarkInput {
  targetType: string;
  targetId: string;
  title: string;
  snippet?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RelatedEntitySummary {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  href: string;
  status?: string;
  timestamp?: string;
  actor?: {
    name: string;
    avatarUrl?: string | null;
  };
}

export interface ContextOverviewDto {
  targetType: string;
  targetId: string;
  title: string;
  relatedPeople: Array<{
    id: string;
    name: string;
    role?: string;
    avatarUrl?: string | null;
    presence?: string;
  }>;
  relatedMessages: Array<{
    id: string;
    roomId: string;
    channelName?: string;
    senderName: string;
    body: string;
    timestamp: string;
    href: string;
  }>;
  relatedTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    identifier?: string;
    href: string;
  }>;
  relatedFiles: Array<{
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    href: string;
  }>;
  relatedDocs: Array<{
    id: string;
    title: string;
    href: string;
  }>;
  relatedAgents: Array<{
    id: string;
    name: string;
    model: string;
  }>;
  activityCount: number;
}

export interface BookmarkDto {
  id: string;
  workspaceId: string;
  userId: string;
  targetType: string;
  targetId: string;
  title: string;
  snippet?: string | null;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function classifyAttentionCategory(score: number): AttentionCategory {
  if (score >= 85) return 'URGENT';
  if (score >= 60) return 'IMPORTANT';
  if (score >= 40) return 'NEEDS_ACTION';
  return 'INFORMATIONAL';
}

export function sortAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}


import type { Task, WorkDocument, TaskStatus } from '@org/types';

export type EntityKind = 'task' | 'card' | 'document' | 'thread' | 'project';

export interface ChatAppEntity {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle?: string;
  description?: string;
  channelId?: string;
  channelName?: string;
  channelSlug?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;
  authorId?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  updatedAt?: number | string;
  createdAt?: number | string;
  itemCount?: number;
  url?: string;
  raw?: Task | WorkDocument | unknown;
}

export interface ChannelEntityGroup {
  channelId: string;
  channelName: string;
  channelSlug: string;
  isPrivate?: boolean;
  entities: ChatAppEntity[];
}

export interface EntityActionHandlers {
  onOpen?: (entity: ChatAppEntity) => void;
  onPreview?: (entity: ChatAppEntity) => void;
  onEdit?: (entity: ChatAppEntity) => void;
  onDelete?: (entity: ChatAppEntity) => void;
  onStatusChange?: (entity: ChatAppEntity, newStatus: TaskStatus | string) => void;
  onAssignToMe?: (entity: ChatAppEntity) => void;
  onCopyLink?: (entity: ChatAppEntity) => void;
}

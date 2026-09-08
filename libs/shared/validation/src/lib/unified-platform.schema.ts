import { z } from 'zod';

export const createCrossObjectLinkSchema = z.object({
  sourceType: z.string().min(1).max(64),
  sourceId: z.string().min(1).max(128),
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(128),
  linkType: z.string().min(1).max(64).default('RELATED'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateCrossObjectLinkInput = z.infer<
  typeof createCrossObjectLinkSchema
>;

export const createBookmarkSchema = z.object({
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  snippet: z.string().max(4000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;

export const updateBookmarkSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  snippet: z.string().max(4000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;

export const snoozeAttentionItemSchema = z.object({
  itemKey: z.string().min(1).max(256),
  snoozeDurationMinutes: z.number().int().min(5).max(10080).default(60),
});

export type SnoozeAttentionItemInput = z.infer<typeof snoozeAttentionItemSchema>;

export const dismissAttentionItemSchema = z.object({
  itemKey: z.string().min(1).max(256),
});

export type DismissAttentionItemInput = z.infer<
  typeof dismissAttentionItemSchema
>;

export const recordRecentItemSchema = z.object({
  type: z.enum([
    'channel',
    'dm',
    'project',
    'task',
    'document',
    'file',
    'agent',
  ]),
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional(),
  href: z.string().min(1).max(1000),
  icon: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordRecentItemInput = z.infer<typeof recordRecentItemSchema>;

export const saveDraftSchema = z.object({
  contextType: z.enum(['channel', 'dm', 'task_comment', 'doc']),
  contextId: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  content: z.string().max(100000),
  href: z.string().min(1).max(1000),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

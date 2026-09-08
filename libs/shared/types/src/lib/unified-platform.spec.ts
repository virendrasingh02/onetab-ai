import { describe, expect, it } from 'vitest';
import {
  classifyAttentionCategory,
  sortAttentionItems,
  type AttentionItem,
} from './unified-platform.js';

describe('Unified Platform helpers', () => {
  it('correctly classifies attention categories by priority score', () => {
    expect(classifyAttentionCategory(95)).toBe('URGENT');
    expect(classifyAttentionCategory(85)).toBe('URGENT');
    expect(classifyAttentionCategory(84)).toBe('IMPORTANT');
    expect(classifyAttentionCategory(60)).toBe('IMPORTANT');
    expect(classifyAttentionCategory(59)).toBe('NEEDS_ACTION');
    expect(classifyAttentionCategory(40)).toBe('NEEDS_ACTION');
    expect(classifyAttentionCategory(39)).toBe('INFORMATIONAL');
    expect(classifyAttentionCategory(0)).toBe('INFORMATIONAL');
  });

  it('orders attention items by priorityScore descending, then timestamp descending', () => {
    const items: AttentionItem[] = [
      {
        id: '1',
        itemKey: 'task:1',
        category: 'IMPORTANT',
        title: 'Task Due Soon',
        description: null,
        priorityScore: 75,
        sourceType: 'task',
        sourceId: 't1',
        deepLink: 'tasks?id=1',
        timestamp: '2026-09-08T10:00:00Z',
        actions: [],
      },
      {
        id: '2',
        itemKey: 'task:2',
        category: 'URGENT',
        title: 'Task Overdue',
        description: null,
        priorityScore: 95,
        sourceType: 'task',
        sourceId: 't2',
        deepLink: 'tasks?id=2',
        timestamp: '2026-09-08T09:00:00Z',
        actions: [],
      },
      {
        id: '3',
        itemKey: 'mention:1',
        category: 'IMPORTANT',
        title: 'New Mention',
        description: null,
        priorityScore: 75,
        sourceType: 'mention',
        sourceId: 'm1',
        deepLink: 'c/general',
        timestamp: '2026-09-08T11:00:00Z',
        actions: [],
      },
    ];

    const sorted = sortAttentionItems(items);
    expect(sorted.map((i) => i.id)).toEqual(['2', '3', '1']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  parseTaskFilterRules,
  sanitizeTaskFilterReply,
  type TaskFilterContext,
} from './task-filter-parse.js';

const ctx = (prompt: string): TaskFilterContext => ({
  prompt,
  statuses: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'in_progress', name: 'In Progress' },
    { id: 'in_review', name: 'In Review' },
    { id: 'done', name: 'Completed' },
  ],
  members: [
    { id: 'u1', name: 'Amara Varga' },
    { id: 'u2', name: 'Ben Ito' },
  ],
  milestones: ['Beta launch'],
  currentUserId: 'u2',
});

describe('parseTaskFilterRules', () => {
  it('maps priority, assignee "me" and due words to facets', () => {
    const r = parseTaskFilterRules(ctx('urgent tasks assigned to me due this week'));
    expect(r.priorities).toEqual(['URGENT']);
    expect(r.memberIds).toEqual(['u2']);
    expect(r.due).toBe('week');
    expect(r.keywords).toEqual([]);
    expect(r.source).toBe('rules');
  });

  it('matches status names, member first names and milestones', () => {
    const r = parseTaskFilterRules(ctx('in review for amara in beta launch'));
    expect(r.status).toEqual(['in_review']);
    expect(r.memberIds).toEqual(['u1']);
    expect(r.milestones).toEqual(['Beta launch']);
  });

  it('keeps leftover content words as keywords', () => {
    const r = parseTaskFilterRules(ctx('overdue login bugs'));
    expect(r.due).toBe('overdue');
    expect(r.keywords).toEqual(['login', 'bugs']);
  });

  it('maps "done" to the completed status', () => {
    expect(parseTaskFilterRules(ctx('done')).status).toEqual(['done']);
  });
});

describe('sanitizeTaskFilterReply', () => {
  it('drops ids the caller did not send', () => {
    const r = sanitizeTaskFilterReply(
      '```json\n{"status":["in_review","made_up"],"priorities":["high","nope"],"memberIds":["u9","u1"],"due":"soon","milestones":["Beta launch"],"keywords":["show","login"]}\n```',
      ctx('x'),
    );
    expect(r).toMatchObject({
      status: ['in_review'],
      priorities: ['HIGH'],
      memberIds: ['u1'],
      due: 'any',
      milestones: ['Beta launch'],
      keywords: ['login'],
      source: 'ai',
    });
  });

  it('returns null for a reply with no JSON', () => {
    expect(sanitizeTaskFilterReply('sorry, I cannot', ctx('x'))).toBeNull();
  });
});

import type { TaskComment, WorkItemActivity } from '@org/types';
import { describe, expect, it } from 'vitest';
import { parseDuration } from '../relation-meta.js';
import {
  buildTimeline,
  describeActivity,
  type ActivityLookups,
} from './activity-feed.js';
import { parseAiList } from './card-ai.js';
import { activeMention } from './CardCommentComposer.js';

const lookups: ActivityLookups = {
  memberName: (id) => ({ u1: 'Amara', u2: 'Ben' })[id],
  refName: (_field, id) => (id === 't1' ? 'Platform' : undefined),
  taskName: (id) => (id === 'p1' ? 'WEB-1' : undefined),
};

const row = (patch: Partial<WorkItemActivity>): WorkItemActivity => ({
  id: 'a1',
  workspaceId: 'w',
  workItemId: 'task',
  actorId: 'u1',
  action: 'FIELD_CHANGED',
  createdAt: '2026-11-06T10:00:00.000Z',
  ...patch,
});

describe('describeActivity', () => {
  it('reads status changes from the columns', () => {
    expect(
      describeActivity(
        row({
          action: 'STATUS_CHANGED',
          oldValue: 'BACKLOG',
          newValue: 'IN_PROGRESS',
        }),
        lookups,
      ),
    ).toBe('moved this from Backlog to In Progress');
  });

  it('reads older rows whose metadata is a JSON string', () => {
    expect(
      describeActivity(
        row({
          action: 'PRIORITY_CHANGED',
          metadata: JSON.stringify({ oldValue: 'LOW', newValue: 'URGENT' }),
        }),
        lookups,
      ),
    ).toBe('changed the priority from Low to Urgent');
  });

  it('names who was assigned and unassigned', () => {
    expect(
      describeActivity(
        row({ action: 'ASSIGNED', oldValue: 'u1', newValue: 'u2' }),
        lookups,
      ),
    ).toBe('assigned Ben and unassigned Amara');
  });

  it('reports logged time as the difference', () => {
    expect(
      describeActivity(
        row({ fieldChanged: 'timeSpent', oldValue: '30', newValue: '120' }),
        lookups,
      ),
    ).toBe('logged 1h 30m');
  });

  it('resolves a team, and stays honest when it cannot', () => {
    const team = (newValue: string) =>
      describeActivity(row({ fieldChanged: 'teamId', newValue }), lookups);
    expect(team('t1')).toBe('set the team to Platform');
    expect(team('gone')).toBe('changed the team');
  });

  it('diffs tags', () => {
    expect(
      describeActivity(
        row({
          fieldChanged: 'labels',
          oldValue: '["api"]',
          newValue: '["web"]',
        }),
        lookups,
      ),
    ).toBe('added the tag web and removed the tag api');
  });

  it('leaves comments to their own entries', () => {
    expect(describeActivity(row({ action: 'COMMENTED' }), lookups)).toBeNull();
  });
});

describe('buildTimeline', () => {
  const comment = {
    id: 'c1',
    taskId: 'task',
    content: 'Looks good',
    createdAt: '2026-11-06T11:00:00.000Z',
    updatedAt: '2026-11-06T11:00:00.000Z',
    author: { id: 'u2', name: 'Ben' },
  } as TaskComment;
  const created = row({ action: 'CREATED', actor: null });

  it('runs oldest first across comments and history', () => {
    const entries = buildTimeline([comment], [created], lookups, 'all', '');
    expect(entries.map((entry) => entry.kind)).toEqual(['history', 'comment']);
  });

  it('filters by kind and by search text', () => {
    expect(
      buildTimeline([comment], [created], lookups, 'comments', ''),
    ).toHaveLength(1);
    expect(
      buildTimeline([comment], [created], lookups, 'all', 'GOOD')[0]?.id,
    ).toBe('c1');
    expect(buildTimeline([comment], [created], lookups, 'all', 'x1')).toEqual(
      [],
    );
  });
});

describe('parseAiList', () => {
  it('strips the bullets and numbers models add anyway', () => {
    expect(
      parseAiList(
        'Here is the list:\n- [ ] Write tests\n2. Ship it\n* **Tell the team**\n\n',
      ),
    ).toEqual(['Write tests', 'Ship it', 'Tell the team']);
  });
});

describe('parseDuration', () => {
  it.each([
    ['45', 45],
    ['45m', 45],
    ['1.5h', 90],
    ['1h 30m', 90],
    ['2H', 120],
  ])('reads %s', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  it.each(['', '0', 'soon', '1x'])('rejects "%s"', (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});

describe('activeMention', () => {
  it('finds the query at the caret, spaces included', () => {
    expect(activeMention('hey @Amara O', 12)).toEqual({
      start: 4,
      query: 'Amara O',
    });
  });

  it('ignores an @ inside a word, and a closed line', () => {
    expect(activeMention('mail me@work.com', 16)).toBeNull();
    expect(activeMention('@Amara\nnext', 11)).toBeNull();
  });
});

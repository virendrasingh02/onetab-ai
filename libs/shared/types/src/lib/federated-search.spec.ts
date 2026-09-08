import { describe, it, expect } from 'vitest';
import {
  mergeFederatedResults,
  resolveSearchWorkspaces,
} from './federated-search.js';
import type { FederatedSearchResultItem } from './notifications.js';

const wsA = { id: 'a', name: 'Acme', slug: 'acme' };
const wsB = { id: 'b', name: 'Beta', slug: 'beta' };

function item(
  over: Partial<FederatedSearchResultItem> = {},
): FederatedSearchResultItem {
  return {
    id: 'x',
    category: 'docs',
    title: 'Doc',
    workspace: wsA,
    score: 0.5,
    timestamp: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

describe('mergeFederatedResults', () => {
  it('ranks by score, then recency, then title', () => {
    const out = mergeFederatedResults(
      [
        [
          item({ id: '1', title: 'low', score: 0.1 }),
          item({ id: '2', title: 'high', score: 0.9 }),
        ],
        [
          item({
            id: '3',
            title: 'mid-new',
            score: 0.5,
            timestamp: '2026-09-05T00:00:00.000Z',
          }),
          item({
            id: '4',
            title: 'mid-old',
            score: 0.5,
            timestamp: '2026-09-02T00:00:00.000Z',
          }),
        ],
      ],
      { page: 0, pageSize: 10 },
    );
    expect(out.items.map((i) => i.title)).toEqual([
      'high',
      'mid-new',
      'mid-old',
      'low',
    ]);
  });

  it('de-duplicates people by user id, keeps other categories', () => {
    const out = mergeFederatedResults(
      [
        [item({ id: 'u1', category: 'people', title: 'Sam', workspace: wsA })],
        [
          item({ id: 'u1', category: 'people', title: 'Sam', workspace: wsB }),
          item({ id: 'd1', category: 'docs', title: 'A', workspace: wsB }),
        ],
      ],
      { page: 0, pageSize: 10 },
    );
    expect(out.items.filter((i) => i.category === 'people')).toHaveLength(1);
    expect(out.items.filter((i) => i.category === 'docs')).toHaveLength(1);
  });

  it('paginates and reports hasMore', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      item({ id: String(i), title: `t${i}`, score: 1 - i / 10 }),
    );
    const p0 = mergeFederatedResults([rows], { page: 0, pageSize: 3 });
    expect(p0.items).toHaveLength(3);
    expect(p0.hasMore).toBe(true);
    const p2 = mergeFederatedResults([rows], { page: 2, pageSize: 3 });
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
  });

  it('filters by date range, file type and project', () => {
    const rows = [
      item({ id: '1', timestamp: '2026-08-01T00:00:00.000Z' }),
      item({ id: '2', timestamp: '2026-09-10T00:00:00.000Z' }),
      item({
        id: 'f1',
        category: 'files',
        metadata: { mimeType: 'image/png' },
        timestamp: '2026-09-10T00:00:00.000Z',
      }),
      item({
        id: 'f2',
        category: 'files',
        metadata: { mimeType: 'application/pdf' },
        timestamp: '2026-09-10T00:00:00.000Z',
      }),
      item({
        id: 't1',
        category: 'tasks',
        metadata: { projectId: 'p1' },
        timestamp: '2026-09-10T00:00:00.000Z',
      }),
      item({
        id: 't2',
        category: 'tasks',
        metadata: { projectId: 'p2' },
        timestamp: '2026-09-10T00:00:00.000Z',
      }),
    ];
    expect(
      mergeFederatedResults([rows], {
        page: 0,
        pageSize: 20,
        dateFrom: '2026-09-01T00:00:00.000Z',
      }).items.map((i) => i.id),
    ).not.toContain('1');

    expect(
      mergeFederatedResults([rows], {
        page: 0,
        pageSize: 20,
        fileTypePrefix: 'image/',
      }).items.filter((i) => i.category === 'files').map((i) => i.id),
    ).toEqual(['f1']);

    expect(
      mergeFederatedResults([rows], {
        page: 0,
        pageSize: 20,
        projectId: 'p1',
      }).items.filter((i) => i.category === 'tasks').map((i) => i.id),
    ).toEqual(['t1']);
  });
});

describe('resolveSearchWorkspaces', () => {
  it('returns all memberships when no filter, else the intersection', () => {
    expect(resolveSearchWorkspaces([wsA, wsB], undefined)).toEqual([wsA, wsB]);
    expect(resolveSearchWorkspaces([wsA, wsB], [])).toEqual([wsA, wsB]);
    expect(resolveSearchWorkspaces([wsA, wsB], ['b'])).toEqual([wsB]);
    expect(resolveSearchWorkspaces([wsA, wsB], ['c'])).toEqual([]);
  });
});

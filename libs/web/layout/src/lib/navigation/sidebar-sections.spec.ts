import { describe, it, expect } from 'vitest';
import type { ChannelSummary } from '@org/types';
import {
  buildChannelSignals,
  defaultDirectionFor,
  resolveSidebarLayout,
  resolveSmartSection,
  sortChannels,
  type ChannelSignalMap,
  type SidebarSectionDef,
} from './sidebar-sections.js';

const NOW = Date.parse('2026-09-08T12:00:00.000Z');
const HOUR = 3_600_000;

function channel(
  id: string,
  name: string,
  extra: Partial<ChannelSummary> = {},
): ChannelSummary {
  return {
    id,
    workspaceId: 'ws-1',
    name,
    slug: name.toLowerCase(),
    topic: null,
    description: null,
    visibility: 'PUBLIC',
    isArchived: false,
    archivedAt: null,
    createdById: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    memberCount: 3,
    membership: {
      role: 'MEMBER',
      isFavorite: false,
      isMuted: false,
      lastReadAt: null,
    },
    ...extra,
  };
}

const general = channel('c-general', 'general');
const design = channel('c-design', 'design');
const random = channel('c-random', 'random');
const alerts = channel('c-alerts', 'alerts');
const ALL = [design, random, general, alerts];

const signals: ChannelSignalMap = {
  'c-general': {
    unreadCount: 1,
    mentionCount: 0,
    lastActivityAt: NOW - 30 * HOUR,
    visitCount: 40,
    lastVisitAt: NOW,
    priority: 1,
    isFavorite: false,
    matchedProjectId: null,
  },
  'c-design': {
    unreadCount: 9,
    mentionCount: 2,
    lastActivityAt: NOW - 1 * HOUR,
    visitCount: 12,
    lastVisitAt: NOW,
    priority: 3,
    isFavorite: true,
    matchedProjectId: 'p-design',
  },
  'c-random': {
    unreadCount: 0,
    mentionCount: 0,
    lastActivityAt: NOW - 200 * HOUR,
    visitCount: 2,
    lastVisitAt: NOW,
    priority: 0,
    isFavorite: false,
    matchedProjectId: null,
  },
  'c-alerts': {
    unreadCount: 4,
    mentionCount: 0,
    lastActivityAt: NOW - 5 * HOUR,
    visitCount: 0,
    lastVisitAt: 0,
    priority: 2,
    isFavorite: false,
    matchedProjectId: null,
  },
};

describe('defaultDirectionFor', () => {
  it('reads ascending for name-like modes, descending for magnitude modes', () => {
    expect(defaultDirectionFor('alphabetical')).toBe('asc');
    expect(defaultDirectionFor('default')).toBe('asc');
    expect(defaultDirectionFor('recentActivity')).toBe('desc');
    expect(defaultDirectionFor('unreadCount')).toBe('desc');
    expect(defaultDirectionFor('priority')).toBe('desc');
  });
});

describe('sortChannels', () => {
  it('default keeps #general first then alphabetical', () => {
    const out = sortChannels(ALL, signals, { mode: 'default', direction: 'asc' });
    expect(out.map((c) => c.name)).toEqual([
      'general',
      'alerts',
      'design',
      'random',
    ]);
  });

  it('alphabetical respects direction', () => {
    expect(
      sortChannels(ALL, signals, { mode: 'alphabetical', direction: 'asc' }).map(
        (c) => c.name,
      ),
    ).toEqual(['alerts', 'design', 'general', 'random']);
    expect(
      sortChannels(ALL, signals, {
        mode: 'alphabetical',
        direction: 'desc',
      }).map((c) => c.name),
    ).toEqual(['random', 'general', 'design', 'alerts']);
  });

  it('recentActivity desc puts the freshest channel first', () => {
    const out = sortChannels(ALL, signals, {
      mode: 'recentActivity',
      direction: 'desc',
    });
    expect(out[0].name).toBe('design');
    expect(out[out.length - 1].name).toBe('random');
  });

  it('unreadCount / mentions / frequency / priority order by their signal', () => {
    expect(
      sortChannels(ALL, signals, {
        mode: 'unreadCount',
        direction: 'desc',
      })[0].name,
    ).toBe('design');
    expect(
      sortChannels(ALL, signals, {
        mode: 'mentions',
        direction: 'desc',
      })[0].name,
    ).toBe('design');
    expect(
      sortChannels(ALL, signals, {
        mode: 'frequency',
        direction: 'desc',
      })[0].name,
    ).toBe('general');
    expect(
      sortChannels(ALL, signals, {
        mode: 'priority',
        direction: 'desc',
      })[0].name,
    ).toBe('design');
  });

  it('manual is a no-op — the caller keeps its drag order', () => {
    const order = [random, general, design, alerts];
    expect(
      sortChannels(order, signals, { mode: 'manual', direction: 'asc' }),
    ).toEqual(order);
  });

  it('does not mutate the input array', () => {
    const input = [...ALL];
    sortChannels(input, signals, { mode: 'alphabetical', direction: 'asc' });
    expect(input).toEqual(ALL);
  });
});

describe('resolveSmartSection', () => {
  it('unread — channels with unread or a mention, most unread first', () => {
    const out = resolveSmartSection({ type: 'unread' }, ALL, signals, NOW);
    expect(out.map((c) => c.name)).toEqual(['design', 'alerts', 'general']);
  });

  it('mentions — only channels with a mention', () => {
    const out = resolveSmartSection({ type: 'mentions' }, ALL, signals, NOW);
    expect(out.map((c) => c.name)).toEqual(['design']);
  });

  it('recent — respects the time window', () => {
    const within = resolveSmartSection(
      { type: 'recent', withinHours: 48 },
      ALL,
      signals,
      NOW,
    );
    expect(within.map((c) => c.name)).toEqual(['design', 'alerts', 'general']);

    const tight = resolveSmartSection(
      { type: 'recent', withinHours: 6 },
      ALL,
      signals,
      NOW,
    );
    expect(tight.map((c) => c.name)).toEqual(['design', 'alerts']);
  });

  it('frequent — top N by visit count', () => {
    const out = resolveSmartSection(
      { type: 'frequent', top: 2 },
      ALL,
      signals,
      NOW,
    );
    expect(out.map((c) => c.name)).toEqual(['general', 'design']);
  });

  it('favorites / priority / keyword / project', () => {
    expect(
      resolveSmartSection({ type: 'favorites' }, ALL, signals, NOW).map(
        (c) => c.name,
      ),
    ).toEqual(['design']);
    expect(
      resolveSmartSection({ type: 'priority', min: 2 }, ALL, signals, NOW).map(
        (c) => c.name,
      ),
    ).toEqual(['design', 'alerts']);
    expect(
      resolveSmartSection(
        { type: 'keyword', value: 'design' },
        ALL,
        signals,
        NOW,
      ).map((c) => c.name),
    ).toEqual(['design']);
    expect(
      resolveSmartSection({ type: 'project' }, ALL, signals, NOW).map(
        (c) => c.name,
      ),
    ).toEqual(['design']);
  });

  it('keyword with an empty needle matches nothing', () => {
    expect(
      resolveSmartSection({ type: 'keyword', value: '  ' }, ALL, signals, NOW),
    ).toEqual([]);
  });
});

describe('resolveSidebarLayout', () => {
  const manual: SidebarSectionDef = {
    id: 's-manual',
    label: 'Squad',
    kind: 'manual',
    order: 0,
    collapsed: false,
    hideWhenEmpty: false,
    channelIds: ['c-design', 'c-missing'],
  };
  const smart: SidebarSectionDef = {
    id: 's-smart',
    label: 'Unread',
    kind: 'smart',
    order: 1,
    collapsed: false,
    hideWhenEmpty: true,
    rule: { type: 'unread' },
  };

  it('manual sections claim their channels; smart sections only mirror', () => {
    const layout = resolveSidebarLayout({
      channels: ALL,
      defs: [manual, smart],
      signals,
      now: NOW,
    });

    // Manual section: existing ids only, in listed order.
    expect(layout.sections[0].channels.map((c) => c.id)).toEqual(['c-design']);
    // Smart section still shows design even though the manual section claimed it.
    expect(layout.sections[1].channels.map((c) => c.name)).toContain('design');
    // "design" is removed from the catch-all list; the rest remain.
    expect(layout.unsectioned.map((c) => c.id).sort()).toEqual(
      ['c-alerts', 'c-general', 'c-random'].sort(),
    );
  });

  it('orders sections by their `order` field', () => {
    const layout = resolveSidebarLayout({
      channels: ALL,
      defs: [
        { ...smart, order: 5 },
        { ...manual, order: 2 },
      ],
      signals,
      now: NOW,
    });
    expect(layout.sections.map((s) => s.def.id)).toEqual([
      's-manual',
      's-smart',
    ]);
  });

  it('with no defs, every channel falls through untouched', () => {
    const layout = resolveSidebarLayout({
      channels: ALL,
      defs: [],
      signals,
      now: NOW,
    });
    expect(layout.sections).toEqual([]);
    expect(layout.unsectioned).toEqual(ALL);
  });

  it("one workspace's section defs never pull in another workspace's channels", () => {
    // defs reference ids that are not in this channel list at all
    const foreignDefs: SidebarSectionDef[] = [
      { ...manual, channelIds: ['other-ws-chan-1', 'other-ws-chan-2'] },
    ];
    const layout = resolveSidebarLayout({
      channels: ALL,
      defs: foreignDefs,
      signals,
      now: NOW,
    });
    expect(layout.sections[0].channels).toEqual([]);
    expect(layout.unsectioned).toEqual(ALL);
  });
});

describe('buildChannelSignals', () => {
  it('folds activity, visits, meta and project matches into one map', () => {
    const map = buildChannelSignals({
      channels: [design, random],
      activity: { 'c-design': { count: 5, mentionCount: 1 } },
      lastActivityAt: { 'c-design': '2026-09-08T09:00:00.000Z' },
      visits: { 'c-design': { count: 7, lastAt: '2026-09-08T11:00:00.000Z' } },
      meta: { 'c-design': { priority: 2 } },
      projects: [{ id: 'p-1', name: 'Design' }],
    });

    expect(map['c-design'].unreadCount).toBe(5);
    expect(map['c-design'].mentionCount).toBe(1);
    expect(map['c-design'].visitCount).toBe(7);
    expect(map['c-design'].priority).toBe(2);
    expect(map['c-design'].matchedProjectId).toBe('p-1');
    expect(map['c-design'].lastActivityAt).toBe(
      Date.parse('2026-09-08T09:00:00.000Z'),
    );

    // random has nothing configured — a clean zeroed signal, no project match.
    expect(map['c-random'].unreadCount).toBe(0);
    expect(map['c-random'].matchedProjectId).toBeNull();
  });

  it('never returns a negative count and tolerates junk timestamps', () => {
    const map = buildChannelSignals({
      channels: [design],
      activity: { 'c-design': { count: -3, mentionCount: -1 } },
      lastActivityAt: { 'c-design': 'not-a-date' },
      visits: {},
      meta: {},
      projects: [],
    });
    expect(map['c-design'].unreadCount).toBe(0);
    expect(map['c-design'].mentionCount).toBe(0);
    // falls back to the channel's own updatedAt
    expect(map['c-design'].lastActivityAt).toBe(
      Date.parse(design.updatedAt),
    );
  });
});

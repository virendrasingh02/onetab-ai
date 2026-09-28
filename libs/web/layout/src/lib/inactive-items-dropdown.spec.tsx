import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type {
  AIAgent,
  AICoworkerDetail,
  ChannelSummary,
  ExternalIntegration,
  WorkspaceMember,
} from '@org/types';
import type { GroupDirectMessageSummary } from '@org/web-chat';
import {
  InactiveItemsDropdown,
  type InactiveDropdownItem,
} from './inactive-items-dropdown.js';
import {
  is30DaysInactive,
  partitionAgentsByInactivity,
  partitionAppsByInactivity,
  partitionChannelsByInactivity,
  partitionCoworkersByInactivity,
  partitionGroupDMsByInactivity,
  partitionMembersByInactivity,
  THIRTY_DAYS_MS,
  toEpoch,
} from './inactivity-utils.js';

const NOW = 1700000000000;
const DAY = 24 * 60 * 60 * 1000;
const TWENTY_DAYS_AGO = NOW - 20 * DAY;
const THIRTY_ONE_DAYS_AGO = NOW - 31 * DAY;
const SIXTY_DAYS_AGO = NOW - 60 * DAY;

function channel(id: string, createdAt: number, extra: Partial<ChannelSummary> = {}): ChannelSummary {
  return {
    id,
    workspaceId: 'w-1',
    name: id,
    slug: id,
    topic: null,
    description: null,
    welcomeMessage: null,
    visibility: 'PUBLIC',
    isArchived: false,
    archivedAt: null,
    mode: 'STANDARD',
    allowReactions: true,
    allowReplies: true,
    allowFileUploads: true,
    announcementPosterIds: [],
    createdById: 'u-1',
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(createdAt).toISOString(),
    memberCount: 2,
    membership: null,
    canPost: true,
    canReply: true,
    ...extra,
  };
}

function member(userId: string, joinedAt: number, extra: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: `m-${userId}`,
    workspaceId: 'w-1',
    role: 'MEMBER',
    status: 'ACTIVE',
    joinedAt: new Date(joinedAt).toISOString(),
    user: {
      id: userId,
      name: userId,
      displayName: userId,
      avatarUrl: null,
      presence: 'OFFLINE',
      email: `${userId}@example.com`,
    },
    ...extra,
  } as WorkspaceMember;
}

describe('30-day inactivity logic (inactivity-utils)', () => {
  it('uses a strict 30-day threshold and never marks an unknown date inactive', () => {
    expect(THIRTY_DAYS_MS).toBe(30 * DAY);
    expect(is30DaysInactive(TWENTY_DAYS_AGO, NOW)).toBe(false);
    expect(is30DaysInactive(THIRTY_ONE_DAYS_AGO, NOW)).toBe(true);
    expect(is30DaysInactive(0, NOW)).toBe(false);
  });

  it('parses timestamps defensively', () => {
    expect(toEpoch('2026-09-08T09:00:00.000Z')).toBe(Date.parse('2026-09-08T09:00:00.000Z'));
    expect(toEpoch('not-a-date')).toBe(0);
    expect(toEpoch(null)).toBe(0);
    // matrix-js-sdk's "room has no events" sentinel
    expect(toEpoch(Number.MIN_SAFE_INTEGER)).toBe(0);
  });

  it('partitions channels by 30 days, keeping unread ones active', () => {
    const result = partitionChannelsByInactivity({
      channels: [
        channel('c-active', TWENTY_DAYS_AGO),
        channel('c-inactive', THIRTY_ONE_DAYS_AGO),
        channel('c-unread-old', THIRTY_ONE_DAYS_AGO),
      ],
      activity: { 'c-unread-old': { level: 'activity', count: 3, mentionCount: 0 } },
      now: NOW,
    });

    expect(result.active.map((c) => c.id)).toEqual(['c-active', 'c-unread-old']);
    expect(result.inactive.map((c) => c.id)).toEqual(['c-inactive']);
    expect(result.lastActiveAt['c-inactive']).toBe(THIRTY_ONE_DAYS_AGO);
  });

  it('restores a channel to active as soon as a new message occurs', () => {
    const old = channel('c-test', THIRTY_ONE_DAYS_AGO);

    expect(partitionChannelsByInactivity({ channels: [old], now: NOW }).inactive).toHaveLength(1);
    expect(
      partitionChannelsByInactivity({
        channels: [old],
        lastActivityAt: { 'c-test': NOW },
        now: NOW,
      }).active,
    ).toHaveLength(1);
  });

  it('marks nothing inactive until activity data is ready (no start-up flicker)', () => {
    const result = partitionChannelsByInactivity({
      channels: [channel('c-old', SIXTY_DAYS_AGO)],
      ready: false,
      now: NOW,
    });
    expect(result.inactive).toEqual([]);
    expect(result.active.map((c) => c.id)).toEqual(['c-old']);
  });

  it('never folds away favorites or the channel that is open', () => {
    const favorite = channel('c-fav', SIXTY_DAYS_AGO, {
      membership: { isFavorite: true } as ChannelSummary['membership'],
    });
    const open = channel('c-open', SIXTY_DAYS_AGO);
    const stale = channel('c-stale', SIXTY_DAYS_AGO);

    const result = partitionChannelsByInactivity({
      channels: [favorite, open, stale],
      keepActive: (id) => id === 'c-open',
      now: NOW,
    });
    expect(result.active.map((c) => c.id)).toEqual(['c-fav', 'c-open']);
    expect(result.inactive.map((c) => c.id)).toEqual(['c-stale']);
  });

  it('orders inactive items most recently active first', () => {
    const result = partitionChannelsByInactivity({
      channels: [channel('c-older', SIXTY_DAYS_AGO), channel('c-newer', THIRTY_ONE_DAYS_AGO)],
      now: NOW,
    });
    expect(result.inactive.map((c) => c.id)).toEqual(['c-newer', 'c-older']);
  });

  it('judges a DM by its last message, not by when the person was last online', () => {
    const onlineButQuiet = member('u-quiet', SIXTY_DAYS_AGO, {
      lastActiveAt: new Date(NOW - DAY).toISOString(),
    } as Partial<WorkspaceMember>);
    const chatty = member('u-chatty', SIXTY_DAYS_AGO);
    const newcomer = member('u-new', TWENTY_DAYS_AGO);

    const result = partitionMembersByInactivity({
      members: [onlineButQuiet, chatty, newcomer],
      lastMessageAt: { 'u-quiet': SIXTY_DAYS_AGO + DAY, 'u-chatty': NOW - DAY },
      now: NOW,
    });
    expect(result.active.map((m) => m.user.id)).toEqual(['u-chatty', 'u-new']);
    expect(result.inactive.map((m) => m.user.id)).toEqual(['u-quiet']);
  });

  it('brings a DM back as soon as it has unread activity', () => {
    const old = member('u-2', THIRTY_ONE_DAYS_AGO);
    expect(partitionMembersByInactivity({ members: [old], now: NOW }).inactive).toHaveLength(1);
    expect(
      partitionMembersByInactivity({
        members: [old],
        activity: { 'u-2': { level: 'activity', count: 1, mentionCount: 0 } },
        now: NOW,
      }).active,
    ).toHaveLength(1);
  });

  it('partitions group DMs by their room activity', () => {
    const group = (roomId: string, lastActivityAt: number, unreadCount = 0) =>
      ({
        roomId,
        name: roomId,
        memberCount: 3,
        unreadCount,
        mentionCount: 0,
        lastActivityAt,
        avatarMembers: [],
      }) satisfies GroupDirectMessageSummary;

    const result = partitionGroupDMsByInactivity(
      [group('g-old', SIXTY_DAYS_AGO), group('g-unread', SIXTY_DAYS_AGO, 2), group('g-new', NOW)],
      { now: NOW },
    );
    expect(result.active.map((g) => g.roomId)).toEqual(['g-unread', 'g-new']);
    expect(result.inactive.map((g) => g.roomId)).toEqual(['g-old']);
  });

  it('partitions AI agents, AI coworkers and apps by 30-day inactivity', () => {
    const stamp = (at: number) => new Date(at).toISOString();

    const agents = [
      { id: 'ag-old', lastActiveAt: stamp(THIRTY_ONE_DAYS_AGO), createdAt: stamp(THIRTY_ONE_DAYS_AGO), updatedAt: stamp(THIRTY_ONE_DAYS_AGO) },
      { id: 'ag-recent', lastActiveAt: stamp(TWENTY_DAYS_AGO), createdAt: stamp(TWENTY_DAYS_AGO), updatedAt: stamp(TWENTY_DAYS_AGO) },
    ] as unknown as AIAgent[];
    const agentResult = partitionAgentsByInactivity(agents, { now: NOW });
    expect(agentResult.active.map((a) => a.id)).toEqual(['ag-recent']);
    expect(agentResult.inactive.map((a) => a.id)).toEqual(['ag-old']);
    expect(
      partitionAgentsByInactivity(agents, { now: NOW, keepActive: (id) => id === 'ag-old' }).inactive,
    ).toEqual([]);

    const coworkers = [
      { id: 'cw-old', lastActiveAt: stamp(THIRTY_ONE_DAYS_AGO), createdAt: stamp(THIRTY_ONE_DAYS_AGO), updatedAt: stamp(THIRTY_ONE_DAYS_AGO) },
    ] as unknown as AICoworkerDetail[];
    expect(partitionCoworkersByInactivity(coworkers, { now: NOW }).inactive.map((c) => c.id)).toEqual(['cw-old']);

    const apps = [
      { id: 'app-old', provider: 'github', lastSyncAt: stamp(THIRTY_ONE_DAYS_AGO), createdAt: stamp(THIRTY_ONE_DAYS_AGO), updatedAt: stamp(THIRTY_ONE_DAYS_AGO) },
    ] as unknown as ExternalIntegration[];
    const appResult = partitionAppsByInactivity(apps, { now: NOW });
    expect(appResult.inactive.map((a) => a.id)).toEqual(['app-old']);
    // Apps are keyed by provider, like their sidebar rows and favorites.
    expect(appResult.lastActiveAt.github).toBe(THIRTY_ONE_DAYS_AGO);
  });
});

describe('InactiveItemsDropdown', () => {
  const sampleItems: InactiveDropdownItem[] = [
    {
      id: 'c-1',
      name: 'archived-chatter',
      to: '/w/test/c/archived-chatter',
      icon: <span data-testid="channel-icon">#</span>,
    },
    {
      id: 'c-2',
      name: 'project-planning-old',
      to: '/w/test/c/project-planning-old',
      icon: <span data-testid="channel-icon">#</span>,
    },
  ];

  const renderDropdown = (
    props: Partial<Parameters<typeof InactiveItemsDropdown>[0]> = {},
    initialEntries = ['/w/test/home'],
  ) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <InactiveItemsDropdown category="channels" items={sampleItems} {...props} />
      </MemoryRouter>,
    );

  it('renders nothing when there are no inactive items', () => {
    const { container } = renderDropdown({ items: [] });
    expect(container.firstChild).toBeNull();
  });

  it('labels the trigger "Inactive" without a count', () => {
    renderDropdown();
    const trigger = screen.getByRole('button', { name: /inactive/i });
    expect(trigger).toHaveTextContent('Inactive');
    expect(trigger).not.toHaveTextContent('2');
  });

  it('opens with the "No messages in at least 30 days" header and the items', async () => {
    const user = userEvent.setup();
    renderDropdown();

    expect(screen.queryByText('No messages in at least 30 days')).toBeNull();
    await user.click(screen.getByRole('button', { name: /inactive/i }));

    expect(screen.getByText('No messages in at least 30 days')).toBeInTheDocument();
    expect(screen.getByText('archived-chatter')).toBeInTheDocument();
    expect(screen.getByText('project-planning-old')).toBeInTheDocument();
  });

  it('links each item to its destination', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(screen.getByRole('button', { name: /inactive/i }));
    expect(screen.getByRole('link', { name: /archived-chatter/i })).toHaveAttribute(
      'href',
      '/w/test/c/archived-chatter',
    );
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(screen.getByRole('button', { name: /inactive/i }));
    expect(screen.getByText('No messages in at least 30 days')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('No messages in at least 30 days')).toBeNull();
  });

  it('shows how long ago each item was last active', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    renderDropdown({
      items: [
        { ...sampleItems[0], lastActiveAt: now - 45 * DAY },
        { ...sampleItems[1], lastActiveAt: now - 400 * DAY },
      ],
    });

    await user.click(screen.getByRole('button', { name: /inactive/i }));
    expect(screen.getByText('45d')).toBeInTheDocument();
    expect(screen.getByText('1y')).toBeInTheDocument();
  });

  it('offers a filter once the list is long, and filters by name', async () => {
    const user = userEvent.setup();
    const many: InactiveDropdownItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `c-${i}`,
      name: i === 7 ? 'design-reviews' : `old-channel-${i}`,
      to: `/w/test/c/${i}`,
      icon: <span>#</span>,
    }));
    renderDropdown({ items: many });

    await user.click(screen.getByRole('button', { name: /inactive/i }));
    await user.type(screen.getByRole('searchbox'), 'design');

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /design-reviews/i })).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/No inactive channels match/)).toBeInTheDocument();
  });

  it('does not show a filter for a short list', async () => {
    const user = userEvent.setup();
    renderDropdown();
    await user.click(screen.getByRole('button', { name: /inactive/i }));
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('moves between rows with the arrow keys', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(screen.getByRole('button', { name: /inactive/i }));
    const first = screen.getByRole('link', { name: /archived-chatter/i });
    const second = screen.getByRole('link', { name: /project-planning-old/i });

    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();
    await user.keyboard('{End}');
    expect(second).toHaveFocus();
  });

  it.each([
    ['dms', 'direct messages', 'Sarah Connor'],
    ['apps', undefined, 'GitHub'],
    ['agents', 'AI agents', 'Code Reviewer'],
    ['coworkers', 'AI coworkers', 'Alex Worker'],
  ] as const)('works for the %s category', async (category, categoryLabel, name) => {
    const user = userEvent.setup();
    renderDropdown({
      category,
      categoryLabel,
      items: [{ id: 'x', name, to: '/w/test/x', icon: <span data-testid="item-icon" /> }],
    });

    await user.click(
      screen.getByRole('button', { name: new RegExp(`inactive ${categoryLabel ?? category}`, 'i') }),
    );
    expect(screen.getByText('No messages in at least 30 days')).toBeInTheDocument();
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByTestId('item-icon')).toBeInTheDocument();
  });
});

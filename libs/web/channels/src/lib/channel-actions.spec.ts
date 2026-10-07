import type { ChannelSummary } from '@org/types';
import type { EntityAction } from '@org/ui';
import { describe, expect, it, vi } from 'vitest';
import { buildChannelActions } from './channel-actions.js';

const membership = {
  role: 'MEMBER',
  isFavorite: false,
  isMuted: false,
  mentionsOnly: false,
  lastReadAt: null,
  membershipType: 'PERMANENT',
  expiresAt: null,
  memberSuggestions: true,
} as NonNullable<ChannelSummary['membership']>;

const channel = {
  id: 'c-123',
  slug: 'engineering',
  name: 'engineering',
  topic: null,
  description: null,
  visibility: 'PUBLIC',
  isArchived: false,
  memberCount: 12,
  createdAt: '2026-01-01T00:00:00.000Z',
  membership,
} as unknown as ChannelSummary;

function withMembership(
  patch: Partial<NonNullable<ChannelSummary['membership']>>,
): ChannelSummary {
  return {
    ...channel,
    membership: { ...membership, ...patch },
  };
}

const ids = (actions: EntityAction[]) => actions.map((a) => a.id);
const find = (actions: EntityAction[], id: string) =>
  actions.find((a) => a.id === id);

describe('buildChannelActions', () => {
  it('only offers what the host can actually do', () => {
    const actions = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: true,
    });
    // No handlers → only the self-contained entries (new window, copy).
    expect(ids(actions)).toEqual(['new-window', 'copy']);
  });

  it('builds the full menu when every handler is wired', () => {
    const noop = vi.fn();
    const actions = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: true,
      onOpen: noop,
      onOpenSplitView: noop,
      onOpenDetails: noop,
      onToggleFavorite: noop,
      onMarkRead: noop,
      onMarkUnread: noop,
      onSetNotificationLevel: noop,
      onToggleHidden: noop,
      onRename: noop,
      onEditDetails: noop,
      onAddPeople: noop,
      onSetArchived: noop,
      onLeave: noop,
    });
    expect(ids(actions)).toEqual([
      'open',
      'split-view',
      'new-window',
      'mark-unread',
      'favorite',
      'mute',
      'notifications',
      'hide',
      'copy',
      'details',
      'rename',
      'edit-details',
      'add-people',
      'settings',
      'archive',
      'leave',
    ]);
    expect(find(actions, 'copy')?.children?.map((c) => c.id)).toEqual([
      'copy-link',
      'copy-name',
      'copy-id',
    ]);
  });

  it('slots host organisation entries in after the notification controls', () => {
    const actions = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: false,
      onSetNotificationLevel: vi.fn(),
      organizeActions: [{ id: 'priority', group: 'organize', label: 'Priority' }],
    });
    expect(ids(actions)).toEqual([
      'new-window',
      'mute',
      'notifications',
      'priority',
      'copy',
    ]);
  });

  it('hides management entries from non-managers', () => {
    const actions = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: false,
      onRename: vi.fn(),
      onEditDetails: vi.fn(),
      onAddPeople: vi.fn(),
      onSetArchived: vi.fn(),
    });
    for (const id of ['rename', 'edit-details', 'add-people', 'archive']) {
      expect(find(actions, id)?.hidden).toBe(true);
    }
  });

  it('never offers to leave or archive #general', () => {
    const actions = buildChannelActions({
      channel: { ...channel, slug: 'general', name: 'general' },
      workspaceSlug: 'acme',
      canManage: true,
      onSetArchived: vi.fn(),
      onLeave: vi.fn(),
    });
    expect(find(actions, 'leave')?.hidden).toBe(true);
    expect(find(actions, 'archive')?.hidden).toBe(true);
  });

  it('flips read state and star labels', () => {
    const actions = buildChannelActions({
      channel: withMembership({ isFavorite: true }),
      workspaceSlug: 'acme',
      canManage: false,
      hasUnread: true,
      onMarkRead: vi.fn(),
      onMarkUnread: vi.fn(),
      onToggleFavorite: vi.fn(),
    });
    expect(find(actions, 'mark-read')).toBeDefined();
    expect(find(actions, 'mark-unread')).toBeUndefined();
    expect(find(actions, 'favorite')?.label).toBe('Unstar channel');
  });

  it('checks the membership’s notification level', () => {
    const actions = buildChannelActions({
      channel: withMembership({ mentionsOnly: true }),
      workspaceSlug: 'acme',
      canManage: false,
      onSetNotificationLevel: vi.fn(),
    });
    const levels = find(actions, 'notifications')?.children ?? [];
    expect(levels.find((c) => c.checked)?.id).toBe('notify-mentions');
    expect(find(actions, 'notifications')?.hint).toBe('Just mentions');
  });

  it('unmutes back to the level underneath the mute', () => {
    const onSetNotificationLevel = vi.fn();
    const muted = buildChannelActions({
      channel: withMembership({ isMuted: true, mentionsOnly: true }),
      workspaceSlug: 'acme',
      canManage: false,
      onSetNotificationLevel,
    });
    expect(find(muted, 'mute')?.label).toBe('Unmute channel');
    find(muted, 'mute')?.run?.();
    expect(onSetNotificationLevel).toHaveBeenLastCalledWith('mentions');

    const unmuted = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: false,
      onSetNotificationLevel,
    });
    find(unmuted, 'mute')?.run?.();
    expect(onSetNotificationLevel).toHaveBeenLastCalledWith('nothing');
  });

  it('routes details and settings to the right tab', () => {
    const onOpenDetails = vi.fn();
    const actions = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: false,
      onOpenDetails,
    });
    find(actions, 'details')?.run?.();
    expect(onOpenDetails).toHaveBeenLastCalledWith('about');
    find(actions, 'settings')?.run?.();
    expect(onOpenDetails).toHaveBeenLastCalledWith('settings');
  });

  it('labels hide by the current state', () => {
    const shown = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: false,
      onToggleHidden: vi.fn(),
    });
    expect(find(shown, 'hide')?.label).toBe('Hide from sidebar');

    const hidden = buildChannelActions({
      channel,
      workspaceSlug: 'acme',
      canManage: false,
      isHidden: true,
      onToggleHidden: vi.fn(),
    });
    expect(find(hidden, 'hide')?.label).toBe('Show in sidebar');
  });
});

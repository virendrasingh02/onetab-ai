import { describe, expect, it } from 'vitest';
import {
  canChangeChannelVisibility,
  canDeleteChannel,
  canManageChannelTabs,
  normalizeChannelTabLayout,
  resolveChannelTabs,
} from './channel-settings.js';

describe('resolveChannelTabs', () => {
  it('returns the default order with nothing stored', () => {
    expect(resolveChannelTabs()).toEqual([
      { id: 'files-media', hidden: false },
      { id: 'bookmarks', hidden: false },
      { id: 'pins', hidden: false },
    ]);
  });

  it('puts stored ids first, then appends tabs the layout never mentioned', () => {
    expect(resolveChannelTabs(['pins'], []).map((tab) => tab.id)).toEqual([
      'pins',
      'files-media',
      'bookmarks',
    ]);
  });

  it('drops unknown and repeated ids, and flags hidden ones', () => {
    expect(
      resolveChannelTabs(['canvas', 'bookmarks', 'bookmarks'], ['pins', 'x']),
    ).toEqual([
      { id: 'bookmarks', hidden: false },
      { id: 'files-media', hidden: false },
      { id: 'pins', hidden: true },
    ]);
  });
});

describe('normalizeChannelTabLayout', () => {
  it('stores a complete order and only known hidden ids', () => {
    expect(normalizeChannelTabLayout(['pins'], ['pins', 'nope'])).toEqual({
      tabOrder: ['pins', 'files-media', 'bookmarks'],
      hiddenTabs: ['pins'],
    });
  });
});

describe('canManageChannelTabs', () => {
  it('EVERYONE means any channel member', () => {
    expect(
      canManageChannelTabs('EVERYONE', { channelRole: 'MEMBER', workspaceRole: 'MEMBER' }),
    ).toBe(true);
    expect(
      canManageChannelTabs('EVERYONE', { channelRole: null, workspaceRole: 'MEMBER' }),
    ).toBe(false);
  });

  it('MANAGERS means channel admins and workspace admins', () => {
    expect(
      canManageChannelTabs('MANAGERS', { channelRole: 'MEMBER', workspaceRole: 'MEMBER' }),
    ).toBe(false);
    expect(
      canManageChannelTabs('MANAGERS', { channelRole: 'ADMIN', workspaceRole: 'MEMBER' }),
    ).toBe(true);
    expect(
      canManageChannelTabs('MANAGERS', { channelRole: null, workspaceRole: 'OWNER' }),
    ).toBe(true);
  });
});

describe('visibility and deletion', () => {
  const channelAdmin = { channelRole: 'ADMIN', workspaceRole: 'MEMBER' } as const;
  const workspaceAdmin = { channelRole: null, workspaceRole: 'ADMIN' } as const;

  it('a channel admin may make a channel private but not public', () => {
    expect(canChangeChannelVisibility('PRIVATE', channelAdmin)).toBe(true);
    expect(canChangeChannelVisibility('PUBLIC', channelAdmin)).toBe(false);
  });

  it('a workspace admin may do both', () => {
    expect(canChangeChannelVisibility('PRIVATE', workspaceAdmin)).toBe(true);
    expect(canChangeChannelVisibility('PUBLIC', workspaceAdmin)).toBe(true);
  });

  it('only workspace admins and owners may delete', () => {
    expect(canDeleteChannel(channelAdmin)).toBe(false);
    expect(canDeleteChannel(workspaceAdmin)).toBe(true);
    expect(canDeleteChannel({ channelRole: null, workspaceRole: 'OWNER' })).toBe(true);
  });
});

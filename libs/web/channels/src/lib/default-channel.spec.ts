// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ChannelRole, ChannelVisibility, type ChannelSummary } from '@org/types';
import { resolveDefaultChannel, useGroupedChannels } from './use-channels.js';
import { renderHook } from '@testing-library/react';

const mockChannels: ChannelSummary[] = [
  {
    id: 'ch-random',
    workspaceId: 'ws-1',
    name: 'random',
    slug: 'random',
    topic: 'Random chat',
    description: null,
    visibility: ChannelVisibility.PUBLIC,
    isArchived: false,
    archivedAt: null,
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 10,
    membership: {
      role: ChannelRole.MEMBER,
      isFavorite: false,
      isMuted: false,
      lastReadAt: null,
    },
  },
  {
    id: 'ch-general',
    workspaceId: 'ws-1',
    name: 'general',
    slug: 'general',
    topic: 'General discussions',
    description: null,
    visibility: ChannelVisibility.PUBLIC,
    isArchived: false,
    archivedAt: null,
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 10,
    membership: {
      role: ChannelRole.MEMBER,
      isFavorite: false,
      isMuted: false,
      lastReadAt: null,
    },
  },
  {
    id: 'ch-dev',
    workspaceId: 'ws-1',
    name: 'development',
    slug: 'development',
    topic: 'Engineering',
    description: null,
    visibility: ChannelVisibility.PUBLIC,
    isArchived: false,
    archivedAt: null,
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 8,
    membership: {
      role: ChannelRole.MEMBER,
      isFavorite: false,
      isMuted: false,
      lastReadAt: null,
    },
  },
];

describe('Default Channel & Channel Priority', () => {
  it('pins #general to the top of joined channels regardless of alphabetical order', () => {
    const { result } = renderHook(() => useGroupedChannels(mockChannels));
    const joinedSlugs = result.current.joined.map((c) => c.slug);
    expect(joinedSlugs[0]).toBe('general');
    expect(joinedSlugs).toEqual(['general', 'development', 'random']);
  });

  it('resolveDefaultChannel returns user preferred channel when specified', () => {
    const defaultChan = resolveDefaultChannel(mockChannels, 'development');
    expect(defaultChan?.slug).toBe('development');
  });

  it('resolveDefaultChannel falls back to #general when no valid preference is provided', () => {
    const defaultChan = resolveDefaultChannel(mockChannels, 'non-existent');
    expect(defaultChan?.slug).toBe('general');
  });

  it('resolveDefaultChannel falls back to legacy #public if #general does not exist', () => {
    const legacyChannels: ChannelSummary[] = [
      {
        ...mockChannels[0],
        id: 'ch-legacy',
        name: 'public',
        slug: 'public',
      },
    ];
    const defaultChan = resolveDefaultChannel(legacyChannels);
    expect(defaultChan?.slug).toBe('public');
  });
});

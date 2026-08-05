/**
 * Centralised TanStack Query keys.
 *
 * Hierarchical and built from a single factory so invalidation can target a
 * whole subtree — invalidating `channels.all(wsId)` also clears every channel
 * detail, member list and pin list beneath it.
 */
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  workspaces: {
    all: () => ['workspaces'] as const,
    list: () => ['workspaces', 'list'] as const,
    detail: (slug: string) => ['workspaces', 'detail', slug] as const,
  },
  channels: {
    all: (workspaceId: string) => ['channels', workspaceId] as const,
    list: (workspaceId: string, includeArchived: boolean) =>
      ['channels', workspaceId, 'list', { includeArchived }] as const,
    detail: (workspaceId: string, slug: string) =>
      ['channels', workspaceId, 'detail', slug] as const,
    members: (workspaceId: string, channelId: string) =>
      ['channels', workspaceId, channelId, 'members'] as const,
    pins: (workspaceId: string, channelId: string) =>
      ['channels', workspaceId, channelId, 'pins'] as const,
    files: (workspaceId: string, channelId: string) =>
      ['channels', workspaceId, channelId, 'files'] as const,
  },
  members: {
    all: (workspaceId: string) => ['members', workspaceId] as const,
    list: (workspaceId: string) => ['members', workspaceId, 'list'] as const,
    search: (workspaceId: string, query: string) =>
      ['members', workspaceId, 'search', query] as const,
  },
  invitations: {
    all: (workspaceId: string) => ['invitations', workspaceId] as const,
    list: (workspaceId: string) =>
      ['invitations', workspaceId, 'list'] as const,
  },
  analytics: {
    all: (workspaceId: string) => ['analytics', workspaceId] as const,
    dashboard: (workspaceId: string, days: number) =>
      ['analytics', workspaceId, 'dashboard', days] as const,
    workspace: (workspaceId: string, days: number) =>
      ['analytics', workspaceId, 'workspace', days] as const,
    users: (workspaceId: string, days: number) =>
      ['analytics', workspaceId, 'users', days] as const,
    aiUsage: (workspaceId: string, days: number) =>
      ['analytics', workspaceId, 'ai-usage', days] as const,
    storage: (workspaceId: string, days: number) =>
      ['analytics', workspaceId, 'storage', days] as const,
    errors: (workspaceId: string, hours: number) =>
      ['analytics', workspaceId, 'errors', hours] as const,
    reports: (workspaceId: string) =>
      ['analytics', workspaceId, 'reports'] as const,
    report: (workspaceId: string, type: string, days: number) =>
      ['analytics', workspaceId, 'reports', type, days] as const,
    /** Not workspace-scoped — the whole API process is the subject. */
    platform: () => ['analytics', 'platform'] as const,
    performance: () => ['analytics', 'platform', 'performance'] as const,
    health: () => ['analytics', 'platform', 'health'] as const,
    platformErrors: (hours: number) =>
      ['analytics', 'platform', 'errors', hours] as const,
  },
  matrix: {
    all: () => ['matrix'] as const,
    /** Cached per channel: provisioning a room is not free. */
    channelRoom: (channelId: string) =>
      ['matrix', 'channel-room', channelId] as const,
  },
} as const;

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
  marketplace: {
    all: () => ['marketplace'] as const,
    storefronts: () => ['marketplace', 'storefronts'] as const,
    stats: (workspaceId: string) =>
      ['marketplace', 'stats', workspaceId] as const,
    /** Serialized filters so every distinct browse is cached separately. */
    browse: (workspaceId: string, filters: string) =>
      ['marketplace', 'listings', workspaceId, filters] as const,
    listing: (slug: string, workspaceId: string) =>
      ['marketplace', 'listing', slug, workspaceId] as const,
    categories: (kind: string) =>
      ['marketplace', 'categories', kind] as const,
    reviews: (slug: string) => ['marketplace', 'reviews', slug] as const,
    installations: (workspaceId: string, kind: string) =>
      ['marketplace', 'installations', workspaceId, kind] as const,
    sdk: () => ['marketplace', 'sdk'] as const,
    registration: (slug: string) =>
      ['marketplace', 'registration', slug] as const,
  },
  matrix: {
    all: () => ['matrix'] as const,
    /** Cached per channel: provisioning a room is not free. */
    channelRoom: (channelId: string) =>
      ['matrix', 'channel-room', channelId] as const,
    /** A peer's Matrix id, cached because the mapping never changes. */
    peerIdentity: (userId: string) =>
      ['matrix', 'peer-identity', userId] as const,
  },
  agents: {
    all: (workspaceId: string) => ['agents', workspaceId] as const,
    list: (workspaceId: string) => ['agents', workspaceId, 'list'] as const,
    /** The catalogue is platform-wide, so it is not keyed by workspace. */
    catalogue: () => ['agents', 'catalogue'] as const,
    logs: (workspaceId: string, agentId: string) =>
      ['agents', workspaceId, agentId, 'logs'] as const,
    workspaceLogs: (workspaceId: string) =>
      ['agents', workspaceId, 'logs'] as const,
  },
  automations: {
    all: (workspaceId: string) => ['automations', workspaceId] as const,
    list: (workspaceId: string) =>
      ['automations', workspaceId, 'list'] as const,
    executions: (workspaceId: string, workflowId: string) =>
      ['automations', workspaceId, workflowId, 'executions'] as const,
    workspaceExecutions: (workspaceId: string) =>
      ['automations', workspaceId, 'executions'] as const,
  },
  integrations: {
    all: (workspaceId: string) => ['integrations', workspaceId] as const,
    list: (workspaceId: string) =>
      ['integrations', workspaceId, 'list'] as const,
  },
  admin: {
    all: () => ['admin'] as const,
    overview: () => ['admin', 'overview'] as const,
    users: (q: string, role: string, page: number) =>
      ['admin', 'users', q, role, page] as const,
    user: (userId: string) => ['admin', 'users', userId] as const,
    workspaces: (q: string, page: number) =>
      ['admin', 'workspaces', q, page] as const,
    workspace: (workspaceId: string) =>
      ['admin', 'workspaces', workspaceId] as const,
    organizations: () => ['admin', 'organizations'] as const,
    auditLogs: (organizationId: string, page: number) =>
      ['admin', 'audit-logs', organizationId, page] as const,
  },
  enterprise: {
    all: () => ['enterprise'] as const,
    organization: (organizationId: string) =>
      ['enterprise', 'organizations', organizationId] as const,
  },
  uploads: {
    all: (workspaceId: string) => ['uploads', workspaceId] as const,
    list: (workspaceId: string, channelId?: string) =>
      ['uploads', workspaceId, 'list', channelId ?? 'all'] as const,
  },
  promptTemplates: {
    all: (workspaceId: string) => ['prompt-templates', workspaceId] as const,
    list: (workspaceId: string) =>
      ['prompt-templates', workspaceId, 'list'] as const,
  },
  search: {
    all: (workspaceId: string) => ['search', workspaceId] as const,
    query: (workspaceId: string, q: string, category?: string) =>
      ['search', workspaceId, q, category ?? 'all'] as const,
    counts: (workspaceId: string, q: string) =>
      ['search', workspaceId, 'counts', q] as const,
  },
  notifications: {
    all: (workspaceId: string) => ['notifications', workspaceId] as const,
    preferences: (workspaceId: string) =>
      ['notifications', workspaceId, 'preferences'] as const,
    feed: (workspaceId: string) =>
      ['notifications', workspaceId, 'feed'] as const,
    /** Devices belong to the person, not a workspace. */
    devices: () => ['notifications', 'devices'] as const,
  },
  workTools: {
    all: (workspaceId: string) => ['work-tools', workspaceId] as const,
    projects: (workspaceId: string) =>
      ['work-tools', workspaceId, 'projects'] as const,
    /** `projectId` narrows the board; `undefined` is the all-tasks view. */
    tasks: (workspaceId: string, projectId?: string) =>
      ['work-tools', workspaceId, 'tasks', projectId ?? 'all'] as const,
    taskComments: (workspaceId: string, taskId: string) =>
      ['work-tools', workspaceId, 'tasks', taskId, 'comments'] as const,
    calendar: (workspaceId: string, from?: string, to?: string) =>
      ['work-tools', workspaceId, 'calendar', from ?? '', to ?? ''] as const,
    documents: (workspaceId: string, kind?: string) =>
      ['work-tools', workspaceId, 'documents', kind ?? 'all'] as const,
    document: (workspaceId: string, docId: string) =>
      ['work-tools', workspaceId, 'documents', docId] as const,
    whiteboards: (workspaceId: string) =>
      ['work-tools', workspaceId, 'whiteboards'] as const,
    whiteboard: (workspaceId: string, whiteboardId: string) =>
      ['work-tools', workspaceId, 'whiteboards', whiteboardId] as const,
  },
} as const;

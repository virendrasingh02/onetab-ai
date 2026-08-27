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
  user: {
    preferences: () => ['user', 'preferences'] as const,
    sidebarPreferences: () => ['user', 'sidebar-preferences'] as const,
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
    list: (
      workspaceId: string,
      filters?: { status?: string; search?: string; scope?: string },
    ) => ['invitations', workspaceId, 'list', filters ?? {}] as const,
    links: (workspaceId: string) =>
      ['invitations', workspaceId, 'links'] as const,
    preview: (token: string) => ['invitations', 'preview', token] as const,
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
    providers: (workspaceId: string) =>
      ['integrations', workspaceId, 'providers'] as const,
    detail: (workspaceId: string, integrationId: string) =>
      ['integrations', workspaceId, 'detail', integrationId] as const,
    messages: (
      workspaceId: string,
      integrationId: string,
      params?: { q?: string; pageToken?: string },
    ) =>
      ['integrations', workspaceId, 'messages', integrationId, params] as const,
    thread: (workspaceId: string, integrationId: string, threadId: string) =>
      ['integrations', workspaceId, 'thread', integrationId, threadId] as const,
    syncJobs: (workspaceId: string, integrationId: string) =>
      ['integrations', workspaceId, 'sync-jobs', integrationId] as const,
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
    /** The bell menu's paginated list. */
    list: (workspaceId: string, unreadOnly = false) =>
      ['notifications', workspaceId, 'list', unreadOnly ? 'unread' : 'all'] as const,
    /** Server-side unread total, polled for the bell badge. */
    unreadCount: (workspaceId: string) =>
      ['notifications', workspaceId, 'unread-count'] as const,
    /** Devices belong to the person, not a workspace. */
    devices: () => ['notifications', 'devices'] as const,
  },
  workTools: {
    all: (workspaceId: string) => ['work-tools', workspaceId] as const,
    teams: (workspaceId: string) =>
      ['work-tools', workspaceId, 'teams'] as const,
    initiatives: (workspaceId: string) =>
      ['work-tools', workspaceId, 'initiatives'] as const,
    projects: (workspaceId: string, teamId?: string) =>
      ['work-tools', workspaceId, 'projects', teamId ?? 'all'] as const,
    project: (workspaceId: string, projectId: string) =>
      ['work-tools', workspaceId, 'projects', 'detail', projectId] as const,
    epics: (workspaceId: string, projectId: string) =>
      ['work-tools', workspaceId, 'projects', projectId, 'epics'] as const,
    modules: (workspaceId: string, projectId: string) =>
      ['work-tools', workspaceId, 'projects', projectId, 'modules'] as const,
    cycles: (workspaceId: string, projectId?: string, teamId?: string) =>
      ['work-tools', workspaceId, 'cycles', projectId ?? 'all', teamId ?? 'all'] as const,
    /** `projectId` narrows the board; `undefined` is the all-tasks view. */
    tasks: (workspaceId: string, projectId?: string, filters?: Record<string, any>) =>
      ['work-tools', workspaceId, 'tasks', projectId ?? 'all', filters ?? {}] as const,
    task: (workspaceId: string, taskId: string) =>
      ['work-tools', workspaceId, 'tasks', 'detail', taskId] as const,
    taskComments: (workspaceId: string, taskId: string) =>
      ['work-tools', workspaceId, 'tasks', taskId, 'comments'] as const,
    relations: (workspaceId: string, taskId: string) =>
      ['work-tools', workspaceId, 'tasks', taskId, 'relations'] as const,
    savedViews: (workspaceId: string, projectId?: string, teamId?: string) =>
      ['work-tools', workspaceId, 'views', projectId ?? 'all', teamId ?? 'all'] as const,
    intake: (workspaceId: string, status?: string) =>
      ['work-tools', workspaceId, 'intake', status ?? 'all'] as const,
    projectUpdates: (workspaceId: string, projectId: string) =>
      ['work-tools', workspaceId, 'projects', projectId, 'updates'] as const,
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

import type {
  ActivityFeedItem,
  AdminAuditLogEntry,
  AdminDepartment,
  AdminOrganization,
  AdminOverview,
  AdminPage,
  AdminUser,
  AdminUserDetail,
  AdminWorkspace,
  AdminWorkspaceDetail,
  AgentExecutionLog,
  AgentExecutionLogEntry,
  AgentRunResult,
  AIAgent,
  AIAgentDetail,
  AIChatRequest,
  AIChatResponse,
  AIImageResponse,
  AIModelMetadata,
  AIProvider,
  AIProviderMetadata,
  AIRagResult,
  AISummaryResponse,
  AITranslationResponse,
  AIUsageStats,
  AIVisionResponse,
  AuthTokens,
  AutomationWorkflow,
  AutomationWorkflowDetail,
  CalendarEvent,
  Channel,
  ChannelMember,
  ChannelPin,
  ChannelSummary,
  CurrentUser,
  DashboardOverview,
  DocumentKind,
  EnterpriseOrganization,
  ErrorTrackingReport,
  ExternalIntegration,
  GeneratedReport,
  HealthStatus,
  Invitation,
  MarketplaceBrowseParams,
  MarketplaceCategoryCount,
  MarketplaceInstallation,
  MarketplaceKind,
  MarketplaceListingDetail,
  MarketplacePage,
  MarketplaceReview,
  MarketplaceStorefrontStat,
  MarketplaceStorefronts,
  NotificationPreference,
  PerformanceMetrics,
  PluginCredentials,
  PluginManifest,
  PluginManifestValidation,
  PluginRegistrationView,
  PluginSDKDescriptor,
  Project,
  ProjectDetail,
  PromptTemplate,
  ProviderConnectionTestResult,
  PublicUser,
  PushDevice,
  ReportDefinition,
  ReportType,
  SaveProviderCredentialInput,
  SearchCategory,
  SearchResultItem,
  SSOConfiguration,
  StorageAnalytics,
  SystemRole,
  Task,
  TaskComment,
  Upload,
  UserAnalytics,
  UpdateModelSettingsInput,
  Whiteboard,
  WorkDocument,
  Workspace,
  WorkspaceAnalytics,
  WorkflowExecution,
  WorkflowExecutionEntry,
  WorkspaceMember,
  WorkspaceSummary,
} from '@org/types';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  CreateCalendarEventInput,
  CreateChannelInput,
  CreateDocumentInput,
  CreatePinInput,
  CreateProjectInput,
  CreatePromptTemplateInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  CreateWhiteboardInput,
  CreateWorkspaceInput,
  DesktopAuthorizeInput,
  DesktopExchangeInput,
  ApproveDeviceAuthInput,
  CreateDeviceAuthInput,
  CreateDeviceAuthResponse,
  DeviceAuthInfoResponse,
  ExchangeDeviceAuthInput,
  ForgotPasswordInput,
  IconPatch,
  InviteMembersInput,
  LoginInput,
  MoveTaskInput,
  PollDeviceAuthInput,
  RegisterInput,
  RejectDeviceAuthInput,
  ResetPasswordInput,
  UpdateCalendarEventInput,
  UpdateChannelInput,
  UpdateDocumentInput,
  UpdateMemberRoleInput,
  UpdateProfileInput,
  UpdateProjectInput,
  UpdatePromptTemplateInput,
  UpdateStatusInput,
  UpdateTaskInput,
  UpdateWhiteboardInput,
  UpdateWorkspaceInput,
} from '@org/validation';
import { http, request, resolveMediaUrl } from './http.js';

/** `POST /auth/*` responses carry the user alongside the token pair. */
export interface AuthResponse extends AuthTokens {
  user: CurrentUser;
}

export const authApi = {
  register: (input: RegisterInput) =>
    request<AuthResponse>(http.post('/auth/register', input)),

  login: (input: LoginInput) =>
    request<AuthResponse>(http.post('/auth/login', input)),

  logout: () => request<void>(http.post('/auth/logout')),

  refresh: (options?: { signal?: AbortSignal }) =>
    request<AuthTokens>(http.post('/auth/refresh', {}, options)),

  me: () => request<CurrentUser>(http.get('/auth/me')),

  forgotPassword: (input: ForgotPasswordInput) =>
    request<{ message: string; devToken?: string }>(
      http.post('/auth/forgot-password', input),
    ),

  resetPassword: (input: ResetPasswordInput) =>
    request<void>(http.post('/auth/reset-password', input)),

  authorizeDesktop: (input: DesktopAuthorizeInput) =>
    request<{ code: string; state: string }>(
      http.post('/auth/desktop/authorize', input),
    ),

  exchangeDesktopCode: (input: DesktopExchangeInput) =>
    request<AuthResponse & { refreshToken: string }>(
      http.post('/auth/desktop/exchange', input),
    ),

  createDeviceAuth: (input: CreateDeviceAuthInput) =>
    request<CreateDeviceAuthResponse>(
      http.post('/auth/device/create', input),
    ),

  getDeviceAuthInfo: (params: { requestId?: string; code?: string }) =>
    request<DeviceAuthInfoResponse>(
      http.get('/auth/device/info', { params }),
    ),

  approveDeviceAuth: (input: ApproveDeviceAuthInput) =>
    request<{ success: boolean; status: string }>(
      http.post('/auth/device/approve', input),
    ),

  rejectDeviceAuth: (input: RejectDeviceAuthInput) =>
    request<{ success: boolean }>(
      http.post('/auth/device/reject', input),
    ),

  exchangeDeviceAuth: (input: ExchangeDeviceAuthInput) =>
    request<AuthResponse & { refreshToken: string }>(
      http.post('/auth/device/exchange', input),
    ),

  pollDeviceAuthStatus: (input: PollDeviceAuthInput) =>
    request<{ status: 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed' }>(
      http.post('/auth/device/status', input),
    ),
};

/**
 * An uploaded workspace logo is stored as an API-relative path, because the API
 * host is not fixed. Resolving it here means every consumer — switcher,
 * settings, the create wizard — can render `avatarUrl` directly.
 */
function withResolvedAvatar<T extends { avatarUrl?: string | null }>(
  workspace: T,
): T {
  return { ...workspace, avatarUrl: resolveMediaUrl(workspace.avatarUrl) ?? null };
}

export const workspaceApi = {
  list: () =>
    request<WorkspaceSummary[]>(http.get('/workspaces')).then((list) =>
      list.map(withResolvedAvatar),
    ),

  bySlug: (slug: string) =>
    request<WorkspaceSummary>(http.get(`/workspaces/${slug}`)).then(
      withResolvedAvatar,
    ),

  create: (input: CreateWorkspaceInput) =>
    request<WorkspaceSummary>(http.post('/workspaces', input)).then(
      withResolvedAvatar,
    ),

  update: (workspaceId: string, input: UpdateWorkspaceInput) =>
    request<Workspace>(http.patch(`/workspaces/${workspaceId}`, input)).then(
      withResolvedAvatar,
    ),

  remove: (workspaceId: string) =>
    request<void>(http.delete(`/workspaces/${workspaceId}`)),

  /**
   * Freezes the workspace: it stays listed and readable, but the API refuses
   * every write until it is restored.
   *
   * The reversible half of the Danger Zone, and the step to offer before
   * `remove`, which is not.
   */
  archive: (workspaceId: string) =>
    request<void>(http.post(`/workspaces/${workspaceId}/archive`)),

  restore: (workspaceId: string) =>
    request<void>(http.post(`/workspaces/${workspaceId}/restore`)),

  /**
   * The icon half of a workspace update, on its own.
   *
   * It shares the `PATCH` route with everything else about a workspace, but the
   * global icon layer addresses entities through one saver per kind rather than
   * through each screen's form patch — so this is the workspace's saver, and
   * nothing about picking an icon has to know the shape of the settings form.
   */
  setIcon: (workspaceId: string, selection: IconPatch) =>
    request<Workspace>(http.patch(`/workspaces/${workspaceId}`, selection)).then(
      withResolvedAvatar,
    ),

  /**
   * Multipart, so the Content-Type header is left to the browser — it has to
   * append the boundary, and setting it by hand produces an unparseable body.
   */
  uploadLogo: (workspaceId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Workspace>(
      http.post(`/workspaces/${workspaceId}/logo`, form, {
        headers: { 'Content-Type': undefined as unknown as string },
        timeout: 0,
      }),
    ).then(withResolvedAvatar);
  },

  removeLogo: (workspaceId: string) =>
    request<Workspace>(http.delete(`/workspaces/${workspaceId}/logo`)).then(
      withResolvedAvatar,
    ),

  suggestSlug: (name: string) =>
    request<{ slug: string }>(
      http.get('/workspaces/slug-suggestion', { params: { name } }),
    ),

  transferOwnership: (workspaceId: string, userId: string) =>
    request<void>(
      http.post(`/workspaces/${workspaceId}/transfer-ownership`, { userId }),
    ),
};

export const channelApi = {
  list: (workspaceId: string, includeArchived = false) =>
    request<ChannelSummary[]>(
      http.get(`/workspaces/${workspaceId}/channels`, {
        params: { includeArchived },
      }),
    ),

  bySlug: (workspaceId: string, slug: string) =>
    request<ChannelSummary>(
      http.get(`/workspaces/${workspaceId}/channels/by-slug/${slug}`),
    ),

  create: (workspaceId: string, input: CreateChannelInput) =>
    request<Channel>(http.post(`/workspaces/${workspaceId}/channels`, input)),

  update: (workspaceId: string, channelId: string, input: UpdateChannelInput) =>
    request<Channel>(
      http.patch(`/workspaces/${workspaceId}/channels/${channelId}`, input),
    ),

  archive: (workspaceId: string, channelId: string) =>
    request<Channel>(
      http.post(`/workspaces/${workspaceId}/channels/${channelId}/archive`),
    ),

  unarchive: (workspaceId: string, channelId: string) =>
    request<Channel>(
      http.post(`/workspaces/${workspaceId}/channels/${channelId}/unarchive`),
    ),

  makePrivate: (workspaceId: string, channelId: string) =>
    request<Channel>(
      http.post(
        `/workspaces/${workspaceId}/channels/${channelId}/make-private`,
      ),
    ),

  join: (workspaceId: string, channelId: string) =>
    request<void>(
      http.post(`/workspaces/${workspaceId}/channels/${channelId}/join`),
    ),

  setPreferences: (
    workspaceId: string,
    channelId: string,
    input: ChannelPreferencesInput,
  ) =>
    request<void>(
      http.patch(
        `/workspaces/${workspaceId}/channels/${channelId}/preferences`,
        input,
      ),
    ),

  markRead: (workspaceId: string, channelId: string) =>
    request<void>(
      http.post(`/workspaces/${workspaceId}/channels/${channelId}/read`),
    ),

  members: (workspaceId: string, channelId: string) =>
    request<ChannelMember[]>(
      http.get(`/workspaces/${workspaceId}/channels/${channelId}/members`),
    ),

  addMembers: (
    workspaceId: string,
    channelId: string,
    input: AddChannelMembersInput,
  ) =>
    request<ChannelMember[]>(
      http.post(
        `/workspaces/${workspaceId}/channels/${channelId}/members`,
        input,
      ),
    ),

  removeMember: (workspaceId: string, channelId: string, userId: string) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/channels/${channelId}/members/${userId}`,
      ),
    ),

  pins: (workspaceId: string, channelId: string) =>
    request<ChannelPin[]>(
      http.get(`/workspaces/${workspaceId}/channels/${channelId}/pins`),
    ),

  createPin: (workspaceId: string, channelId: string, input: CreatePinInput) =>
    request<ChannelPin>(
      http.post(`/workspaces/${workspaceId}/channels/${channelId}/pins`, input),
    ),

  removePin: (workspaceId: string, channelId: string, pinId: string) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/channels/${channelId}/pins/${pinId}`,
      ),
    ),

  files: (workspaceId: string, channelId: string) =>
    request<Upload[]>(
      http.get(`/workspaces/${workspaceId}/channels/${channelId}/files`),
    ),
};

export const memberApi = {
  list: (workspaceId: string) =>
    request<WorkspaceMember[]>(http.get(`/workspaces/${workspaceId}/members`)),

  updateRole: (
    workspaceId: string,
    userId: string,
    input: UpdateMemberRoleInput,
  ) =>
    request<void>(
      http.patch(`/workspaces/${workspaceId}/members/${userId}/role`, input),
    ),

  remove: (workspaceId: string, userId: string) =>
    request<void>(http.delete(`/workspaces/${workspaceId}/members/${userId}`)),

  leave: (workspaceId: string) =>
    request<void>(http.post(`/workspaces/${workspaceId}/members/leave`)),

  search: (workspaceId: string, query: string) =>
    request<PublicUser[]>(
      http.get(`/workspaces/${workspaceId}/users/search`, {
        params: { q: query },
      }),
    ),
};

export const invitationApi = {
  list: (workspaceId: string) =>
    request<Invitation[]>(http.get(`/workspaces/${workspaceId}/invitations`)),

  create: (workspaceId: string, input: InviteMembersInput) =>
    request<{
      invited: Invitation[];
      alreadyMembers: string[];
      tokens?: Record<string, string>;
    }>(http.post(`/workspaces/${workspaceId}/invitations`, input)),

  revoke: (workspaceId: string, invitationId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`),
    ),

  accept: (token: string) =>
    request<{ workspaceSlug: string }>(
      http.post('/invitations/accept', { token }),
    ),
};

export const userApi = {
  updateProfile: (input: UpdateProfileInput) =>
    request<CurrentUser>(http.patch('/users/me', input)),

  updateStatus: (input: UpdateStatusInput) =>
    request<CurrentUser>(http.patch('/users/me/status', input)),

  clearStatus: () =>
    request<CurrentUser>(
      http.patch('/users/me/status', {
        statusText: null,
        statusEmoji: null,
        statusExpiresAt: null,
      }),
    ),

  setPresence: (presence: CurrentUser['presence']) =>
    request<{ presence: string }>(
      http.patch('/users/me/presence', { presence }),
    ),

  byId: (userId: string) => request<PublicUser>(http.get(`/users/${userId}`)),
};

/** Matrix session brokering. The browser never holds Matrix credentials. */
export const matrixApi = {
  config: () =>
    request<{
      enabled: boolean;
      /** Whether this deployment can encrypt private channels. */
      encryption: boolean;
      serverName: string | null;
      homeserverUrl: string | null;
      /** Null until the user's Matrix identity has been provisioned. */
      matrixUserId: string | null;
    }>(http.get('/matrix/config')),

  /**
   * Mints a Matrix session for the signed-in user.
   *
   * Each call registers a device on the homeserver, so the client only reaches
   * for it when it has no stored session to resume.
   */
  session: () =>
    request<{
      homeserverUrl: string;
      matrixUserId: string;
      accessToken: string;
      deviceId: string;
    }>(http.post('/matrix/session')),

  /**
   * Resolves the Matrix room backing a channel, provisioning it on first use.
   *
   * `POST` rather than `GET` because it creates the room when the channel has
   * never been opened for chat.
   */
  channelRoom: (channelId: string) =>
    request<{ roomId: string }>(
      http.post(`/matrix/channels/${channelId}/room`),
    ),

  /**
   * A teammate's Matrix id, so the browser can open a direct message with them.
   *
   * The mapping is not derivable client-side — the localpart is hashed from our
   * user id — and asking for it provisions the peer's Matrix account if they
   * have never opened chat.
   */
  peerIdentity: (userId: string) =>
    request<{ matrixUserId: string }>(
      http.get(`/matrix/users/${userId}/identity`),
    ),
};

/**
 * Phase 11 — analytics, reporting and platform observability.
 *
 * `days` and `hours` are clamped server-side, so callers may pass whatever the
 * range picker is currently set to without validating it first.
 */
export const analyticsApi = {
  dashboard: (workspaceId: string, days: number) =>
    request<DashboardOverview>(
      http.get(`/analytics/workspace/${workspaceId}/dashboard`, {
        params: { days },
      }),
    ),

  workspace: (workspaceId: string, days: number) =>
    request<WorkspaceAnalytics>(
      http.get(`/analytics/workspace/${workspaceId}`, { params: { days } }),
    ),

  users: (workspaceId: string, days: number) =>
    request<UserAnalytics>(
      http.get(`/analytics/workspace/${workspaceId}/users`, {
        params: { days },
      }),
    ),

  aiUsage: (workspaceId: string, days: number) =>
    request<AIUsageStats>(
      http.get(`/analytics/workspace/${workspaceId}/ai-usage`, {
        params: { days },
      }),
    ),

  storage: (workspaceId: string, days: number) =>
    request<StorageAnalytics>(
      http.get(`/analytics/workspace/${workspaceId}/storage`, {
        params: { days },
      }),
    ),

  errors: (workspaceId: string, hours: number) =>
    request<ErrorTrackingReport>(
      http.get(`/analytics/workspace/${workspaceId}/errors`, {
        params: { hours },
      }),
    ),

  platformErrors: (hours: number) =>
    request<ErrorTrackingReport>(
      http.get('/analytics/errors', { params: { hours } }),
    ),

  clearPlatformErrors: () =>
    request<{ cleared: number }>(http.delete('/analytics/errors')),

  performance: () =>
    request<PerformanceMetrics>(http.get('/analytics/performance')),

  health: () => request<HealthStatus>(http.get('/analytics/health')),

  reportDefinitions: (workspaceId: string) =>
    request<ReportDefinition[]>(
      http.get(`/analytics/workspace/${workspaceId}/reports`),
    ),

  report: (workspaceId: string, type: ReportType, days: number) =>
    request<GeneratedReport>(
      http.get(`/analytics/workspace/${workspaceId}/reports/${type}`, {
        params: { days },
      }),
    ),

  /**
   * CSV comes back as text, not JSON — callers turn this into a Blob download.
   */
  reportCsv: (workspaceId: string, type: ReportType, days: number) =>
    request<string>(
      http.get(`/analytics/workspace/${workspaceId}/reports/${type}`, {
        params: { days, format: 'csv' },
        responseType: 'text',
      }),
    ),

  trackEvent: (
    workspaceId: string,
    eventType: string,
    metadata?: Record<string, unknown>,
  ) =>
    request<{ id: string }>(
      http.post(`/analytics/workspace/${workspaceId}/events`, {
        eventType,
        metadata,
      }),
    ),
};

/**
 * Phase 12 — Marketplace.
 *
 * Browse calls take an optional `workspaceId` so the server can mark which
 * listings are already installed; it is a query param rather than a path
 * segment because browsing itself is not workspace-scoped.
 */
export const marketplaceApi = {
  storefronts: () =>
    request<MarketplaceStorefronts>(http.get('/marketplace/storefronts')),

  stats: (workspaceId?: string) =>
    request<MarketplaceStorefrontStat[]>(
      http.get('/marketplace/stats', { params: { workspaceId } }),
    ),

  browse: (params: MarketplaceBrowseParams, workspaceId?: string) =>
    request<MarketplacePage>(
      http.get('/marketplace/listings', { params: { ...params, workspaceId } }),
    ),

  listing: (slug: string, workspaceId?: string) =>
    request<MarketplaceListingDetail>(
      http.get(`/marketplace/listings/${slug}`, { params: { workspaceId } }),
    ),

  categories: (kind: MarketplaceKind) =>
    request<MarketplaceCategoryCount[]>(
      http.get(`/marketplace/kinds/${kind}/categories`),
    ),

  reviews: (slug: string) =>
    request<MarketplaceReview[]>(
      http.get(`/marketplace/listings/${slug}/reviews`),
    ),

  addReview: (
    slug: string,
    input: { rating: number; title?: string; body?: string; workspaceId?: string },
  ) =>
    request<MarketplaceReview>(
      http.post(`/marketplace/listings/${slug}/reviews`, input),
    ),

  installations: (workspaceId: string, kind?: MarketplaceKind) =>
    request<MarketplaceInstallation[]>(
      http.get(`/marketplace/workspaces/${workspaceId}/installations`, {
        params: { kind },
      }),
    ),

  install: (
    workspaceId: string,
    input: {
      listingSlug: string;
      grantedScopes?: string[];
      settings?: Record<string, unknown>;
    },
  ) =>
    request<MarketplaceInstallation>(
      http.post(`/marketplace/workspaces/${workspaceId}/installations`, input),
    ),

  setEnabled: (workspaceId: string, slug: string, enabled: boolean) =>
    request<MarketplaceInstallation>(
      http.patch(
        `/marketplace/workspaces/${workspaceId}/installations/${slug}`,
        { enabled },
      ),
    ),

  updateSettings: (
    workspaceId: string,
    slug: string,
    settings: Record<string, unknown>,
  ) =>
    request<MarketplaceInstallation>(
      http.patch(
        `/marketplace/workspaces/${workspaceId}/installations/${slug}`,
        { settings },
      ),
    ),

  uninstall: (workspaceId: string, slug: string) =>
    request<{ listingSlug: string; status: string }>(
      http.delete(
        `/marketplace/workspaces/${workspaceId}/installations/${slug}`,
      ),
    ),

  // --- Plugin SDK ---------------------------------------------------------

  sdk: () => request<PluginSDKDescriptor>(http.get('/marketplace/sdk')),

  validateManifest: (manifest: PluginManifest) =>
    request<PluginManifestValidation>(
      http.post('/marketplace/sdk/validate', manifest),
    ),

  registerPlugin: (slug: string, manifest: PluginManifest) =>
    request<PluginCredentials>(
      http.post(`/marketplace/plugins/${slug}/register`, manifest),
    ),

  registration: (slug: string) =>
    request<PluginRegistrationView>(
      http.get(`/marketplace/plugins/${slug}/registration`),
    ),

  rotatePluginKey: (slug: string) =>
    request<{ listingSlug: string; apiKey: string; apiKeyPrefix: string }>(
      http.post(`/marketplace/plugins/${slug}/rotate-key`),
    ),
};

/**
 * Projects, tasks, calendar, docs and whiteboards.
 *
 * Every path is nested under the workspace: the server resolves access from
 * that path parameter, so the workspace is never a caller-supplied filter.
 */
export const workToolsApi = {
  // --- projects -------------------------------------------------------------

  projects: (workspaceId: string) =>
    request<ProjectDetail[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/projects`),
    ),

  createProject: (workspaceId: string, input: CreateProjectInput) =>
    request<Project>(
      http.post(`/workspaces/${workspaceId}/work-tools/projects`, input),
    ),

  updateProject: (
    workspaceId: string,
    projectId: string,
    input: UpdateProjectInput,
  ) =>
    request<Project>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/projects/${projectId}`,
        input,
      ),
    ),

  deleteProject: (workspaceId: string, projectId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/projects/${projectId}`),
    ),

  /**
   * The icon half of a project update, on its own — the project's saver for the
   * global icon layer, which addresses entities through one saver per kind
   * rather than through each screen's form patch. See `workspaceApi.setIcon`.
   */
  setProjectIcon: (
    workspaceId: string,
    projectId: string,
    selection: IconPatch,
  ) =>
    request<Project>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/projects/${projectId}`,
        selection,
      ),
    ),

  // --- tasks ----------------------------------------------------------------

  tasks: (workspaceId: string, projectId?: string) =>
    request<Task[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/tasks`, {
        params: projectId ? { projectId } : undefined,
      }),
    ),

  createTask: (workspaceId: string, input: CreateTaskInput) =>
    request<Task>(
      http.post(`/workspaces/${workspaceId}/work-tools/tasks`, input),
    ),

  updateTask: (workspaceId: string, taskId: string, input: UpdateTaskInput) =>
    request<Task>(
      http.patch(`/workspaces/${workspaceId}/work-tools/tasks/${taskId}`, input),
    ),

  /** Board drag-and-drop: column plus position, nothing else. */
  moveTask: (workspaceId: string, taskId: string, input: MoveTaskInput) =>
    request<Task>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/tasks/${taskId}/move`,
        input,
      ),
    ),

  deleteTask: (workspaceId: string, taskId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/tasks/${taskId}`),
    ),

  taskComments: (workspaceId: string, taskId: string) =>
    request<TaskComment[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/tasks/${taskId}/comments`),
    ),

  addTaskComment: (
    workspaceId: string,
    taskId: string,
    input: CreateTaskCommentInput,
  ) =>
    request<TaskComment>(
      http.post(
        `/workspaces/${workspaceId}/work-tools/tasks/${taskId}/comments`,
        input,
      ),
    ),

  // --- calendar -------------------------------------------------------------

  calendar: (workspaceId: string, from?: string, to?: string) =>
    request<CalendarEvent[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/calendar`, {
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      }),
    ),

  createEvent: (workspaceId: string, input: CreateCalendarEventInput) =>
    request<CalendarEvent>(
      http.post(`/workspaces/${workspaceId}/work-tools/calendar`, input),
    ),

  updateEvent: (
    workspaceId: string,
    eventId: string,
    input: UpdateCalendarEventInput,
  ) =>
    request<CalendarEvent>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/calendar/${eventId}`,
        input,
      ),
    ),

  deleteEvent: (workspaceId: string, eventId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/calendar/${eventId}`),
    ),

  // --- documents ------------------------------------------------------------

  documents: (workspaceId: string, kind?: DocumentKind) =>
    request<WorkDocument[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/documents`, {
        params: kind ? { kind } : undefined,
      }),
    ),

  document: (workspaceId: string, docId: string) =>
    request<WorkDocument>(
      http.get(`/workspaces/${workspaceId}/work-tools/documents/${docId}`),
    ),

  createDocument: (workspaceId: string, input: CreateDocumentInput) =>
    request<WorkDocument>(
      http.post(`/workspaces/${workspaceId}/work-tools/documents`, input),
    ),

  updateDocument: (
    workspaceId: string,
    docId: string,
    input: UpdateDocumentInput,
  ) =>
    request<WorkDocument>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/documents/${docId}`,
        input,
      ),
    ),

  deleteDocument: (workspaceId: string, docId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/documents/${docId}`),
    ),

  // --- whiteboards ----------------------------------------------------------

  whiteboards: (workspaceId: string) =>
    request<Whiteboard[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/whiteboards`),
    ),

  whiteboard: (workspaceId: string, whiteboardId: string) =>
    request<Whiteboard>(
      http.get(
        `/workspaces/${workspaceId}/work-tools/whiteboards/${whiteboardId}`,
      ),
    ),

  createWhiteboard: (workspaceId: string, input: CreateWhiteboardInput) =>
    request<Whiteboard>(
      http.post(`/workspaces/${workspaceId}/work-tools/whiteboards`, input),
    ),

  updateWhiteboard: (
    workspaceId: string,
    whiteboardId: string,
    input: UpdateWhiteboardInput,
  ) =>
    request<Whiteboard>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/whiteboards/${whiteboardId}`,
        input,
      ),
    ),

  deleteWhiteboard: (workspaceId: string, whiteboardId: string) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/work-tools/whiteboards/${whiteboardId}`,
      ),
    ),
};

/** AI agents. Every route is workspace-scoped. */
export const agentsApi = {
  list: (workspaceId: string) =>
    request<AIAgentDetail[]>(http.get(`/workspaces/${workspaceId}/agents`)),

  create: (
    workspaceId: string,
    input: {
      name: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isMarketplace?: boolean;
    },
  ) => request<AIAgent>(http.post(`/workspaces/${workspaceId}/agents`, input)),

  update: (
    workspaceId: string,
    agentId: string,
    input: {
      name?: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isActive?: boolean;
    },
  ) =>
    request<AIAgent>(
      http.patch(`/workspaces/${workspaceId}/agents/${agentId}`, input),
    ),

  remove: (workspaceId: string, agentId: string) =>
    request<void>(http.delete(`/workspaces/${workspaceId}/agents/${agentId}`)),

  execute: (workspaceId: string, agentId: string, promptText: string) =>
    request<AgentRunResult>(
      http.post(`/workspaces/${workspaceId}/agents/${agentId}/execute`, {
        promptText,
      }),
    ),

  logs: (workspaceId: string, agentId: string) =>
    request<AgentExecutionLog[]>(
      http.get(`/workspaces/${workspaceId}/agents/${agentId}/logs`),
    ),

  /** Recent executions across every agent in the workspace. */
  workspaceLogs: (workspaceId: string) =>
    request<AgentExecutionLogEntry[]>(
      http.get(`/workspaces/${workspaceId}/agents/logs`),
    ),
};

export const automationsApi = {
  list: (workspaceId: string) =>
    request<AutomationWorkflowDetail[]>(
      http.get(`/workspaces/${workspaceId}/automations/workflows`),
    ),

  create: (
    workspaceId: string,
    input: {
      name: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
    },
  ) =>
    request<AutomationWorkflow>(
      http.post(`/workspaces/${workspaceId}/automations/workflows`, input),
    ),

  update: (
    workspaceId: string,
    workflowId: string,
    input: {
      name?: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
      isActive?: boolean;
    },
  ) =>
    request<AutomationWorkflow>(
      http.patch(
        `/workspaces/${workspaceId}/automations/workflows/${workflowId}`,
        input,
      ),
    ),

  remove: (workspaceId: string, workflowId: string) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/automations/workflows/${workflowId}`,
      ),
    ),

  trigger: (
    workspaceId: string,
    workflowId: string,
    payload: Record<string, unknown> = {},
  ) =>
    request<unknown>(
      http.post(
        `/workspaces/${workspaceId}/automations/workflows/${workflowId}/trigger`,
        payload,
      ),
    ),

  executions: (workspaceId: string, workflowId: string) =>
    request<WorkflowExecution[]>(
      http.get(
        `/workspaces/${workspaceId}/automations/workflows/${workflowId}/executions`,
      ),
    ),

  /** Recent runs across every workflow in the workspace. */
  workspaceExecutions: (workspaceId: string) =>
    request<WorkflowExecutionEntry[]>(
      http.get(`/workspaces/${workspaceId}/automations/executions`),
    ),
};

export const integrationsApi = {
  list: (workspaceId: string) =>
    request<ExternalIntegration[]>(
      http.get(`/workspaces/${workspaceId}/integrations`),
    ),

  connect: (
    workspaceId: string,
    provider: string,
    input: { accessToken?: string; config?: Record<string, unknown> } = {},
  ) =>
    request<ExternalIntegration>(
      http.post(`/workspaces/${workspaceId}/integrations/${provider}/connect`, input),
    ),

  disconnect: (workspaceId: string, provider: string) =>
    request<{ count: number }>(
      http.delete(`/workspaces/${workspaceId}/integrations/${provider}`),
    ),

  importSlack: (
    workspaceId: string,
    channels: Array<{ name: string; topic?: string; messagesCount: number }>,
  ) =>
    request<unknown>(
      http.post(`/workspaces/${workspaceId}/integrations/import/slack`, {
        channels,
      }),
    ),

  importNotion: (
    workspaceId: string,
    pages: Array<{ title: string; content: string }>,
  ) =>
    request<unknown>(
      http.post(`/workspaces/${workspaceId}/integrations/import/notion`, {
        pages,
      }),
    ),
};

export const uploadApi = {
  list: (workspaceId: string, channelId?: string) =>
    request<Upload[]>(
      http.get(`/workspaces/${workspaceId}/uploads`, {
        params: channelId ? { channelId } : undefined,
      }),
    ),

  /**
   * Multipart, so the Content-Type header is left to the browser — it has to
   * append the boundary, and setting it by hand produces an unparseable body.
   *
   * The instance-wide 15 s timeout is lifted here: it is sized for JSON round
   * trips, and a large attachment on a slow link would abort mid-transfer.
   */
  upload: (
    workspaceId: string,
    file: File,
    options: {
      channelId?: string;
      /** Receives 0–100 as the body goes out. */
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    } = {},
  ) => {
    const form = new FormData();
    form.append('file', file);
    return request<Upload>(
      http.post(`/workspaces/${workspaceId}/uploads`, form, {
        params: options.channelId ? { channelId: options.channelId } : undefined,
        headers: { 'Content-Type': undefined as unknown as string },
        timeout: 0,
        signal: options.signal,
        onUploadProgress: options.onProgress
          ? (event) => {
              // `total` is absent when the body length is unknown.
              if (!event.total) return;
              options.onProgress?.(
                Math.round((event.loaded / event.total) * 100),
              );
            }
          : undefined,
      }),
    );
  },

  /** Authenticated download, so it goes through axios rather than a bare href. */
  download: (workspaceId: string, uploadId: string) =>
    request<Blob>(
      http.get(`/workspaces/${workspaceId}/uploads/${uploadId}/content`, {
        responseType: 'blob',
      }),
    ),

  remove: (workspaceId: string, uploadId: string) =>
    request<void>(http.delete(`/workspaces/${workspaceId}/uploads/${uploadId}`)),
};

/**
 * Model inference for one workspace.
 *
 * Every route is a POST — these are actions with a cost, not cacheable reads —
 * and each is rate limited well below the global default on the API side.
 */
export const aiApi = {
  getProviders: (workspaceId: string) =>
    request<AIProviderMetadata[]>(
      http.get(`/workspaces/${workspaceId}/ai/providers`, { timeout: 30_000 }),
    ),

  getProvider: (workspaceId: string, provider: AIProvider) =>
    request<AIProviderMetadata>(
      http.get(`/workspaces/${workspaceId}/ai/providers/${provider}`, {
        timeout: 30_000,
      }),
    ),

  saveCredential: (
    workspaceId: string,
    provider: AIProvider,
    input: SaveProviderCredentialInput,
  ) =>
    request<AIProviderMetadata>(
      http.post(
        `/workspaces/${workspaceId}/ai/providers/${provider}/credentials`,
        input,
        { timeout: 30_000 },
      ),
    ),

  deleteCredential: (workspaceId: string, provider: AIProvider) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/ai/providers/${provider}/credentials`,
        { timeout: 30_000 },
      ),
    ),

  testProvider: (
    workspaceId: string,
    provider: AIProvider,
    model?: string,
  ) =>
    request<ProviderConnectionTestResult>(
      http.post(
        `/workspaces/${workspaceId}/ai/providers/${provider}/test`,
        { ...(model ? { model } : {}) },
        { timeout: 60_000 },
      ),
    ),

  updateModelSetting: (
    workspaceId: string,
    modelId: string,
    input: UpdateModelSettingsInput,
  ) =>
    request<void>(
      http.patch(`/workspaces/${workspaceId}/ai/models/${modelId}`, input, {
        timeout: 30_000,
      }),
    ),

  getModels: (workspaceId: string) =>
    request<AIModelMetadata[]>(
      http.get(`/workspaces/${workspaceId}/ai/models`, { timeout: 30_000 }),
    ),

  testConnection: (
    workspaceId: string,
    provider: AIProvider,
    model?: string,
  ) =>
    request<ProviderConnectionTestResult>(
      http.post(
        `/workspaces/${workspaceId}/ai/test-connection`,
        { provider, ...(model ? { model } : {}) },
        { timeout: 60_000 },
      ),
    ),

  chat: (workspaceId: string, input: AIChatRequest, signal?: AbortSignal) =>
    request<AIChatResponse>(
      http.post(`/workspaces/${workspaceId}/ai/chat`, input, {
        // Generation is slow; the instance-wide 15 s timeout would cut it off.
        timeout: 120_000,
        signal,
      }),
    ),

  summarize: (workspaceId: string, text: string) =>
    request<AISummaryResponse>(
      http.post(
        `/workspaces/${workspaceId}/ai/summarize`,
        { text },
        { timeout: 120_000 },
      ),
    ),

  translate: (workspaceId: string, text: string, targetLanguage: string) =>
    request<AITranslationResponse>(
      http.post(
        `/workspaces/${workspaceId}/ai/translate`,
        { text, targetLanguage },
        { timeout: 120_000 },
      ),
    ),

  generateImage: (workspaceId: string, prompt: string, provider?: string) =>
    request<AIImageResponse>(
      http.post(
        `/workspaces/${workspaceId}/ai/generate-image`,
        { prompt, ...(provider ? { provider } : {}) },
        { timeout: 180_000 },
      ),
    ),

  analyzeVision: (workspaceId: string, imageUrl: string, prompt?: string) =>
    request<AIVisionResponse>(
      http.post(
        `/workspaces/${workspaceId}/ai/vision`,
        { imageUrl, ...(prompt ? { prompt } : {}) },
        { timeout: 120_000 },
      ),
    ),

  ragSearch: (workspaceId: string, query: string, limit?: number) =>
    request<AIRagResult[]>(
      http.post(
        `/workspaces/${workspaceId}/ai/rag-search`,
        { query, ...(limit ? { limit } : {}) },
        { timeout: 60_000 },
      ),
    ),
};

/**
 * The prompt library.
 *
 * Reads return the workspace's own templates alongside the read-only system
 * ones; writes only ever touch the workspace's.
 */
export const promptTemplateApi = {
  list: (workspaceId: string) =>
    request<PromptTemplate[]>(
      http.get(`/workspaces/${workspaceId}/prompt-templates`),
    ),

  create: (workspaceId: string, input: CreatePromptTemplateInput) =>
    request<PromptTemplate>(
      http.post(`/workspaces/${workspaceId}/prompt-templates`, input),
    ),

  update: (
    workspaceId: string,
    templateId: string,
    input: UpdatePromptTemplateInput,
  ) =>
    request<PromptTemplate>(
      http.patch(
        `/workspaces/${workspaceId}/prompt-templates/${templateId}`,
        input,
      ),
    ),

  remove: (workspaceId: string, templateId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/prompt-templates/${templateId}`),
    ),
};

export const searchApi = {
  query: (
    workspaceId: string,
    q: string,
    category?: SearchCategory,
    limit?: number,
  ) =>
    request<SearchResultItem[]>(
      http.get(`/workspaces/${workspaceId}/search`, {
        params: { q, ...(category ? { category } : {}), ...(limit ? { limit } : {}) },
      }),
    ),

  counts: (workspaceId: string, q: string) =>
    request<Record<SearchCategory, number>>(
      http.get(`/workspaces/${workspaceId}/search/counts`, { params: { q } }),
    ),
};

export const notificationApi = {
  preferences: (workspaceId: string) =>
    request<NotificationPreference>(
      http.get(`/workspaces/${workspaceId}/notifications/preferences`),
    ),

  updatePreferences: (
    workspaceId: string,
    input: Partial<Omit<NotificationPreference, 'id' | 'userId' | 'workspaceId'>>,
  ) =>
    request<NotificationPreference>(
      http.patch(`/workspaces/${workspaceId}/notifications/preferences`, input),
    ),

  feed: (workspaceId: string, limit?: number) =>
    request<ActivityFeedItem[]>(
      http.get(`/workspaces/${workspaceId}/notifications/feed`, {
        params: limit ? { limit } : undefined,
      }),
    ),

  devices: () => request<PushDevice[]>(http.get('/notifications/devices')),

  registerDevice: (input: {
    pushKey: string;
    appId: string;
    deviceDisplayName?: string;
  }) => request<PushDevice>(http.post('/notifications/devices', input)),

  revokeDevice: (registrationId: string) =>
    request<void>(http.delete(`/notifications/devices/${registrationId}`)),
};

/**
 * The operator console's API.
 *
 * Every route is SUPERADMIN-only server-side and answers 404 otherwise, so a
 * non-operator loading the console sees "not found" rather than a wall of
 * permission errors.
 */
export const adminApi = {
  overview: () => request<AdminOverview>(http.get('/admin/overview')),

  users: (params: {
    q?: string;
    role?: SystemRole;
    page?: number;
    pageSize?: number;
  } = {}) =>
    request<AdminPage<AdminUser>>(http.get('/admin/users', { params })),

  user: (userId: string) =>
    request<AdminUserDetail>(http.get(`/admin/users/${userId}`)),

  setUserRole: (userId: string, role: SystemRole) =>
    request<{ id: string; email: string; systemRole: SystemRole }>(
      http.patch(`/admin/users/${userId}/role`, { role }),
    ),

  deleteUser: (userId: string) =>
    request<void>(http.delete(`/admin/users/${userId}`)),

  workspaces: (params: { q?: string; page?: number; pageSize?: number } = {}) =>
    request<AdminPage<AdminWorkspace>>(
      http.get('/admin/workspaces', { params }),
    ),

  workspace: (workspaceId: string) =>
    request<AdminWorkspaceDetail>(http.get(`/admin/workspaces/${workspaceId}`)),

  deleteWorkspace: (workspaceId: string) =>
    request<void>(http.delete(`/admin/workspaces/${workspaceId}`)),

  organizations: () =>
    request<AdminOrganization[]>(http.get('/admin/organizations')),

  createDepartment: (
    organizationId: string,
    input: { name: string; code?: string },
  ) =>
    request<AdminDepartment>(
      http.post(`/admin/organizations/${organizationId}/departments`, input),
    ),

  deleteDepartment: (organizationId: string, departmentId: string) =>
    request<void>(
      http.delete(
        `/admin/organizations/${organizationId}/departments/${departmentId}`,
      ),
    ),

  auditLogs: (
    params: { organizationId?: string; page?: number; pageSize?: number } = {},
  ) =>
    request<AdminPage<AdminAuditLogEntry>>(
      http.get('/admin/audit-logs', { params }),
    ),
};

/**
 * Enterprise governance — organisations, SSO and SCIM.
 *
 * Separate from `adminApi` because it is a separate controller with a separate
 * job: `adminApi` reads the platform's own tables, while these routes configure
 * a tenant's identity provider. Both are SUPERADMIN-only.
 */
export const enterpriseApi = {
  organization: (organizationId: string) =>
    request<EnterpriseOrganization>(
      http.get(`/enterprise/organizations/${organizationId}`),
    ),

  createOrganization: (input: {
    name: string;
    domain: string;
    billingEmail?: string;
  }) => request<EnterpriseOrganization>(http.post('/enterprise/organizations', input)),

  configureSSO: (
    organizationId: string,
    input: {
      providerType: string;
      idpEntityId?: string;
      ssoUrl?: string;
      certificate?: string;
    },
  ) =>
    request<SSOConfiguration>(
      http.post(`/enterprise/organizations/${organizationId}/sso`, input),
    ),

  rotateScimToken: (organizationId: string) =>
    request<SSOConfiguration>(
      http.post(
        `/enterprise/organizations/${organizationId}/sso/rotate-scim-token`,
      ),
    ),

  auditLogs: (organizationId: string) =>
    request<AdminAuditLogEntry[]>(
      http.get(`/enterprise/organizations/${organizationId}/audit-logs`),
    ),
};

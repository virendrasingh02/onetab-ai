import type {
  ActivityFeedItem,
  NotificationView,
  Paginated,
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
  AppActionDefinition,
  AppActionResult,
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
  IntegrationCapabilities,
  IntegrationMessage,
  IntegrationThread,
  IntegrationExecuteRequestInput,
  IntegrationExecuteResponse,
  IntegrationSyncJobDto,
  ReplyMessageInput,
  SendMessageInput,
  GeneratedReport,
  HealthStatus,
  Invitation,
  InvitationPublicPreview,
  InviteBatchResult,
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
  ProjectUpdate,
  PromptTemplate,
  ProviderConnectionTestResult,
  PublicUser,
  PushDevice,
  ReportDefinition,
  ReportType,
  SaveProviderCredentialInput,
  SavedView,
  SearchCategory,
  SearchResultItem,
  SSOConfiguration,
  StorageAnalytics,
  SystemRole,
  Task,
  TaskComment,
  Team,
  Upload,
  UserAnalytics,
  UserPreferences,
  UpdateModelSettingsInput,
  Whiteboard,
  WorkDocument,
  WorkItemRelation,
  Workspace,
  WorkspaceAnalytics,
  WorkflowExecution,
  WorkflowExecutionEntry,
  WorkspaceMember,
  WorkspaceSummary,
  Cycle,
  Epic,
  Initiative,
  IntakeRequest,
  Module,
} from '@org/types';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  ConvertIntakeRequestInput,
  CreateCalendarEventInput,
  CreateChannelInput,
  CreateCycleInput,
  CreateDocumentInput,
  CreateEpicInput,
  CreateInitiativeInput,
  CreateIntakeRequestInput,
  CreateModuleInput,
  CreatePinInput,
  CreateProjectInput,
  CreateProjectUpdateInput,
  CreatePromptTemplateInput,
  CreateSavedViewInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateWhiteboardInput,
  CreateWorkItemRelationInput,
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
  CreateInvitationLinkInput,
  UpdateInvitationLinkInput,
  LoginInput,
  MoveTaskInput,
  PollDeviceAuthInput,
  ProjectIdentifierSettingsInput,
  RegisterInput,
  RejectDeviceAuthInput,
  ResetPasswordInput,
  UpdateCalendarEventInput,
  UpdateChannelInput,
  UpdateCycleInput,
  UpdateDocumentInput,
  UpdateEpicInput,
  UpdateInitiativeInput,
  UpdateMemberRoleInput,
  UpdateModuleInput,
  UpdateProfileInput,
  UpdateProjectInput,
  UpdatePromptTemplateInput,
  UpdateSavedViewInput,
  UpdateStatusInput,
  UpdateTaskInput,
  UpdateTeamInput,
  UpdateUserPreferencesInput,
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

  /**
   * `refreshToken` in the body removes one *background* account from a
   * multi-account session (its token is revoked server-side, the active
   * account's cookie is left alone). Omit it for a normal sign-out, which
   * clears the refresh cookie.
   */
  logout: (body: { refreshToken?: string } = {}) =>
    request<void>(http.post('/auth/logout', body)),

  /**
   * With no `refreshToken` the API refreshes from the httpOnly cookie (the
   * single-account path). A background account, which has no cookie of its own,
   * passes its stored token here instead. Either way the rotated refresh token
   * comes back in the response so the caller can persist it.
   */
  refresh: (
    body: { refreshToken?: string } = {},
    options?: { signal?: AbortSignal },
  ) => request<AuthTokens>(http.post('/auth/refresh', body, options)),

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

  /**
   * The workspace list for a *specific* account, addressed by its own access
   * token rather than the one on the wire. Powers the multi-account switcher,
   * which shows every linked account's workspaces at once.
   *
   * `skipAuthRefresh` because a 401 here means *that* account's token lapsed —
   * refreshing the active session and retrying would return the wrong
   * identity's workspaces. The caller falls back to its cached list instead.
   */
  listForAccount: (accessToken: string) =>
    request<WorkspaceSummary[]>(
      http.get('/workspaces', {
        headers: { Authorization: `Bearer ${accessToken}` },
        skipAuthRefresh: true,
      }),
    ).then((list) => list.map(withResolvedAvatar)),

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
  list: (
    workspaceId: string,
    params?: { status?: string; search?: string; scope?: string },
  ) =>
    request<Invitation[]>(
      http.get(`/workspaces/${workspaceId}/invitations`, { params }),
    ),

  create: (workspaceId: string, input: InviteMembersInput) =>
    request<InviteBatchResult>(
      http.post(`/workspaces/${workspaceId}/invitations`, input),
    ),

  preview: (token: string) =>
    request<InvitationPublicPreview>(
      http.get(`/invitations/preview/${token}`),
    ),

  resend: (workspaceId: string, invitationId: string) =>
    request<{ invitation: Invitation; token?: string }>(
      http.post(
        `/workspaces/${workspaceId}/invitations/${invitationId}/resend`,
      ),
    ),

  revoke: (workspaceId: string, invitationId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`),
    ),

  accept: (token: string) =>
    request<{
      workspaceSlug: string;
      channelSlug?: string;
      /** True when the caller was already a member — acceptance is idempotent. */
      alreadyMember?: boolean;
    }>(http.post('/invitations/accept', { token })),

  decline: (token: string) =>
    request<void>(http.post('/invitations/decline', { token })),

  // --- Shareable Invitation Links ---

  listLinks: (workspaceId: string) =>
    request<Invitation[]>(
      http.get(`/workspaces/${workspaceId}/invitation-links`),
    ),

  createLink: (workspaceId: string, input: CreateInvitationLinkInput) =>
    request<{ link: Invitation; url: string; token: string }>(
      http.post(`/workspaces/${workspaceId}/invitation-links`, input),
    ),

  updateLink: (
    workspaceId: string,
    linkId: string,
    input: UpdateInvitationLinkInput,
  ) =>
    request<Invitation>(
      http.patch(
        `/workspaces/${workspaceId}/invitation-links/${linkId}`,
        input,
      ),
    ),

  revokeLink: (workspaceId: string, linkId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/invitation-links/${linkId}`),
    ),

  regenerateLink: (workspaceId: string, linkId: string) =>
    request<{ link: Invitation; url: string; token: string }>(
      http.post(
        `/workspaces/${workspaceId}/invitation-links/${linkId}/regenerate`,
      ),
    ),
};

export const userApi = {
  preferences: () =>
    request<UserPreferences>(http.get('/users/me/preferences')),

  updatePreferences: (input: UpdateUserPreferencesInput) =>
    request<UserPreferences>(http.patch('/users/me/preferences', input)),

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

  /** The persisted sidebar-customization blob. `{}` when never customized. */
  sidebarPreferences: () =>
    request<Record<string, unknown>>(http.get('/users/me/sidebar')),

  saveSidebarPreferences: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>(http.put('/users/me/sidebar', data)),

  /**
   * The persisted appearance blob — `{ theme, density, accent, radius,
   * customTheme }`. `{}` when the user has never customized their theme.
   */
  themeSettings: () =>
    request<Record<string, unknown>>(http.get('/users/me/theme')),

  saveThemeSettings: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>(http.put('/users/me/theme', data)),
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
  // --- teams ----------------------------------------------------------------

  teams: (workspaceId: string) =>
    request<Team[]>(http.get(`/workspaces/${workspaceId}/work-tools/teams`)),

  createTeam: (workspaceId: string, input: CreateTeamInput) =>
    request<Team>(
      http.post(`/workspaces/${workspaceId}/work-tools/teams`, input),
    ),

  updateTeam: (workspaceId: string, teamId: string, input: UpdateTeamInput) =>
    request<Team>(
      http.patch(`/workspaces/${workspaceId}/work-tools/teams/${teamId}`, input),
    ),

  deleteTeam: (workspaceId: string, teamId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/teams/${teamId}`),
    ),

  // --- initiatives ----------------------------------------------------------

  initiatives: (workspaceId: string) =>
    request<Initiative[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/initiatives`),
    ),

  createInitiative: (workspaceId: string, input: CreateInitiativeInput) =>
    request<Initiative>(
      http.post(`/workspaces/${workspaceId}/work-tools/initiatives`, input),
    ),

  updateInitiative: (
    workspaceId: string,
    initiativeId: string,
    input: UpdateInitiativeInput,
  ) =>
    request<Initiative>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/initiatives/${initiativeId}`,
        input,
      ),
    ),

  deleteInitiative: (workspaceId: string, initiativeId: string) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/work-tools/initiatives/${initiativeId}`,
      ),
    ),

  // --- projects -------------------------------------------------------------

  projects: (workspaceId: string, teamId?: string) =>
    request<ProjectDetail[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/projects`, {
        params: teamId ? { teamId } : undefined,
      }),
    ),

  project: (workspaceId: string, projectId: string) =>
    request<ProjectDetail>(
      http.get(`/workspaces/${workspaceId}/work-tools/projects/${projectId}`),
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

  updateIdentifierSettings: (
    workspaceId: string,
    projectId: string,
    input: ProjectIdentifierSettingsInput,
  ) =>
    request<{ project: Project; preview: string }>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/projects/${projectId}/identifier-settings`,
        input,
      ),
    ),

  deleteProject: (workspaceId: string, projectId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/projects/${projectId}`),
    ),

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

  // --- epics, modules, cycles -----------------------------------------------

  epics: (workspaceId: string, projectId: string) =>
    request<Epic[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/projects/${projectId}/epics`),
    ),

  createEpic: (workspaceId: string, input: CreateEpicInput) =>
    request<Epic>(
      http.post(`/workspaces/${workspaceId}/work-tools/epics`, input),
    ),

  updateEpic: (workspaceId: string, epicId: string, input: UpdateEpicInput) =>
    request<Epic>(
      http.patch(`/workspaces/${workspaceId}/work-tools/epics/${epicId}`, input),
    ),

  deleteEpic: (workspaceId: string, epicId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/epics/${epicId}`),
    ),

  modules: (workspaceId: string, projectId: string) =>
    request<Module[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/projects/${projectId}/modules`),
    ),

  createModule: (workspaceId: string, input: CreateModuleInput) =>
    request<Module>(
      http.post(`/workspaces/${workspaceId}/work-tools/modules`, input),
    ),

  updateModule: (
    workspaceId: string,
    moduleId: string,
    input: UpdateModuleInput,
  ) =>
    request<Module>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/modules/${moduleId}`,
        input,
      ),
    ),

  deleteModule: (workspaceId: string, moduleId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/modules/${moduleId}`),
    ),

  cycles: (workspaceId: string, projectId?: string, teamId?: string) =>
    request<Cycle[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/cycles`, {
        params: {
          ...(projectId ? { projectId } : {}),
          ...(teamId ? { teamId } : {}),
        },
      }),
    ),

  createCycle: (workspaceId: string, input: CreateCycleInput) =>
    request<Cycle>(
      http.post(`/workspaces/${workspaceId}/work-tools/cycles`, input),
    ),

  updateCycle: (workspaceId: string, cycleId: string, input: UpdateCycleInput) =>
    request<Cycle>(
      http.patch(`/workspaces/${workspaceId}/work-tools/cycles/${cycleId}`, input),
    ),

  deleteCycle: (workspaceId: string, cycleId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/cycles/${cycleId}`),
    ),

  // --- tasks ----------------------------------------------------------------

  tasks: (
    workspaceId: string,
    params?: {
      projectId?: string;
      teamId?: string;
      cycleId?: string;
      epicId?: string;
      moduleId?: string;
      assigneeId?: string;
      search?: string;
    } | string,
  ) => {
    const query = typeof params === 'string' ? { projectId: params } : params;
    return request<Task[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/tasks`, {
        params: query,
      }),
    );
  },

  task: (workspaceId: string, taskId: string) =>
    request<Task>(
      http.get(`/workspaces/${workspaceId}/work-tools/tasks/${taskId}`),
    ),

  createTask: (workspaceId: string, input: CreateTaskInput) =>
    request<Task>(
      http.post(`/workspaces/${workspaceId}/work-tools/tasks`, input),
    ),

  updateTask: (workspaceId: string, taskId: string, input: UpdateTaskInput) =>
    request<Task>(
      http.patch(`/workspaces/${workspaceId}/work-tools/tasks/${taskId}`, input),
    ),

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

  // --- relations ------------------------------------------------------------

  relations: (workspaceId: string, taskId: string) =>
    request<WorkItemRelation[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/tasks/${taskId}/relations`),
    ),

  addRelation: (workspaceId: string, input: CreateWorkItemRelationInput) =>
    request<WorkItemRelation>(
      http.post(`/workspaces/${workspaceId}/work-tools/relations`, input),
    ),

  deleteRelation: (workspaceId: string, relationId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/relations/${relationId}`),
    ),

  // --- saved views ----------------------------------------------------------

  savedViews: (workspaceId: string, projectId?: string, teamId?: string) =>
    request<SavedView[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/views`, {
        params: {
          ...(projectId ? { projectId } : {}),
          ...(teamId ? { teamId } : {}),
        },
      }),
    ),

  createSavedView: (workspaceId: string, input: CreateSavedViewInput) =>
    request<SavedView>(
      http.post(`/workspaces/${workspaceId}/work-tools/views`, input),
    ),

  updateSavedView: (
    workspaceId: string,
    viewId: string,
    input: UpdateSavedViewInput,
  ) =>
    request<SavedView>(
      http.patch(`/workspaces/${workspaceId}/work-tools/views/${viewId}`, input),
    ),

  deleteSavedView: (workspaceId: string, viewId: string) =>
    request<void>(
      http.delete(`/workspaces/${workspaceId}/work-tools/views/${viewId}`),
    ),

  // --- intake / triage ------------------------------------------------------

  intake: (workspaceId: string, status?: string) =>
    request<IntakeRequest[]>(
      http.get(`/workspaces/${workspaceId}/work-tools/intake`, {
        params: status ? { status } : undefined,
      }),
    ),

  createIntakeRequest: (
    workspaceId: string,
    input: CreateIntakeRequestInput,
  ) =>
    request<IntakeRequest>(
      http.post(`/workspaces/${workspaceId}/work-tools/intake`, input),
    ),

  convertIntakeRequest: (
    workspaceId: string,
    intakeId: string,
    input: ConvertIntakeRequestInput,
  ) =>
    request<Task>(
      http.post(
        `/workspaces/${workspaceId}/work-tools/intake/${intakeId}/convert`,
        input,
      ),
    ),

  declineIntakeRequest: (workspaceId: string, intakeId: string) =>
    request<IntakeRequest>(
      http.patch(
        `/workspaces/${workspaceId}/work-tools/intake/${intakeId}/decline`,
      ),
    ),

  // --- project updates ------------------------------------------------------

  projectUpdates: (workspaceId: string, projectId: string) =>
    request<ProjectUpdate[]>(
      http.get(
        `/workspaces/${workspaceId}/work-tools/projects/${projectId}/updates`,
      ),
    ),

  createProjectUpdate: (
    workspaceId: string,
    input: CreateProjectUpdateInput,
  ) =>
    request<ProjectUpdate>(
      http.post(
        `/workspaces/${workspaceId}/work-tools/projects/${input.projectId}/updates`,
        input,
      ),
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

  getProviders: (workspaceId: string) =>
    request<IntegrationCapabilities[]>(
      http.get(`/workspaces/${workspaceId}/integrations/providers`),
    ),

  getDetail: (workspaceId: string, integrationId: string) =>
    request<ExternalIntegration>(
      http.get(`/workspaces/${workspaceId}/integrations/${integrationId}`),
    ),

  connect: (
    workspaceId: string,
    provider: string,
    input: {
      scopeType?: 'WORKSPACE' | 'USER';
      accessToken?: string;
      config?: Record<string, unknown>;
      redirectUri?: string;
    } = {},
  ) =>
    request<{ authUrl?: string; state?: string; id?: string } & ExternalIntegration>(
      http.post(`/workspaces/${workspaceId}/integrations/${provider}/connect`, input),
    ),

  disconnect: (workspaceId: string, integrationId: string) =>
    request<ExternalIntegration>(
      http.post(`/workspaces/${workspaceId}/integrations/${integrationId}/disconnect`),
    ),

  sync: (workspaceId: string, integrationId: string) =>
    request<{ message: string; jobId: string }>(
      http.post(`/workspaces/${workspaceId}/integrations/${integrationId}/sync`),
    ),

  getSyncJobs: (workspaceId: string, integrationId: string) =>
    request<IntegrationSyncJobDto[]>(
      http.get(`/workspaces/${workspaceId}/integrations/${integrationId}/jobs`),
    ),

  getMessages: (
    workspaceId: string,
    integrationId: string,
    params?: { q?: string; pageToken?: string; maxResults?: number },
  ) =>
    request<{ messages: IntegrationMessage[]; nextPageToken?: string }>(
      http.get(`/workspaces/${workspaceId}/integrations/${integrationId}/messages`, {
        params,
      }),
    ),

  getThread: (workspaceId: string, integrationId: string, threadId: string) =>
    request<IntegrationThread>(
      http.get(`/workspaces/${workspaceId}/integrations/${integrationId}/threads/${threadId}`),
    ),

  sendMessage: (workspaceId: string, integrationId: string, input: SendMessageInput) =>
    request<IntegrationMessage>(
      http.post(`/workspaces/${workspaceId}/integrations/${integrationId}/messages`, input),
    ),

  replyMessage: (workspaceId: string, integrationId: string, input: ReplyMessageInput) =>
    request<IntegrationMessage>(
      http.post(`/workspaces/${workspaceId}/integrations/${integrationId}/reply`, input),
    ),

  createDraft: (workspaceId: string, integrationId: string, input: SendMessageInput) =>
    request<IntegrationMessage>(
      http.post(`/workspaces/${workspaceId}/integrations/${integrationId}/drafts`, input),
    ),

  modifyLabels: (
    workspaceId: string,
    integrationId: string,
    messageId: string,
    input: { addLabelIds?: string[]; removeLabelIds?: string[] },
  ) =>
    request<IntegrationMessage>(
      http.patch(`/workspaces/${workspaceId}/integrations/${integrationId}/messages/${messageId}/labels`, input),
    ),

  testCustomApi: (workspaceId: string, config: Record<string, unknown>) =>
    request<{ success: boolean; message: string; details?: unknown }>(
      http.post(`/workspaces/${workspaceId}/integrations/custom/test`, config),
    ),

  executeCustomRequest: (
    workspaceId: string,
    integrationId: string,
    input: IntegrationExecuteRequestInput,
  ) =>
    request<IntegrationExecuteResponse>(
      http.post(`/workspaces/${workspaceId}/integrations/${integrationId}/custom/execute`, input),
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

  getActions: (workspaceId: string, integrationId: string) =>
    request<AppActionDefinition[]>(
      http.get(`/workspaces/${workspaceId}/integrations/${integrationId}/actions`),
    ),

  executeAction: (
    workspaceId: string,
    integrationId: string,
    actionId: string,
    input: {
      input?: Record<string, unknown>;
      confirm?: boolean;
      roomId?: string;
    },
  ) =>
    request<AppActionResult>(
      http.post(
        `/workspaces/${workspaceId}/integrations/${integrationId}/actions/${actionId}`,
        input,
      ),
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

  // --- notification centre (the bell menu) --------------------------------

  list: (
    workspaceId: string,
    params?: { cursor?: string; limit?: number; unreadOnly?: boolean },
  ) =>
    request<Paginated<NotificationView>>(
      http.get(`/workspaces/${workspaceId}/notifications`, {
        params: {
          ...(params?.cursor ? { cursor: params.cursor } : {}),
          ...(params?.limit ? { limit: params.limit } : {}),
          ...(params?.unreadOnly ? { unreadOnly: true } : {}),
        },
      }),
    ),

  unreadCount: (workspaceId: string) =>
    request<{ count: number }>(
      http.get(`/workspaces/${workspaceId}/notifications/unread-count`),
    ),

  markRead: (workspaceId: string, notificationId: string) =>
    request<void>(
      http.post(
        `/workspaces/${workspaceId}/notifications/${notificationId}/read`,
      ),
    ),

  markAllRead: (workspaceId: string) =>
    request<{ count: number }>(
      http.post(`/workspaces/${workspaceId}/notifications/read-all`),
    ),

  dismiss: (workspaceId: string, notificationId: string) =>
    request<void>(
      http.delete(
        `/workspaces/${workspaceId}/notifications/${notificationId}`,
      ),
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

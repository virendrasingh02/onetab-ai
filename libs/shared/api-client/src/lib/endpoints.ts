import type {
  AIUsageStats,
  AuthTokens,
  Channel,
  ChannelMember,
  ChannelPin,
  ChannelSummary,
  CurrentUser,
  DashboardOverview,
  ErrorTrackingReport,
  GeneratedReport,
  HealthStatus,
  Invitation,
  PerformanceMetrics,
  PublicUser,
  ReportDefinition,
  ReportType,
  StorageAnalytics,
  Upload,
  UserAnalytics,
  Workspace,
  WorkspaceAnalytics,
  WorkspaceMember,
  WorkspaceSummary,
} from '@org/types';
import type {
  AddChannelMembersInput,
  ChannelPreferencesInput,
  CreateChannelInput,
  CreatePinInput,
  CreateWorkspaceInput,
  ForgotPasswordInput,
  InviteMembersInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateChannelInput,
  UpdateMemberRoleInput,
  UpdateProfileInput,
  UpdateWorkspaceInput,
} from '@org/validation';
import { http, request } from './http.js';

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
};

export const workspaceApi = {
  list: () => request<WorkspaceSummary[]>(http.get('/workspaces')),

  bySlug: (slug: string) =>
    request<WorkspaceSummary>(http.get(`/workspaces/${slug}`)),

  create: (input: CreateWorkspaceInput) =>
    request<WorkspaceSummary>(http.post('/workspaces', input)),

  update: (workspaceId: string, input: UpdateWorkspaceInput) =>
    request<Workspace>(http.patch(`/workspaces/${workspaceId}`, input)),

  remove: (workspaceId: string) =>
    request<void>(http.delete(`/workspaces/${workspaceId}`)),

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

  setPresence: (presence: CurrentUser['presence']) =>
    request<{ presence: string }>(
      http.patch('/users/me/presence', { presence }),
    ),

  byId: (userId: string) => request<PublicUser>(http.get(`/users/${userId}`)),
};

/** Matrix session brokering. The browser never holds Matrix credentials. */
export const matrixApi = {
  config: () =>
    request<{ enabled: boolean; serverName: string | null }>(
      http.get('/matrix/config'),
    ),

  session: () =>
    request<{
      homeserverUrl: string;
      matrixUserId: string;
      loginToken: string;
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

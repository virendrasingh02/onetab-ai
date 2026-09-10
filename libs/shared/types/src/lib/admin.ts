import type { SystemRole, WorkspaceRole, WorkspaceStatus } from './enums.js';
import type { IsoDateString } from './entities.js';

export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Platform counters for the console's landing screen. */
export interface AdminOverview {
  users: number;
  workspaces: number;
  channels: number;
  messages: number;
  uploads: number;
  storageBytes: number;
  agents: number;
  workflows: number;
  organizations: number;
  newUsersLast7Days: number;
}

/** A user row in the operator console. Never carries credentials. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  systemRole: SystemRole;
  presence: string;
  emailVerifiedAt: IsoDateString | null;
  lastSeenAt: IsoDateString | null;
  createdAt: IsoDateString;
  _count: { workspaceMembers: number; ownedWorkspaces: number };
}

export interface AdminUserDetail
  extends Omit<AdminUser, '_count'> {
  bio: string | null;
  timezone: string;
  workspaceMembers: Array<{
    role: WorkspaceRole;
    joinedAt: IsoDateString;
    workspace: { id: string; name: string; slug: string };
  }>;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  status: WorkspaceStatus;
  archivedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  owner: { id: string; name: string; email: string };
  _count: {
    members: number;
    channels: number;
    uploads: number;
    tasks: number;
  };
}

export interface AdminWorkspaceDetail
  extends Omit<AdminWorkspace, '_count'> {
  _count: {
    members: number;
    channels: number;
    uploads: number;
    tasks: number;
    projects: number;
    aiAgents: number;
  };
  storageBytes: number;
}

export interface AdminDepartment {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface AdminSubscription {
  id: string;
  organizationId: string;
  planTier: string;
  seatsTotal: number;
  seatsUsed: number;
  status: string;
  renewAt: IsoDateString;
}

export interface AdminOrganization {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  billingEmail: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  departments: AdminDepartment[];
  subscriptions: AdminSubscription[];
  _count: { auditLogs: number; ssoConfigs: number };
}

export interface AdminAuditLogEntry {
  id: string;
  organizationId: string;
  actorEmail: string;
  action: string;
  targetResource: string;
  ipAddress: string | null;
  /** JSON-encoded payload. */
  details: string;
  createdAt: IsoDateString;
  organization: { id: string; name: string };
}

/**
 * An organisation's identity-provider binding.
 *
 * `scimToken` is the bearer the IdP presents to the SCIM endpoints. It is only
 * ever returned on the operator-gated enterprise routes, which are
 * SUPERADMIN-only — the console has to show it because setting up provisioning
 * means pasting it into Okta or Entra.
 */
export interface SSOConfiguration {
  id: string;
  organizationId: string;
  providerType: string;
  idpEntityId: string | null;
  ssoUrl: string | null;
  certificate: string | null;
  scimToken: string | null;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** One organisation, with everything the enterprise screens read. */
export interface EnterpriseOrganization {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  billingEmail: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  departments: AdminDepartment[];
  subscriptions: AdminSubscription[];
  ssoConfigs: SSOConfiguration[];
  _count: { auditLogs: number };
}

// ---------------------------------------------------------------------------
// Platform Intelligence & Analytics Contracts
// ---------------------------------------------------------------------------

export interface AdminAnalyticsFilter {
  range?:
    | 'today'
    | 'yesterday'
    | '7d'
    | '30d'
    | '90d'
    | 'this_month'
    | 'last_month'
    | 'this_year'
    | 'custom';
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  userId?: string;
  platform?: 'all' | 'web' | 'desktop';
  comparePrevious?: boolean;
}

export interface ExecutiveKpi {
  label: string;
  value: number | string;
  previousValue?: number | string;
  changePct?: number | null;
  direction?: 'up' | 'down' | 'flat';
  tooltip?: string;
  drillDownPath?: string;
  format?: 'number' | 'bytes' | 'currency' | 'percent' | 'duration' | 'plain';
}

export interface AdminLiveActivityItem {
  id: string;
  type:
    | 'WORKSPACE_CREATED'
    | 'USER_REGISTERED'
    | 'USER_ACTIVE'
    | 'MESSAGE_POSTED'
    | 'FILE_UPLOADED'
    | 'API_SPIKE'
    | 'SUBSCRIPTION_CREATED'
    | 'PAYMENT_SUCCESS'
    | 'PAYMENT_FAILED';
  title: string;
  description: string;
  timestamp: string;
  severity?: 'info' | 'success' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface AdminPlatformOverview {
  rangeDays: number;
  since: string;
  previousSince: string;
  freshness: 'realtime' | 'near_realtime' | 'historical';
  lastUpdated: string;
  platformKpis: Record<string, ExecutiveKpi>;
  communicationKpis: Record<string, ExecutiveKpi>;
  filesKpis: Record<string, ExecutiveKpi>;
  revenueKpis: Record<string, ExecutiveKpi>;
  userGrowthSeries: Array<{ date: string; value: number }>;
  activitySeries: Array<{ date: string; value: number }>;
  platformSplit: { web: number; desktop: number };
  recentEvents: AdminLiveActivityItem[];
}

export interface AdminUserAnalytics {
  totalAccounts: number;
  newAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  suspendedAccounts: number;
  pendingAccounts: number;
  dau: number;
  wau: number;
  mau: number;
  dauMauRatio: number;
  retentionRate: number;
  growthRate: number;
  churnRate: number;
  engagement: {
    avgSessions: number;
    avgSessionDurationSeconds: number;
    messagesPerUser: number;
    filesPerUser: number;
    workspaceActivityPerUser: number;
    apiActivityPerUser: number;
  };
  userGrowthSeries: Array<{
    date: string;
    newUsers: number;
    returningUsers: number;
    activeUsers: number;
  }>;
  userActivitySeries: Array<{
    date: string;
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
  }>;
  statusBreakdown: Array<{ label: string; value: number; percentage: number }>;
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    systemRole: string;
    presence: string;
    createdAt: string;
    lastSeenAt: string | null;
    sessionsCount: number;
    messagesCount: number;
    filesCount: number;
    workspacesCount: number;
    platform: string;
  }>;
}

export interface AdminPlatformUsageAnalytics {
  totalWebUsers: number;
  totalDesktopUsers: number;
  activeWebUsers: number;
  activeDesktopUsers: number;
  sessionsByPlatform: { web: number; desktop: number };
  messagesByPlatform: { web: number; desktop: number };
  filesByPlatform: { web: number; desktop: number };
  avgDurationByPlatform: { web: number; desktop: number };
  usageOverTime: Array<{
    date: string;
    webSessions: number;
    desktopSessions: number;
    totalUsers: number;
  }>;
  platformsTable: Array<{
    platform: 'Web' | 'Desktop';
    totalUsers: number;
    activeUsers: number;
    sessions: number;
    messages: number;
    files: number;
    storageBytes: number;
    avgDuration: string;
  }>;
}

export interface AdminWorkspaceAnalyticsRow {
  id: string;
  name: string;
  slug: string;
  owner: { id: string; name: string; email: string };
  createdAt: string;
  status: string;
  usersCount: number;
  activeUsersCount: number;
  inactiveUsersCount: number;
  subscriptionPlan: string;
  billingStatus: string;
  paymentMethod: string;
  revenue: number;
  messagesCount: number;
  filesCount: number;
  storageBytes: number;
  apiUsageCount: number;
  lastActivityAt: string | null;
  webUsersCount: number;
  desktopUsersCount: number;
}

export interface AdminWorkspaceAnalyticsResponse {
  items: AdminWorkspaceAnalyticsRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    inactiveWorkspaces: number;
    totalRevenue: number;
    totalStorageBytes: number;
  };
}

export interface AdminWorkspaceDetailAnalytics {
  overview: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    owner: { id: string; name: string; email: string };
    createdAt: string;
    userCount: number;
    activeUsers: number;
    revenue: number;
    storageBytes: number;
    apiCalls: number;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    isActive: boolean;
    lastActiveAt: string | null;
    platform: string;
    device: string;
  }>;
  communication: {
    messagesSent: number;
    messagesReceived: number;
    channelMessages: number;
    directMessages: number;
    mentions: number;
    reactions: number;
    messageGrowth: Array<{ date: string; value: number }>;
  };
  files: {
    uploads: number;
    downloads: number;
    shares: number;
    storageBytes: number;
    byType: Array<{ label: string; value: number; percentage: number }>;
    storageGrowth: Array<{ date: string; value: number }>;
  };
  apis: {
    requests: number;
    successfulRequests: number;
    failedRequests: number;
    errorRate: number;
    mostUsedApis: Array<{ name: string; count: number }>;
    volumeOverTime: Array<{ date: string; value: number }>;
  };
  revenue: {
    currentPlan: string;
    billingStatus: string;
    subscriptionAmount: number;
    revenue: number;
    paymentStatus: string;
    renewalDate: string | null;
    billingInterval: string;
    billingHistory: Array<{
      id: string;
      date: string;
      amount: number;
      status: string;
      description: string;
    }>;
  };
}

export interface AdminApiAnalytics {
  totalApis: number;
  activeApis: number;
  inactiveApis: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  peakRequestsPerMinute: number;
  requestsOverTime: Array<{
    date: string;
    requests: number;
    errors: number;
    avgLatency: number;
  }>;
  requestsByWorkspace: Array<{
    workspaceId: string;
    workspaceName: string;
    requests: number;
    errorRate: number;
  }>;
  apiTable: Array<{
    id: string;
    name: string;
    endpoint: string;
    status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
    requests: number;
    successRate: number;
    errorRate: number;
    avgLatencyMs: number;
    lastUsedAt: string | null;
    workspaceName?: string;
    createdAt: string;
  }>;
}

export interface AdminMessagingAnalytics {
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  directMessages: number;
  channelMessages: number;
  threadsCount: number;
  mentionsCount: number;
  reactionsCount: number;
  editedMessagesCount: number;
  deletedMessagesCount: number;
  messagesOverTime: Array<{
    date: string;
    sent: number;
    received: number;
    total: number;
  }>;
  dmVsChannelBreakdown: Array<{
    label: string;
    value: number;
    percentage: number;
  }>;
  messagesByWorkspace: Array<{
    workspaceId: string;
    workspaceName: string;
    count: number;
  }>;
  messagesByHour: Array<{ hour: number; count: number }>;
}

export interface AdminStorageAnalytics {
  totalFiles: number;
  filesUploaded: number;
  filesDownloaded: number;
  filesShared: number;
  storageUsedBytes: number;
  storageRemainingBytes: number;
  averageFileSizeBytes: number;
  growthPct: number;
  storageGrowth: Array<{ date: string; value: number }>;
  uploadActivity: Array<{ date: string; value: number }>;
  filesByType: Array<{ label: string; value: number; percentage: number }>;
  storageByWorkspace: Array<{
    workspaceId: string;
    workspaceName: string;
    filesCount: number;
    bytes: number;
  }>;
}

export interface AdminDeviceAnalytics {
  totalDevices: number;
  activeDevices: number;
  usersByOs: Array<{ label: string; value: number; percentage: number }>;
  sessionsByOs: Array<{ label: string; value: number; percentage: number }>;
  browsers: Array<{ label: string; value: number; percentage: number }>;
  appVersions: Array<{
    version: string;
    count: number;
    isLatest: boolean;
    isOutdated: boolean;
  }>;
  outdatedCount: number;
}

export interface AdminLocationAnalytics {
  totalCountries: number;
  countries: Array<{
    code: string;
    name: string;
    usersCount: number;
    workspacesCount: number;
    percentage: number;
  }>;
  regions: Array<{ region: string; count: number; percentage: number }>;
}

export interface AdminRevenueAnalytics {
  totalRevenue: number;
  mrr: number;
  arr: number;
  newRevenue: number;
  expansionRevenue: number;
  churnedRevenue: number;
  refunds: number;
  netRevenue: number;
  arpu: number;
  avgRevenuePerWorkspace: number;
  revenueTrend: Array<{ date: string; value: number }>;
  mrrTrend: Array<{ date: string; value: number }>;
  revenueByPlan: Array<{ label: string; value: number; percentage: number }>;
  revenueByWorkspace: Array<{
    workspaceId: string;
    workspaceName: string;
    plan: string;
    amount: number;
  }>;
  revenueMovement: {
    new: number;
    expansion: number;
    contraction: number;
    churn: number;
  };
  paymentAnalytics: {
    successful: number;
    failed: number;
    pending: number;
    refunds: number;
    methods: Array<{ label: string; value: number; percentage: number }>;
  };
}

export interface AdminSubscriptionAnalytics {
  freeCount: number;
  trialCount: number;
  paidCount: number;
  planDistribution: Array<{
    label: string;
    value: number;
    percentage: number;
  }>;
  upgrades: number;
  downgrades: number;
  renewals: number;
  cancellations: number;
  churnRatePct: number;
  trialConversionRatePct: number;
  funnel: Array<{ stage: string; count: number; conversionPct: number }>;
}

export interface AdminEngagementAnalytics {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  totalSessions: number;
  avgSessionDurationSeconds: number;
  featureUsage: Array<{
    feature: string;
    usageCount: number;
    adoptionRate: number;
    trend: 'up' | 'down' | 'flat';
  }>;
  mostActiveWorkspaces: Array<{
    id: string;
    name: string;
    activityScore: number;
  }>;
  mostActiveUsers: Array<{
    id: string;
    name: string;
    email: string;
    activityScore: number;
  }>;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  source: string;
  calculation: string;
  freshness: string;
  category: string;
  unit?: string;
}


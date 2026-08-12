import type { SystemRole, WorkspaceRole } from './enums.js';
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

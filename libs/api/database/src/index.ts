export { PrismaService } from './lib/prisma.service.js';
export { PrismaModule } from './lib/prisma.module.js';

/**
 * Re-export the generated client so feature libraries import model types from
 * `@org/database` rather than reaching into a generated folder by path.
 */
export {
  Prisma,
  PrismaClient,
  ChannelRole,
  ChannelVisibility,
  InvitationStatus,
  PresenceStatus,
  SystemRole,
  WorkspaceRole,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
  DocumentKind,
} from './generated/client.js';

export type {
  Channel,
  ChannelMember,
  ChannelPin,
  Invitation,
  PasswordResetToken,
  RefreshToken,
  Upload,
  User,
  Workspace,
  WorkspaceMember,
  Project,
  Milestone,
  Sprint,
  Task,
  TaskComment,
  CalendarEvent,
  WorkDocument,
  Whiteboard,
  PromptTemplate,
  AIMemory,
  AIChatSession,
  AIAgent,
  AgentSchedule,
  AgentExecutionLog,
  AutomationWorkflow,
  WorkflowExecution,
  Organization,
  Department,
  SSOConfig,
  EnterpriseAuditLog,
  OrganizationSubscription,
  ExternalIntegration,
  ImportJob,
  AnalyticsEvent,
  RecentActivity,
} from './generated/client.js';

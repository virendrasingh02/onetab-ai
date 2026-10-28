import type { IsoDateString } from './entities.js';

export type AIEntityType = 'agent' | 'coworker';

export function isAIEntityType(value: unknown): value is AIEntityType {
  return value === 'agent' || value === 'coworker';
}

export type CoworkerStatus =
  | 'AVAILABLE'
  | 'WORKING'
  | 'IDLE'
  | 'RUNNING_TASK'
  | 'ERROR';

export interface CoworkerPermissions {
  /** Whether this entity may query workspace knowledge (RAG) at all. */
  knowledgeAccess?: boolean;
  /** Tool names it may call beyond read-only ones — write access is opt-in. */
  allowActions?: string[];
  /** Reserved for fine-grained project/channel allow-lists. */
  projectIds?: string[];
  channelIds?: string[];
}

export interface AIEntity {
  id: string;
  workspaceId: string;
  creatorId: string | null;
  /** The creator's profile, resolved by the API. Null for seeded or deleted-user entities. */
  owner?: { id: string; name: string; avatarUrl: string | null } | null;
  type: AIEntityType;
  name: string;
  role: string;
  description: string | null;
  avatarUrl: string | null;
  personality: string | null;
  /** Shown as the first message in this entity's DM when it has no history yet. */
  welcomeMessage: string | null;
  systemPrompt: string;
  systemInstructions: string;
  status: CoworkerStatus;
  provider: string;
  model: string;
  /** JSON-encoded array of MCP tool names. */
  tools: string;
  permissions: CoworkerPermissions;
  configuration: Record<string, unknown>;
  /** JSON-encoded React Flow graph from the Agent Builder canvas, or null. */
  graphJson: string | null;
  isActive: boolean;
  isMarketplace: boolean;
  matrixUserId: string | null;
  matrixRoomId: string | null;
  lastActiveAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface AIAgent extends AIEntity {
  type: 'agent';
  /**
   * Set on a save response when parts of a builder graph could not be applied
   * (a Starter plan's model choice, a deleted knowledge base, an output
   * channel the creator cannot post in…). Never persisted.
   */
  warnings?: string[];
}

/** What the builder's test console receives from a test run. */
export interface AgentTestRunResult {
  executionId: string | null;
  status: 'SUCCESS' | 'WAITING_APPROVAL' | 'FAILED';
  steps: Array<{
    stepId: string;
    nodeType: string;
    label: string;
    status: 'SUCCESS' | 'FAILED' | 'WAITING';
    output: unknown;
    latencyMs: number;
    tokensUsed: number;
  }>;
  output: unknown;
  notices: string[];
  duration: number;
  tokensUsed: number;
  credits: number;
}

/** A published or manual snapshot of an agent. */
export interface AgentVersion {
  version: number;
  versionTag?: string;
  publishedAt?: string;
  changeSummary?: string;
  status?: 'PUBLISHED' | 'SNAPSHOT' | 'DRAFT' | string;
  /** The canvas graph as it was when the version was taken. */
  graphJson?: string | null;
}

/**
 * Next semver tag after the highest real one: publish bumps minor
 * (v1.0.0 → v1.1.0 → v1.2.0), snapshots bump patch. First tag is v1.0.0.
 * The placeholder `-draft` row the API returns before any publish is ignored.
 * Shared by the API (which assigns tags) and the UI (which previews them).
 */
export function nextAgentVersionTag(
  versions: ReadonlyArray<{ versionTag?: string }>,
  bump: 'minor' | 'patch',
): string {
  let best: [number, number, number] | null = null;
  for (const v of versions) {
    if (/-draft$/i.test(v.versionTag ?? '')) continue;
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.versionTag ?? '');
    if (!m) continue;
    const cur: [number, number, number] = [+m[1], +m[2], +m[3]];
    if (
      !best ||
      cur[0] > best[0] ||
      (cur[0] === best[0] && (cur[1] > best[1] || (cur[1] === best[1] && cur[2] > best[2])))
    ) {
      best = cur;
    }
  }
  if (!best) return 'v1.0.0';
  const [major, minor, patch] = best;
  return bump === 'minor' ? `v${major}.${minor + 1}.0` : `v${major}.${minor}.${patch + 1}`;
}

/** Display label for a version: its API tag, or a semver-shaped fallback for legacy rows. */
export function agentVersionLabel(v: { version: number; versionTag?: string }): string {
  return v.versionTag || `v${v.version}.0.0`;
}

export interface AgentSchedule {
  id: string;
  agentId: string;
  cronExpression: string;
  description: string | null;
  isActive: boolean;
}

/** An agent as the list screen receives it. */
export interface AIAgentDetail extends AIAgent {
  schedules: AgentSchedule[];
  _count: { logs: number };
}

export interface AgentExecutionLog {
  id: string;
  agentId: string;
  status: string;
  promptText: string;
  outputResult: string;
  toolCalls: string;
  tokensUsed: number;
  executedAt: IsoDateString;
}

/** An execution log joined to the agent that produced it. */
export interface AgentExecutionLogEntry extends AgentExecutionLog {
  agent: { id: string; name: string };
}

export interface AgentRunResult {
  agentName: string;
  result: string;
  logId: string;
}

export interface StudioTemplateNodeData {
  label: string;
  subtitle?: string;
  config?: Record<string, any>;
  [key: string]: any;
}

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  category: 'automation' | 'productivity' | 'engineering' | 'support' | 'multi-agent' | 'research';
  icon: string;
  recommendedModel: string;
  recommendedProvider: string;
  tags: string[];
  requiredTools: string[];
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: StudioTemplateNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    sourceHandle?: string;
  }>;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** The execution log this reply came from — what feedback is filed against. */
  logId?: string;
  at: IsoDateString;
}

export interface AgentConversationSummary {
  id: string;
  title: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface AgentConversation extends AgentConversationSummary {
  agentId: string;
  messages: AgentChatMessage[];
}

export interface AgentChatResult {
  conversationId: string;
  title: string;
  message: AgentChatMessage;
}

export interface AutomationWorkflow {
  id: string;
  workspaceId: string;
  creatorId: string | null;
  name: string;
  description: string | null;
  triggerType: string;
  isActive: boolean;
  /** JSON-encoded React Flow graph. */
  nodesJson: string;
  edgesJson: string;
  /** The AI Agent Studio blueprint it was compiled from, when it has one. */
  agentProfile?: unknown;
  archivedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface AutomationWorkflowDetail extends AutomationWorkflow {
  _count: { executions: number };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string;
  triggerPayload: string;
  stepResults: string;
  startedAt: IsoDateString;
  finishedAt: IsoDateString;
}

/** An execution joined to the workflow that produced it. */
export interface WorkflowExecutionEntry extends WorkflowExecution {
  workflow: { id: string; name: string; triggerType: string };
}

export interface AutomationDailyVolume {
  date: string;
  success: number;
  failed: number;
  total: number;
}

export interface AutomationWorkflowMetric {
  id: string;
  name: string;
  triggerType: string;
  executionsCount: number;
  failureRate: number;
  avgDurationMs: number;
  lastExecutedAt: IsoDateString | null;
}

export interface AutomationFailingMetric {
  id: string;
  name: string;
  failCount: number;
  failureRate: number;
  lastError: string | null;
  lastFailedAt: IsoDateString | null;
}

export interface AutomationScheduleItem {
  workflowId: string;
  name: string;
  triggerType: string;
  cron: string;
  timezone: string | null;
  isActive: boolean;
  lastRunAt: IsoDateString | null;
  nextRunAt: IsoDateString | null;
  humanSchedule: string;
}

export interface AutomationConnectorHealth {
  provider: string;
  name: string;
  status: string;
  connectedCount: number;
  totalTriggers: number;
  totalActions: number;
}

export interface AutomationOverviewData {
  totalWorkflows: number;
  activeWorkflows: number;
  pausedWorkflows: number;
  runningExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  estimatedTimeSavedHours: number;
  volumeByDay: AutomationDailyVolume[];
  topWorkflows: AutomationWorkflowMetric[];
  failingWorkflows: AutomationFailingMetric[];
  upcomingScheduled: AutomationScheduleItem[];
  pendingApprovalsCount: number;
  connectorHealth: AutomationConnectorHealth[];
  recentExecutions: WorkflowExecutionEntry[];
}

export interface AutomationErrorGroup {
  classification: string;
  count: number;
  latestError: string;
  latestOccurredAt: IsoDateString;
  affectedWorkflows: Array<{ id: string; name: string }>;
}

export interface AutomationCatalogItem {
  id: string;
  name: string;
  category: 'trigger' | 'action' | 'logic' | 'ai';
  description: string;
  provider?: string;
  requiredPermissions?: string[];
  parametersSchema?: Record<string, unknown>;
}

export type { ExternalIntegration } from './integrations.js';

// --- AI Coworkers -----------------------------------------------------------
//
// A Coworker is the persistent, people-like layer above `AIAgent`: one stable
// identity (name/avatar/personality/role) with its own DM room, channel/project
// memberships and permissions, that may delegate to one or more `AIAgent`s
// rather than duplicating their tool/model plumbing. See `CoworkerRuntimeService`
// (`@org/api-coworkers`) for how this configuration becomes an actual turn.

export interface AICoworker extends AIEntity {
  type: 'coworker';
}

export interface CoworkerAgentLink {
  id: string;
  coworkerId: string;
  agentId: string;
  createdAt: IsoDateString;
  agent: {
    id: string;
    name: string;
    role: string;
    description: string | null;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

export interface CoworkerAppLink {
  id: string;
  coworkerId: string;
  integrationId: string;
  createdAt: IsoDateString;
  integration: {
    id: string;
    provider: string;
    displayName: string | null;
    status: string;
  };
}

/** A coworker as the directory/sidebar receives it. */
export interface AICoworkerDetail extends AICoworker {
  agentLinks: CoworkerAgentLink[];
  appLinks: CoworkerAppLink[];
  _count: { channelLinks: number; projectLinks: number; executionLogs: number };
}

export interface CoworkerExecutionLog {
  id: string;
  coworkerId: string;
  status: string;
  promptText: string;
  outputResult: string;
  toolCalls: string;
  tokensUsed: number;
  executedAt: IsoDateString;
}

export interface CoworkerRunResult {
  coworkerName: string;
  result: string;
  logId: string;
}

export type TrackerMonitorType =
  | 'task'
  | 'project'
  | 'metric'
  | 'event'
  | 'deadline'
  | 'status';

export interface TrackerMonitor {
  id: string;
  workspaceId: string;
  coworkerId: string;
  name?: string;
  type: TrackerMonitorType;
  target: string;
  condition: string;
  frequency?: string;
  intervalMinutes?: number;
  destinations?: string[];
  enabled: boolean;
  lastCheckedAt?: string | null;
  lastTriggeredAt?: string | null;
  /** What the last check found (`count: 0` = checked, nothing to report). */
  lastResult?: { count: number; summary: string } | null;
  /** Why the last check could not run, in plain words. */
  lastError?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

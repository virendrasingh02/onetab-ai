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

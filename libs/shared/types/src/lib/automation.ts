import type { IsoDateString } from './entities.js';

export interface AIAgent {
  id: string;
  workspaceId: string;
  creatorId: string | null;
  name: string;
  role: string;
  description: string | null;
  avatarUrl: string | null;
  systemPrompt: string;
  provider: string;
  model: string;
  /** JSON-encoded array of MCP tool names. */
  tools: string;
  isActive: boolean;
  isMarketplace: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
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

/**
 * A connected third-party provider.
 *
 * No `accessToken`: the API never sends the stored credential to a browser.
 */
export interface ExternalIntegration {
  id: string;
  workspaceId: string;
  provider: string;
  status: string;
  configJson: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

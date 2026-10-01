/**
 * What the AI Agent Studio API returns (`/workspaces/:id/agent-studio/*`).
 * The blueprint itself is in `agent-blueprint.ts`.
 */

import type {
  AgentBlueprint,
  AgentBlueprintTrigger,
  AgentEventName,
  AgentKind,
  AgentProfile,
} from './agent-blueprint.js';

export type StudioAgentState = 'draft' | 'active' | 'paused' | 'archived';

export interface StudioAgentSummary {
  id: string;
  name: string;
  description: string | null;
  /** The blueprint's kind, or `workflow` for one built on the canvas. */
  kind: AgentKind | 'workflow';
  /** Whether it carries a Studio plan (it can be edited as a plan). */
  isStudioAgent: boolean;
  triggerType: string;
  trigger: AgentBlueprintTrigger;
  state: StudioAgentState;
  isActive: boolean;
  archivedAt: string | null;
  publishedVersion: number | null;
  /** When a scheduled agent runs next (only while it is on). */
  nextRunAt: string | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  isMine: boolean;
  templateId: string | null;
  stepCount: number;
  scopes: string[] | null;
  lastRun: { id: string; status: string; startedAt: string; finishedAt: string | null; test: boolean } | null;
  runCount: number;
  /** Failed runs in the last 24 hours. */
  recentFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioGraphNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface StudioGraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface StudioAgentDetail extends StudioAgentSummary {
  profile: AgentProfile | null;
  /** The graph was changed on the canvas after the plan was last saved. */
  canvasEdited: boolean;
  /** What stops it being switched on (unanswered questions, a missing channel). */
  blockers: string[];
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
}

export interface StudioCatalogTool {
  name: string;
  label: string;
  description: string;
  scope: string;
  access: 'read' | 'write';
  app: string;
  activity: string;
  approvalByDefault: boolean;
  parameters: Record<string, unknown>;
  optional: string[];
}

export interface StudioCatalogApp {
  provider: string;
  name: string;
  integrationId: string;
  status: string;
  actions: Array<{
    tool: string;
    label: string;
    description: string;
    access: 'read' | 'write' | 'destructive';
    inputs: string[];
  }>;
}

export interface StudioCatalog {
  tools: StudioCatalogTool[];
  apps: StudioCatalogApp[];
  events: ReadonlyArray<{ value: AgentEventName; label: string; filter?: 'channel' | 'project' }>;
}

/** What the planner understood — shown above a new plan. */
export interface PlanUnderstanding {
  summary: string;
  runsWhen: string;
  uses: string[];
  produces: string;
  plannedBy: 'ai' | 'template';
  model?: string;
  durationMs: number;
}

export interface AgentPlanResponse {
  blueprint: AgentBlueprint;
  understanding: PlanUnderstanding;
}

export interface StudioHome {
  greetingName: string;
  timezone: string;
  stats: {
    running: number;
    completedToday: number;
    itemsCreatedToday: number;
    approvalsWaiting: number;
    issues: number;
    activeAgents: number;
  };
  runningNow: Array<{
    id: string;
    status: string;
    startedAt: string;
    entityType: string;
    entityId: string;
    name: string | null;
    currentStep: { stepId: string; status: string; nodeType: string } | null;
  }>;
  approvals: Array<{ id: string; runId: string | null; action: string; createdAt: string; agentName: string | null }>;
  recentlyCompleted: Array<{ id: string; entityId: string; name: string | null; finishedAt: string | null }>;
  failed: Array<{ id: string; entityId: string; name: string | null; startedAt: string }>;
  scheduled: Array<{ id: string; name: string; nextRunAt: string | null; trigger: AgentBlueprintTrigger }>;
  /** Template ids not yet used in this workspace. */
  recommended: string[];
}

export interface StudioAgentVersion {
  versionNumber: number;
  name: string;
  changeSummary: string | null;
  isPublished: boolean;
  createdAt: string;
  profile: AgentProfile | null;
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
}

export interface StudioRunStarted {
  runId: string;
  executionId: string | null;
  status: 'RUNNING';
}

/** `ai.run.updated` — a workflow/agent run moved on (a step started or finished, or the run ended). */
export interface AIRunUpdatePayload {
  runId: string;
  workflowId: string;
  status: string;
  step?: { stepId: string; status: string; label?: string };
}

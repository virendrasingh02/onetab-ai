export type AgentBuilderState =
  | 'IDLE'
  | 'INTAKE'
  | 'UNDERSTAND'
  | 'REQUIREMENTS'
  | 'AGENT_PLAN'
  | 'PLAN_REVIEW'
  | 'BUILDING'
  | 'TESTING'
  | 'PREVIEW'
  | 'PUBLISH_REVIEW'
  | 'PUBLISHED'
  | 'ITERATING'
  | 'PAUSED'
  | 'ERROR'
  | 'CANCELLED';

export type AgentCategory =
  | 'integration_agent'
  | 'workflow_agent'
  | 'knowledge_agent'
  | 'research_agent'
  | 'productivity_agent'
  | 'communication_agent'
  | 'coding_agent'
  | 'business_agent'
  | 'personal_agent'
  | 'custom_agent'
  | 'multi_agent';

export interface IntentClassification {
  intent: 'create_agent' | 'modify_agent' | 'chat_with_agent' | 'unknown';
  category: AgentCategory;
  integration?: string | null;
  agentic: boolean;
  confidence: number;
  reasoning?: string;
  suggestedName?: string;
  suggestedRole?: string;
}

export type DynamicQuestionType = 'single-select' | 'multi-select' | 'toggle' | 'text';

export interface DynamicQuestionOption {
  label: string;
  value: string;
  description?: string;
  isRecommended?: boolean;
}

export interface DynamicQuestion {
  id: string;
  label: string;
  description?: string;
  type: DynamicQuestionType;
  options?: DynamicQuestionOption[];
  default?: unknown;
  required: boolean;
  group: string;
}

export type PlanStepType =
  | 'integration'
  | 'tool'
  | 'workflow'
  | 'memory'
  | 'permission'
  | 'prompt'
  | 'test'
  | 'publish';

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  type: PlanStepType;
  dependencies: string[];
  status: PlanStepStatus;
  error?: string;
  details?: Record<string, unknown>;
}

export interface AgentPlan {
  steps: PlanStep[];
  overview?: string;
}

export interface AgentSpecToolRef {
  id: string;
  name: string;
  description?: string;
  category?: string;
  integration?: string;
  permissionLevel?: 'read' | 'write' | 'admin';
  requiresConfirmation?: boolean;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  enabled: boolean;
}

export interface AgentSpecIntegrationRef {
  provider: string; // 'GMAIL' | 'GITHUB' | 'SLACK' | 'NOTION' etc.
  connectionId?: string;
  requiredScopes?: string[];
  status?: 'connected' | 'disconnected' | 'needs_auth';
}

export interface AgentSpecWorkflowRef {
  id: string;
  name: string;
  trigger: string;
  stepsCount: number;
  graphJson?: string;
}

export interface AgentSpecTriggerRef {
  type:
    | 'manual'
    | 'chat'
    | 'schedule'
    | 'webhook'
    | 'event'
    | 'integration_event'
    | 'agent_delegation';
  config?: Record<string, unknown>;
}

export interface AgentSpecUIConfig {
  icon?: string;
  theme?: string;
  avatarUrl?: string | null;
  suggestedPrompts?: string[];
  welcomeMessage?: string;
}

export interface AgentSpec {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: 'agent' | 'coworker';
  role: string;
  category: AgentCategory;

  instructions: {
    systemPrompt: string;
    systemInstructions?: string;
    personality?: string;
  };

  model: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };

  tools: AgentSpecToolRef[];
  integrations: AgentSpecIntegrationRef[];

  memory: {
    useWorkspaceMemory: boolean;
    conversationMemory: boolean;
    userPreferences: boolean;
  };

  knowledge: {
    knowledgeBaseIds: string[];
    retrievalMode?: 'SEMANTIC' | 'KEYWORD' | 'HYBRID';
    topK?: number;
  };

  permissions: {
    role: 'owner' | 'editor' | 'user' | 'viewer';
    toolPolicies: Record<string, { requiresApproval?: boolean; allowedRoles?: string[] }>;
    channelIds?: string[];
    projectIds?: string[];
  };

  guardrails: {
    pii?: 'redact' | 'block' | 'warn';
    maxTokensPerRun?: number;
    contentFilters?: string[];
  };

  workflows: AgentSpecWorkflowRef[];
  triggers: AgentSpecTriggerRef[];

  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;

  ui: AgentSpecUIConfig;

  version: number;
  status: 'draft' | 'testing' | 'published' | 'paused' | 'archived';
}

export interface AgentDiffItem {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  component:
    | 'tool'
    | 'workflow'
    | 'prompt'
    | 'permission'
    | 'integration'
    | 'memory'
    | 'guardrail';
  name: string;
  description: string;
  before?: unknown;
  after?: unknown;
}

export interface AgentIterationDiff {
  userRequest: string;
  impactSummary: string;
  changes: AgentDiffItem[];
  appliedSpec: AgentSpec;
}

export interface AgentBuilderRunEvent {
  runId: string;
  timestamp: number;
  type:
    | 'state_changed'
    | 'assistant_message'
    | 'question'
    | 'plan'
    | 'step_started'
    | 'tool_started'
    | 'tool_result'
    | 'step_done'
    | 'step_failed'
    | 'approval_required'
    | 'preview_ready'
    | 'error'
    | 'done';
  payload: Record<string, unknown>;
}

import type { IsoDateString } from './entities.js';

// ==========================================
// 1. KNOWLEDGE / RAG TYPES
// ==========================================

export type KnowledgeSourceType = 'FILE' | 'URL' | 'WORKSPACE' | 'MANUAL';
export type KnowledgeDocumentStatus = 'QUEUED' | 'PROCESSING' | 'INDEXED' | 'FAILED';
export type KnowledgeRetrievalMode = 'SEMANTIC' | 'KEYWORD' | 'HYBRID';

export interface KnowledgeBase {
  id: string;
  workspaceId: string;
  createdById?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  embeddingModel: string;
  vectorCollection: string;
  settings: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  _count?: {
    documents: number;
  };
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  sourceUri?: string | null;
  sourceType: KnowledgeSourceType;
  status: KnowledgeDocumentStatus;
  mimeType?: string | null;
  tokenCount: number;
  chunkCount: number;
  rawText?: string | null;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface KnowledgeRetrievalQuery {
  query: string;
  topK?: number;
  mode?: KnowledgeRetrievalMode;
  scoreThreshold?: number;
  filters?: Record<string, unknown>;
}

export interface KnowledgeRetrievalResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  citation: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  icon?: string;
  embeddingModel?: string;
}

export interface IngestDocumentInput {
  name: string;
  sourceType: KnowledgeSourceType;
  sourceUri?: string;
  rawText?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

// ==========================================
// 2. AI APPS TYPES
// ==========================================

export type AIAppType = 'CHAT_APP' | 'WORKFLOW_APP' | 'AGENT_APP' | 'CUSTOM_UI';
export type AIAppVisibility = 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';

export interface AIApp {
  id: string;
  workspaceId: string;
  creatorId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  appType: AIAppType;
  visibility: AIAppVisibility;
  isPublished: boolean;
  config: Record<string, unknown>;
  agentId?: string | null;
  workflowId?: string | null;
  promptTemplateId?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateAIAppInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  appType: AIAppType;
  visibility?: AIAppVisibility;
  agentId?: string;
  workflowId?: string;
  promptTemplateId?: string;
  config?: Record<string, unknown>;
}

// ==========================================
// 3. WORKFLOW NODES & VARIABLES (35+ NODES)
// ==========================================

export type WorkflowNodeType =
  // Triggers & I/O
  | 'START'
  | 'TRIGGER'
  | 'USER_INPUT'
  | 'OUTPUT'
  | 'HUMAN_APPROVAL'
  | 'HUMAN_INPUT'
  // Intelligence
  | 'LLM'
  | 'AGENT'
  | 'AI_COWORKER'
  | 'PROMPT'
  | 'KNOWLEDGE_RETRIEVAL'
  | 'CLASSIFIER'
  | 'STRUCTURED_OUTPUT'
  | 'EXTRACT_DATA'
  // Logic & Flow
  | 'CONDITION'
  | 'SWITCH'
  | 'LOOP'
  | 'ITERATION'
  | 'PARALLEL'
  | 'MERGE'
  | 'DELAY'
  | 'RETRY'
  | 'ERROR_HANDLER'
  // Compute & Data
  | 'VARIABLE'
  | 'TEMPLATE'
  | 'CODE'
  | 'HTTP_REQUEST'
  | 'API'
  | 'TOOL'
  | 'APP'
  | 'MCP'
  | 'DATABASE'
  | 'TRANSFORM'
  // Multimodal
  | 'FILE'
  | 'IMAGE'
  | 'AUDIO';

export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file'
  | 'image'
  | 'audio'
  | 'json'
  | 'secret';

export type VariableSource =
  | 'user_input'
  | 'previous_node'
  | 'workspace'
  | 'user'
  | 'channel'
  | 'dm'
  | 'app'
  | 'agent'
  | 'knowledge'
  | 'environment'
  | 'api'
  | 'trigger';

export interface WorkflowVariable {
  name: string;
  type: VariableType;
  value?: unknown;
  source?: VariableSource;
  description?: string;
  required?: boolean;
}

export interface WorkflowNodeSchema {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  inputs?: WorkflowVariable[];
  outputs?: WorkflowVariable[];
  isEnabled?: boolean;
}

export interface WorkflowEdgeSchema {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

// ==========================================
// 4. HUMAN-IN-THE-LOOP (HITL) APPROVALS
// ==========================================

export type ApprovalState =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface AIApprovalRequest {
  id: string;
  workspaceId: string;
  requesterId?: string | null;
  approverId?: string | null;
  entityType: 'WORKFLOW' | 'AGENT' | 'TOOL';
  entityId: string;
  executionId?: string | null;
  stepId?: string | null;
  actionType: string;
  proposedPayload: Record<string, unknown>;
  state: ApprovalState;
  comment?: string | null;
  createdAt: IsoDateString;
  respondedAt?: IsoDateString | null;
  requester?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  approver?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
}

export interface ApprovalDecisionInput {
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
  revisedPayload?: Record<string, unknown>;
}

// ==========================================
// 5. UNIFIED EXECUTIONS & OBSERVABILITY
// ==========================================

export type AIExecutionStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'WAITING_APPROVAL';

export interface AIExecutionStep {
  id: string;
  executionId: string;
  stepId: string;
  nodeType: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'WAITING';
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  latencyMs: number;
  tokensUsed: number;
  errorMessage?: string | null;
  startedAt: IsoDateString;
  finishedAt?: IsoDateString | null;
}

export interface AIExecution {
  id: string;
  workspaceId: string;
  userId?: string | null;
  entityType: 'WORKFLOW' | 'AGENT' | 'COWORKER' | 'APP';
  entityId: string;
  version: number;
  status: AIExecutionStatus;
  startedAt: IsoDateString;
  finishedAt?: IsoDateString | null;
  latencyMs: number;
  tokensUsed: number;
  totalCost: number;
  model?: string | null;
  toolCalls: Array<Record<string, unknown>>;
  errorsJson?: Record<string, unknown> | null;
  stateJson: Record<string, unknown>;
  user?: {
    id: string;
    name: string;
  } | null;
  steps?: AIExecutionStep[];
}

export interface AIExecutionFilter {
  status?: AIExecutionStatus;
  entityType?: 'WORKFLOW' | 'AGENT' | 'COWORKER' | 'APP';
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ==========================================
// 6. SECRETS & MCP CONNECTIONS
// ==========================================

export interface AISecret {
  id: string;
  workspaceId: string;
  createdById?: string | null;
  key: string;
  maskedValue: string;
  description?: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateAISecretInput {
  key: string;
  value: string;
  description?: string;
}

/** A fact an Agent/Coworker saved via the `save_memory` tool — workspace
 *  scoped, shared across every entity in it (there is no per-agent tier). */
export interface AIMemoryEntry {
  id: string;
  workspaceId: string;
  key: string;
  value: string;
  source: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export type MCPTransport = 'HTTP' | 'SSE' | 'STDIO';
export type MCPConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface MCPConnection {
  id: string;
  workspaceId: string;
  createdById?: string | null;
  name: string;
  serverUrl: string;
  transport: MCPTransport;
  status: MCPConnectionStatus;
  authConfig: Record<string, unknown>;
  discoveredToolsJson: Array<Record<string, unknown>>;
  isEnabled: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateMCPConnectionInput {
  name: string;
  serverUrl: string;
  transport?: MCPTransport;
  headers?: Record<string, string>;
  token?: string;
}

// ==========================================
// 7. AI STUDIO OVERVIEW & FEEDBACK
// ==========================================

export interface AIStudioOverview {
  totalAgents: number;
  totalCoworkers: number;
  totalWorkflows: number;
  totalApps: number;
  totalKnowledgeBases: number;
  totalExecutions: number;
  successRate: number;
  totalTokensUsed: number;
  totalCostEstimate: number;
  recentExecutions: AIExecution[];
  draftResources: Array<{
    id: string;
    name: string;
    type: 'agent' | 'coworker' | 'workflow' | 'app';
    updatedAt: IsoDateString;
  }>;
  publishedResources: Array<{
    id: string;
    name: string;
    type: 'agent' | 'coworker' | 'workflow' | 'app';
    updatedAt: IsoDateString;
  }>;
}

export interface AIFeedbackPayload {
  executionId?: string;
  agentId?: string;
  workflowId?: string;
  rating: 1 | -1;
  comment?: string;
  issueCategory?: string;
}

export interface AIObservabilityMetrics {
  timeseries: Array<{
    date: string;
    runs: number;
    tokens: number;
    cost: number;
    errors: number;
  }>;
  topModels: Array<{
    model: string;
    count: number;
  }>;
  topTools: Array<{
    tool: string;
    count: number;
  }>;
}

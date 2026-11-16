import type { IsoDateString } from './entities.js';

// ==========================================
// KNOWLEDGE GRAPH & CONTEXT ENGINE CONTRACTS
// ==========================================

export type GraphEntityType =
  | 'Organization'
  | 'Workspace'
  | 'User'
  | 'Team'
  | 'Project'
  | 'Task'
  | 'Subtask'
  | 'Document'
  | 'File'
  | 'Folder'
  | 'Conversation'
  | 'Message'
  | 'Meeting'
  | 'Decision'
  | 'Repository'
  | 'SourceFile'
  | 'Function'
  | 'Class'
  | 'Component'
  | 'Hook'
  | 'API'
  | 'Endpoint'
  | 'Database'
  | 'Integration'
  | 'Application'
  | 'Tool'
  | 'AIAgent'
  | 'Workflow'
  | 'WorkflowNode'
  | 'KnowledgeSource'
  | 'Memory'
  | 'CustomEntity'
  | (string & {});

export type GraphRelationType =
  | 'belongs_to'
  | 'created_by'
  | 'assigned_to'
  | 'member_of'
  | 'references'
  | 'depends_on'
  | 'imports'
  | 'exports'
  | 'calls'
  | 'renders'
  | 'contains'
  | 'parent_of'
  | 'child_of'
  | 'uses'
  | 'connected_to'
  | 'triggered_by'
  | 'produces'
  | 'consumes'
  | 'mentions'
  | 'derived_from'
  | 'generated_from'
  | 'related_to'
  | 'linked_to'
  | (string & {});

export interface GraphNodeDto {
  id: string;
  workspaceId: string;
  organizationId?: string | null;
  entityType: GraphEntityType;
  name: string;
  identifier?: string | null;
  description?: string | null;
  sourceRef?: string | null;
  sourceType?: string | null;
  sourceUri?: string | null;
  contentHash?: string | null;
  version: number;
  confidence: number;
  provenance?: string | null;
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface GraphEdgeDto {
  id: string;
  workspaceId: string;
  organizationId?: string | null;
  relationType: GraphRelationType;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
  confidence: number;
  provenance?: string | null;
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  sourceNode?: GraphNodeDto;
  targetNode?: GraphNodeDto;
}

export interface GraphSourceDto {
  id: string;
  workspaceId: string;
  name: string;
  sourceType: string;
  sourceUri?: string | null;
  status: 'QUEUED' | 'INDEXING' | 'INDEXED' | 'FAILED' | 'STALE';
  contentHash?: string | null;
  version: number;
  nodeCount: number;
  edgeCount: number;
  errorMessage?: string | null;
  lastIndexedAt?: IsoDateString | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SubgraphDto {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  centerNodeId?: string;
  totalNodes: number;
  totalEdges: number;
}

export interface GraphQueryInput {
  query?: string;
  entityTypes?: GraphEntityType[];
  relationTypes?: GraphRelationType[];
  sourceTypes?: string[];
  limit?: number;
  offset?: number;
  provenance?: string;
}

export interface GraphTraversalInput {
  startNodeId?: string;
  startIdentifier?: string;
  entityType?: GraphEntityType;
  maxDepth?: number;
  relationTypes?: GraphRelationType[];
  targetEntityTypes?: GraphEntityType[];
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  limit?: number;
}

export type ContextRetrievalMode = 'GRAPH' | 'VECTOR' | 'HYBRID' | 'DIRECT';

export interface ContextQueryRequest {
  query: string;
  mode?: ContextRetrievalMode;
  maxTokens?: number;
  traversalDepth?: number;
  topK?: number;
  similarityThreshold?: number;
  recencyWeight?: number;
  sourcePriority?: string[];
  allowedEntityTypes?: GraphEntityType[];
  actingUserId?: string | null;
  targetEntity?: {
    type: GraphEntityType;
    id?: string;
    identifier?: string;
  };
}

export interface ContextConnectedEntity {
  name: string;
  type: string;
  relation: string;
  targetId?: string;
}

export interface ContextSourceItem {
  id: string;
  title: string;
  entityType: GraphEntityType;
  sourceRef?: string | null;
  sourceUri?: string | null;
  link?: string;
  score: number;
  confidence?: number;
  provenance?: string;
  snippet: string;
  connectedEntities?: ContextConnectedEntity[];
}

export interface ContextEngineResult {
  query: string;
  mode: ContextRetrievalMode;
  promptContext: string;
  tokenBudget: number;
  tokensUsed: number;
  tokensSavedEstimate: number;
  sources: ContextSourceItem[];
  subgraph: SubgraphDto;
  entitiesResolved: Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
  }>;
  retrievalLatencyMs: number;
  fallbackUsed: boolean;
  grounded: boolean;
}

export interface KnowledgeGraphHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  totalNodes: number;
  totalEdges: number;
  totalSources: number;
  activeIndexingJobs: number;
  failedJobs: number;
  staleSources: number;
  averageQueryLatencyMs: number;
  cacheHitRate: number;
  storageSizeBytes: number;
  entityDistribution: Record<string, number>;
  relationDistribution: Record<string, number>;
  measuredTokenSavingsPercent: number;
}

export interface CreateGraphEntityInput {
  entityType: GraphEntityType;
  name: string;
  identifier?: string;
  description?: string;
  sourceRef?: string;
  sourceType?: string;
  sourceUri?: string;
  confidence?: number;
  provenance?: string;
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateGraphRelationshipInput {
  relationType: GraphRelationType;
  sourceNodeId: string;
  targetNodeId: string;
  weight?: number;
  confidence?: number;
  provenance?: string;
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface IndexSourceInput {
  name: string;
  sourceType: 'CODE_REPO' | 'DOCS' | 'TASKS' | 'PROJECTS' | 'CONVERSATIONS' | 'INTEGRATION' | 'CUSTOM';
  sourceUri?: string;
  metadata?: Record<string, unknown>;
  codeFiles?: Array<{
    filePath: string;
    content: string;
  }>;
}

export interface AgentKnowledgeConfig {
  sources: Array<'workspace' | 'projects' | 'docs' | 'knowledge_db' | 'codebase' | 'conversations' | string>;
  retrievalMode: ContextRetrievalMode;
  maxTokens: number;
  traversalDepth: number;
  topK: number;
  similarityThreshold: number;
  recencyWeight: number;
  allowedEntityTypes?: GraphEntityType[];
}

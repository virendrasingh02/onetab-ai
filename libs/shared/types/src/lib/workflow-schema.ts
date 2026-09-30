import type { IsoDateString } from './entities.js';
import type { WorkflowNodeType, WorkflowVariable } from './ai-studio.js';

/**
 * Universal Workflow Graph Schema (Version 1.0.0)
 *
 * Defines the contract between Visual Workflow Canvas (frontend),
 * Node Inspector, Serialization / Storage (Postgres Prisma), and
 * Workflow Execution Engine / Runtime (backend).
 */

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowPortSchema {
  id: string;
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  description?: string;
}

export interface WorkflowNodeData {
  label: string;
  category?: string;
  description?: string;
  icon?: string;
  config: Record<string, unknown>;
  inputs?: WorkflowVariable[];
  outputs?: WorkflowVariable[];
  isEnabled?: boolean;
  status?: 'idle' | 'running' | 'success' | 'failed' | 'paused';
  lastRunError?: string | null;
  [key: string]: unknown;
}

export interface WorkflowNodeInstance {
  id: string;
  type: WorkflowNodeType | string;
  position: WorkflowPosition;
  data: WorkflowNodeData;
  width?: number;
  height?: number;
  selected?: boolean;
  parentId?: string;
}

export interface WorkflowEdgeInstance {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  type?: string;
  animated?: boolean;
  data?: Record<string, unknown>;
}

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowGraphDefinition {
  schemaVersion: '1.0.0';
  id?: string;
  name?: string;
  description?: string;
  viewport?: WorkflowViewport;
  nodes: WorkflowNodeInstance[];
  edges: WorkflowEdgeInstance[];
  variables?: WorkflowVariable[];
  environment?: Record<string, string>;
  metadata?: {
    createdAt?: IsoDateString;
    updatedAt?: IsoDateString;
    createdBy?: string;
    version?: number;
    tags?: string[];
    [key: string]: unknown;
  };
}

/**
 * Creates a valid, empty workflow graph definition.
 */
export function createEmptyWorkflowGraph(name = 'New Workflow'): WorkflowGraphDefinition {
  return {
    schemaVersion: '1.0.0',
    name,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    variables: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };
}

/**
 * Node Registry Contract for 35+ node types
 */
export type NodeCategory =
  | 'triggers'
  | 'input_output'
  | 'intelligence'
  | 'logic'
  | 'compute_data'
  | 'tools_mcp'
  | 'knowledge_rag'
  | 'hitl'
  | 'multi_agent'
  | 'multimodal';

export interface NodeRegistryDefinition {
  type: string;
  category: NodeCategory;
  name: string;
  description: string;
  icon: string;
  color?: string;
  inputs: WorkflowPortSchema[];
  outputs: WorkflowPortSchema[];
  defaultConfig: Record<string, unknown>;
  validate?: (config: Record<string, unknown>) => { valid: boolean; errors: string[] };
}

/**
 * Standard Structured Error Codes for Agent & Workflow Execution
 */
export const AgentStudioErrorCode = {
  // Graph validation errors
  GRAPH_INVALID_JSON: 'GRAPH_INVALID_JSON',
  GRAPH_EMPTY: 'GRAPH_EMPTY',
  GRAPH_MISSING_AGENT_NODE: 'GRAPH_MISSING_AGENT_NODE',
  GRAPH_CYCLE_DETECTED: 'GRAPH_CYCLE_DETECTED',
  GRAPH_DISCONNECTED_COMPONENTS: 'GRAPH_DISCONNECTED_COMPONENTS',
  
  // Execution runtime errors
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  EXECUTION_CANCELLED: 'EXECUTION_CANCELLED',
  EXECUTION_RATE_LIMITED: 'EXECUTION_RATE_LIMITED',
  EXECUTION_INSUFFICIENT_CREDITS: 'EXECUTION_INSUFFICIENT_CREDITS',
  
  // Model & Provider errors
  MODEL_PROVIDER_UNAVAILABLE: 'MODEL_PROVIDER_UNAVAILABLE',
  MODEL_INVALID_KEY: 'MODEL_INVALID_KEY',
  MODEL_CONTEXT_LENGTH_EXCEEDED: 'MODEL_CONTEXT_LENGTH_EXCEEDED',
  MODEL_OUTPUT_PARSE_FAILED: 'MODEL_OUTPUT_PARSE_FAILED',
  
  // Tool & MCP errors
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_PERMISSION_DENIED: 'TOOL_PERMISSION_DENIED',
  TOOL_APPROVAL_REJECTED: 'TOOL_APPROVAL_REJECTED',
  TOOL_APPROVAL_EXPIRED: 'TOOL_APPROVAL_EXPIRED',
  MCP_SERVER_UNREACHABLE: 'MCP_SERVER_UNREACHABLE',
  MCP_HANDSHAKE_FAILED: 'MCP_HANDSHAKE_FAILED',
  
  // Security & Guardrail errors
  GUARDRAIL_PII_VIOLATION: 'GUARDRAIL_PII_VIOLATION',
  GUARDRAIL_CONTENT_POLICY_VIOLATION: 'GUARDRAIL_CONTENT_POLICY_VIOLATION',
  GUARDRAIL_PROMPT_INJECTION_DETECTED: 'GUARDRAIL_PROMPT_INJECTION_DETECTED',
  
  // Knowledge & Storage errors
  KNOWLEDGE_EMPTY_INDEX: 'KNOWLEDGE_EMPTY_INDEX',
  KNOWLEDGE_CHUNK_FAILED: 'KNOWLEDGE_CHUNK_FAILED',
  SECRET_NOT_FOUND: 'SECRET_NOT_FOUND',
} as const;

export type AgentStudioErrorCode =
  (typeof AgentStudioErrorCode)[keyof typeof AgentStudioErrorCode];

export interface AgentStudioErrorDetails {
  code: AgentStudioErrorCode;
  message: string;
  nodeId?: string;
  stepId?: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

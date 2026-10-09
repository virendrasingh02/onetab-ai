/**
 * Complete Widget System Type Definitions for AI Agent Studio
 *
 * Covers:
 * - Widget definitions, categories, and lifecycle states
 * - Modular configurations (Appearance, Data Sources, Schemas, Events, Permissions)
 * - Category-specific schemas (Data/Viz, Interactive Input, AI-Powered, Connectors, Productivity)
 * - Widget instances and execution logs
 * - Normalized event contracts
 * - Workflow node specifications for React Flow canvas
 */

export type WidgetCategory =
  | 'data_viz'
  | 'interactive_input'
  | 'ai_powered'
  | 'app_connector'
  | 'productivity';

export const WIDGET_CATEGORIES: readonly WidgetCategory[] = [
  'data_viz',
  'interactive_input',
  'ai_powered',
  'app_connector',
  'productivity',
];

export type WidgetStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

export type WidgetVisibility = 'WORKSPACE' | 'PRIVATE' | 'PUBLIC';

export type WidgetComponentType =
  // Data & Visualization
  | 'metric_card'
  | 'bar_chart'
  | 'line_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'table_view'
  | 'data_grid'
  | 'progress_summary'
  | 'timeline'
  // Interactive Input
  | 'text_input'
  | 'select_input'
  | 'toggle_input'
  | 'date_picker'
  | 'number_input'
  | 'file_upload'
  | 'approval_form'
  | 'dynamic_form'
  // AI-Powered
  | 'ai_summary'
  | 'ai_research'
  | 'ai_extraction'
  | 'ai_sentiment'
  | 'ai_recommendation'
  | 'ai_prompt'
  | 'ai_approval'
  // App Connector
  | 'connector_action'
  | 'connector_feed'
  | 'connector_status'
  // Productivity & Platform
  | 'task_kanban'
  | 'project_milestones'
  | 'doc_preview'
  | 'inbox_feed'
  | 'meeting_summary';

export type WidgetRefreshMode = 'manual' | 'periodic' | 'realtime' | 'on_workflow_step';

export type WidgetDataSourceType =
  | 'workflow_output'
  | 'api_rest'
  | 'connector_query'
  | 'platform_service'
  | 'static_sample';

export interface WidgetDataSourceConfig {
  type: WidgetDataSourceType;
  /** Name of the workflow variable or path to extract e.g. "task_summary.data" */
  variablePath?: string;
  /** REST API URL when type is 'api_rest' */
  apiUrl?: string;
  apiMethod?: 'GET' | 'POST';
  apiHeaders?: Record<string, string>;
  apiBody?: Record<string, unknown>;
  /** Connector provider and capability e.g. SLACK / list_channel_messages */
  connectorProvider?: string;
  connectorActionId?: string;
  connectorParams?: Record<string, unknown>;
  /** Platform service name e.g. 'tasks', 'projects', 'docs', 'activity' */
  platformService?: 'tasks' | 'projects' | 'docs' | 'activity' | 'meetings';
  platformFilters?: Record<string, unknown>;
  refreshIntervalSec?: number;
  autoRefresh?: boolean;
}

export interface WidgetFieldSchema {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'array' | 'object' | 'file';
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  description?: string;
  options?: Array<{ label: string; value: string | number }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    allowedExtensions?: string[];
  };
  dependsOn?: {
    fieldId: string;
    equals: unknown;
  };
}

export interface WidgetSchemaConfig {
  inputFields?: WidgetFieldSchema[];
  outputFields?: WidgetFieldSchema[];
  allowCustomOutputs?: boolean;
}

export type WidgetEventName =
  | 'widget.created'
  | 'widget.updated'
  | 'widget.published'
  | 'widget.opened'
  | 'widget.input.changed'
  | 'widget.action.requested'
  | 'widget.execution.started'
  | 'widget.execution.completed'
  | 'widget.execution.failed'
  | 'widget.approval.requested'
  | 'widget.approval.completed';

export interface WidgetEventAction {
  id: string;
  triggerEvent: 'on_click' | 'on_submit' | 'on_change' | 'on_approval' | 'on_refresh';
  targetType: 'workflow_trigger' | 'agent_message' | 'connector_action' | 'navigation';
  targetId?: string;
  payloadMapping?: Record<string, string>;
  requireConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface WidgetEventConfig {
  actions: WidgetEventAction[];
  debounceMs?: number;
  preventDuplicateSubmissions?: boolean;
}

export interface WidgetAppearanceConfig {
  size: 'compact' | 'standard' | 'large' | 'full';
  colorTheme?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'neutral';
  customHeader?: boolean;
  showIcon?: boolean;
  showBorder?: boolean;
  roundedRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  customCssClasses?: string;
}

export interface WidgetPermissionsConfig {
  canView: 'workspace_members' | 'admins_only' | 'creator_only';
  canEdit: 'admins_and_creator' | 'creator_only';
  canExecute: 'workspace_members' | 'admins_only';
  requiresApprovalForExternalWrites?: boolean;
}

export interface WidgetDefinition {
  id: string;
  workspaceId: string;
  creatorId: string;
  creatorName?: string;
  name: string;
  slug: string;
  description?: string;
  category: WidgetCategory;
  componentType: WidgetComponentType;
  icon?: string;
  tags: string[];
  status: WidgetStatus;
  visibility: WidgetVisibility;
  version: number;
  appearance: WidgetAppearanceConfig;
  dataSource: WidgetDataSourceConfig;
  schemaConfig: WidgetSchemaConfig;
  eventConfig: WidgetEventConfig;
  permissions: WidgetPermissionsConfig;
  sampleData?: Record<string, unknown>;
  isTemplate?: boolean;
  templateCategory?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  usageCount?: number;
}

export interface WidgetInstance {
  id: string;
  workspaceId: string;
  widgetDefinitionId: string;
  widgetDefinition?: WidgetDefinition;
  entityType: 'AGENT' | 'WORKFLOW' | 'DASHBOARD' | 'CHAT';
  entityId: string;
  name?: string;
  configOverride?: Partial<WidgetAppearanceConfig & { dataSource?: Partial<WidgetDataSourceConfig> }>;
  stateJson?: Record<string, unknown>;
  placement?: string;
  layout?: { x: number; y: number; w: number; h: number };
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetVersion {
  id: string;
  widgetDefinitionId: string;
  versionNumber: number;
  changeSummary?: string;
  snapshotJson: Partial<WidgetDefinition>;
  isPublished: boolean;
  createdAt: string;
  createdBy?: string;
}

export type WidgetExecutionType = 'RENDER' | 'ACTION' | 'DATA_FETCH' | 'TOOL_CALL';
export type WidgetExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'WAITING_APPROVAL';

export interface WidgetExecutionRecord {
  id: string;
  workspaceId: string;
  widgetDefinitionId: string;
  widgetInstanceId?: string;
  executionType: WidgetExecutionType;
  status: WidgetExecutionStatus;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  latencyMs: number;
  errorMessage?: string;
  errorJson?: Record<string, unknown>;
  initiatedBy?: string;
  createdAt: string;
}

export interface WidgetTemplateItem {
  id: string;
  name: string;
  category: WidgetCategory;
  componentType: WidgetComponentType;
  description: string;
  icon: string;
  tags: string[];
  sampleData: Record<string, unknown>;
  defaultConfig: {
    appearance: WidgetAppearanceConfig;
    dataSource: WidgetDataSourceConfig;
    schemaConfig: WidgetSchemaConfig;
    eventConfig: WidgetEventConfig;
  };
}

/**
 * React Flow Canvas Widget Node Types
 */
export type WorkflowWidgetNodeType =
  | 'WIDGET_TRIGGER'
  | 'WIDGET_RENDERER'
  | 'WIDGET_INPUT'
  | 'WIDGET_OUTPUT'
  | 'WIDGET_DATA_SOURCE'
  | 'WIDGET_EVENT_HANDLER'
  | 'WIDGET_ACTION'
  | 'WIDGET_CONDITION'
  | 'WIDGET_APPROVAL'
  | 'WIDGET_ERROR_HANDLER';

export const WORKFLOW_WIDGET_NODE_TYPES: readonly WorkflowWidgetNodeType[] = [
  'WIDGET_TRIGGER',
  'WIDGET_RENDERER',
  'WIDGET_INPUT',
  'WIDGET_OUTPUT',
  'WIDGET_DATA_SOURCE',
  'WIDGET_EVENT_HANDLER',
  'WIDGET_ACTION',
  'WIDGET_CONDITION',
  'WIDGET_APPROVAL',
  'WIDGET_ERROR_HANDLER',
];

export function isWidgetNodeType(type: string): type is WorkflowWidgetNodeType {
  return (WORKFLOW_WIDGET_NODE_TYPES as readonly string[]).includes(type.toUpperCase());
}

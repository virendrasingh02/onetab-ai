import { z } from 'zod';

const anyRecord = z.record(z.string(), z.unknown());
const stringRecord = z.record(z.string(), z.string());

export const widgetCategorySchema = z.enum([
  'data_viz',
  'interactive_input',
  'ai_powered',
  'app_connector',
  'productivity',
]);

export const widgetStatusSchema = z.enum(['DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED']);

export const widgetVisibilitySchema = z.enum(['WORKSPACE', 'PRIVATE', 'PUBLIC']);

export const widgetComponentTypeSchema = z.enum([
  // Data & Visualization
  'metric_card',
  'bar_chart',
  'line_chart',
  'area_chart',
  'pie_chart',
  'table_view',
  'data_grid',
  'progress_summary',
  'timeline',
  // Interactive Input
  'text_input',
  'select_input',
  'toggle_input',
  'date_picker',
  'number_input',
  'file_upload',
  'approval_form',
  'dynamic_form',
  // AI-Powered
  'ai_summary',
  'ai_research',
  'ai_extraction',
  'ai_sentiment',
  'ai_recommendation',
  'ai_prompt',
  'ai_approval',
  // App Connector
  'connector_action',
  'connector_feed',
  'connector_status',
  // Productivity & Platform
  'task_kanban',
  'project_milestones',
  'doc_preview',
  'inbox_feed',
  'meeting_summary',
]);

export const widgetDataSourceConfigSchema = z.object({
  type: z.enum([
    'workflow_output',
    'api_rest',
    'connector_query',
    'platform_service',
    'static_sample',
  ]),
  variablePath: z.string().optional(),
  apiUrl: z.string().url().or(z.literal('')).optional(),
  apiMethod: z.enum(['GET', 'POST']).optional().default('GET'),
  apiHeaders: stringRecord.optional(),
  apiBody: anyRecord.optional(),
  connectorProvider: z.string().optional(),
  connectorActionId: z.string().optional(),
  connectorParams: anyRecord.optional(),
  platformService: z
    .enum(['tasks', 'projects', 'docs', 'activity', 'meetings'])
    .optional(),
  platformFilters: anyRecord.optional(),
  refreshIntervalSec: z.number().min(0).max(86400).optional(),
  autoRefresh: z.boolean().optional().default(false),
});

export const widgetFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    'string',
    'number',
    'boolean',
    'date',
    'select',
    'array',
    'object',
    'file',
  ]),
  required: z.boolean().optional().default(false),
  defaultValue: z.unknown().optional(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) }))
    .optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      allowedExtensions: z.array(z.string()).optional(),
    })
    .optional(),
  dependsOn: z
    .object({
      fieldId: z.string(),
      equals: z.unknown(),
    })
    .optional(),
});

export const widgetSchemaConfigSchema = z.object({
  inputFields: z.array(widgetFieldSchema).optional().default([]),
  outputFields: z.array(widgetFieldSchema).optional().default([]),
  allowCustomOutputs: z.boolean().optional().default(true),
});

export const widgetEventActionSchema = z.object({
  id: z.string(),
  triggerEvent: z.enum([
    'on_click',
    'on_submit',
    'on_change',
    'on_approval',
    'on_refresh',
  ]),
  targetType: z.enum([
    'workflow_trigger',
    'agent_message',
    'connector_action',
    'navigation',
  ]),
  targetId: z.string().optional(),
  payloadMapping: stringRecord.optional(),
  requireConfirmation: z.boolean().optional().default(false),
  confirmationMessage: z.string().optional(),
});

export const widgetEventConfigSchema = z.object({
  actions: z.array(widgetEventActionSchema).optional().default([]),
  debounceMs: z.number().min(0).max(5000).optional().default(300),
  preventDuplicateSubmissions: z.boolean().optional().default(true),
});

export const widgetAppearanceConfigSchema = z.object({
  size: z.enum(['compact', 'standard', 'large', 'full']).default('standard'),
  colorTheme: z
    .enum(['default', 'primary', 'success', 'warning', 'destructive', 'neutral'])
    .default('default'),
  customHeader: z.boolean().default(true),
  showIcon: z.boolean().default(true),
  showBorder: z.boolean().default(true),
  roundedRadius: z.enum(['none', 'sm', 'md', 'lg', 'full']).default('md'),
  customCssClasses: z.string().optional(),
});

export const widgetPermissionsConfigSchema = z.object({
  canView: z.enum(['workspace_members', 'admins_only', 'creator_only']).default('workspace_members'),
  canEdit: z.enum(['admins_and_creator', 'creator_only']).default('admins_and_creator'),
  canExecute: z.enum(['workspace_members', 'admins_only']).default('workspace_members'),
  requiresApprovalForExternalWrites: z.boolean().default(true),
});

export const createWidgetDefinitionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: widgetCategorySchema,
  componentType: widgetComponentTypeSchema,
  icon: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  visibility: widgetVisibilitySchema.optional().default('WORKSPACE'),
  appearance: widgetAppearanceConfigSchema.optional().default({
    size: 'standard',
    colorTheme: 'default',
    customHeader: true,
    showIcon: true,
    showBorder: true,
    roundedRadius: 'md',
  }),
  dataSource: widgetDataSourceConfigSchema.optional().default({
    type: 'static_sample',
    apiMethod: 'GET',
    autoRefresh: false,
  }),
  schemaConfig: widgetSchemaConfigSchema.optional().default({
    inputFields: [],
    outputFields: [],
    allowCustomOutputs: true,
  }),
  eventConfig: widgetEventConfigSchema.optional().default({
    actions: [],
    debounceMs: 300,
    preventDuplicateSubmissions: true,
  }),
  permissions: widgetPermissionsConfigSchema.optional().default({
    canView: 'workspace_members',
    canEdit: 'admins_and_creator',
    canExecute: 'workspace_members',
    requiresApprovalForExternalWrites: true,
  }),
  sampleData: anyRecord.optional(),
  isTemplate: z.boolean().optional().default(false),
  templateCategory: z.string().optional(),
});

export const updateWidgetDefinitionSchema = createWidgetDefinitionSchema.partial();

export const widgetQuerySchema = z.object({
  search: z.string().optional(),
  category: widgetCategorySchema.optional(),
  status: widgetStatusSchema.optional(),
  visibility: widgetVisibilitySchema.optional(),
  tag: z.string().optional(),
  sortBy: z.enum(['updatedAt', 'name', 'createdAt', 'usageCount']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const executeWidgetSchema = z.object({
  instanceId: z.string().optional(),
  executionType: z.enum(['RENDER', 'ACTION', 'DATA_FETCH', 'TOOL_CALL']).default('ACTION'),
  actionId: z.string().optional(),
  inputPayload: anyRecord.optional().default({}),
  overrideParams: anyRecord.optional(),
});

export const createWidgetInstanceSchema = z.object({
  widgetDefinitionId: z.string().min(1),
  entityType: z.enum(['AGENT', 'WORKFLOW', 'DASHBOARD', 'CHAT']),
  entityId: z.string().min(1),
  name: z.string().optional(),
  configOverride: anyRecord.optional(),
  stateJson: anyRecord.optional(),
  placement: z.string().optional(),
  layout: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  isEnabled: z.boolean().optional().default(true),
});

export const updateWidgetInstanceSchema = createWidgetInstanceSchema.partial();

export const publishWidgetSchema = z.object({
  changeSummary: z.string().max(300).optional(),
});

export const rollbackWidgetSchema = z.object({
  versionNumber: z.number().int().min(1),
});

export type CreateWidgetDefinitionInput = z.infer<typeof createWidgetDefinitionSchema>;
export type UpdateWidgetDefinitionInput = z.infer<typeof updateWidgetDefinitionSchema>;
export type WidgetQueryInput = z.infer<typeof widgetQuerySchema>;
export type ExecuteWidgetInput = z.infer<typeof executeWidgetSchema>;
export type CreateWidgetInstanceInput = z.infer<typeof createWidgetInstanceSchema>;
export type UpdateWidgetInstanceInput = z.infer<typeof updateWidgetInstanceSchema>;
export type PublishWidgetInput = z.infer<typeof publishWidgetSchema>;
export type RollbackWidgetInput = z.infer<typeof rollbackWidgetSchema>;

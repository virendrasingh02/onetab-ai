/**
 * Universal Custom Card Schema & AST Definitions
 *
 * Defines the platform-level declarative Card specification:
 * - Metadata & multi-surface configuration
 * - Data schema & typed fields
 * - Component hierarchy (AST) with 36+ supported primitives
 * - Safe data bindings & conditional visibility expressions
 * - Structured actions & permission requirements
 * - Multi-state layouts (loading, error, empty, expired, success)
 */

export type CardCategory =
  | 'ai'
  | 'crm'
  | 'productivity'
  | 'finance'
  | 'development'
  | 'communication'
  | 'marketing'
  | 'system'
  | 'custom';

export type CardVisibility = 'global' | 'workspace' | 'team' | 'private';

export type CardStatus = 'draft' | 'published' | 'archived';

export type CardSurface =
  | 'matrix'
  | 'agent'
  | 'workflow'
  | 'notification'
  | 'inbox'
  | 'dashboard'
  | 'search'
  | 'modal';

export type CardFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'currency'
  | 'url'
  | 'email'
  | 'image'
  | 'file'
  | 'user'
  | 'array'
  | 'object'
  | 'enum';

export interface CardDataField {
  name: string;
  label: string;
  type: CardFieldType;
  description?: string;
  defaultValue?: unknown;
  required?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  itemType?: CardFieldType; // For arrays
  schema?: Record<string, CardDataField>; // For nested objects
}

export interface CardDataSchema {
  fields: Record<string, CardDataField>;
}

export type CardComponentType =
  // Layout
  | 'container'
  | 'row'
  | 'column'
  | 'stack'
  | 'grid'
  | 'spacer'
  | 'divider'
  // Typography
  | 'text'
  | 'heading'
  | 'paragraph'
  | 'markdown'
  // Media
  | 'image'
  | 'icon'
  | 'avatar'
  // Elements
  | 'badge'
  | 'status'
  | 'button'
  | 'button_group'
  | 'link'
  // Data & Lists
  | 'key_value'
  | 'list'
  | 'table'
  | 'progress'
  | 'timeline'
  | 'user'
  | 'file'
  | 'code'
  | 'json'
  // Forms
  | 'form'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'date'
  // Feedback & Containers
  | 'tabs'
  | 'accordion'
  | 'alert'
  | 'empty_state'
  | 'loading_state';

export type CardConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'exists'
  | 'empty'
  | 'not_empty';

export interface CardVisibilityCondition {
  field?: string;
  operator?: CardConditionOperator;
  value?: unknown;
  and?: CardVisibilityCondition[];
  or?: CardVisibilityCondition[];
}

export type CardActionType =
  | 'open_url'
  | 'send_message'
  | 'run_agent'
  | 'run_workflow'
  | 'call_api'
  | 'update_record'
  | 'create_record'
  | 'delete_record'
  | 'approve'
  | 'reject'
  | 'download_file'
  | 'copy_value'
  | 'refresh_card'
  | 'expand'
  | 'collapse'
  | 'submit_form';

export interface CardActionDefinition {
  id: string;
  type: CardActionType;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  icon?: string;
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationMessage?: string;
  permissions?: string[];
  url?: string;
  agentId?: string;
  workflowId?: string;
  apiEndpoint?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payloadTemplate?: Record<string, unknown>;
  targetField?: string;
  successMessage?: string;
  errorMessage?: string;
  disabledWhen?: CardVisibilityCondition;
  visibleWhen?: CardVisibilityCondition;
}

export interface CardComponentStyle {
  padding?: string;
  margin?: string;
  gap?: string;
  background?: string;
  border?: string;
  borderColor?: string;
  borderRadius?: string;
  shadow?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyContent?: 'start' | 'center' | 'end' | 'between' | 'around';
  flexWrap?: 'wrap' | 'nowrap';
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineClamp?: number;
  overflow?: 'visible' | 'hidden' | 'auto';
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export interface CardComponentNode {
  id: string;
  type: CardComponentType;
  name?: string;
  props?: Record<string, unknown>;
  style?: CardComponentStyle;
  visibleWhen?: CardVisibilityCondition;
  actionId?: string;
  locked?: boolean;
  children?: CardComponentNode[];
}

export interface CardStateConfigurations {
  loading?: {
    enabled?: boolean;
    skeletonLines?: number;
  };
  error?: {
    enabled?: boolean;
    messageTemplate?: string;
    allowRetry?: boolean;
  };
  empty?: {
    enabled?: boolean;
    titleTemplate?: string;
    descriptionTemplate?: string;
  };
  expired?: {
    enabled?: boolean;
    messageTemplate?: string;
  };
}

export interface CardThemeOverrides {
  primaryColor?: string;
  borderRadius?: string;
  fontFamily?: string;
}

export interface CardDefinition {
  cardId: string;
  version: number;
  name: string;
  description?: string;
  category: CardCategory;
  icon?: string;
  ownerId?: string;
  ownerName?: string;
  workspaceId?: string;
  visibility: CardVisibility;
  status: CardStatus;
  tags?: string[];
  supportedSurfaces: CardSurface[];
  schema: CardDataSchema;
  rootComponent: CardComponentNode;
  actions?: CardActionDefinition[];
  states?: CardStateConfigurations;
  themeOverrides?: CardThemeOverrides;
  sampleData?: Record<string, unknown>;
  usageCount?: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export interface CardRenderContext {
  surface: CardSurface;
  roomId?: string;
  userId?: string;
  workspaceId?: string;
  messageId?: string;
  permissions?: string[];
  density?: 'compact' | 'comfortable' | 'expanded';
  colorMode?: 'light' | 'dark' | 'system';
  isTestMode?: boolean;
}

/** Matrix Message Payload for universal card events (mie.card / org.onetab.card) */
export interface CardMessageContent {
  type: 'mie.card';
  cardId: string;
  version?: number;
  data: Record<string, unknown>;
  actionResults?: Record<string, unknown>;
  fallbackSummary?: string;
  themeOverrides?: CardThemeOverrides;
}

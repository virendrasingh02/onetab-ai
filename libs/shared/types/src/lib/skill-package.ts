/**
 * Universal Skill Package Specification — Contracts & Runtime Interfaces
 *
 * Defines the standard specification for all dynamically installable, composable,
 * reusable and executable skills across the Mie AI Platform.
 */

export const SKILL_SCHEMA_VERSION = 1;

export const SKILL_CATEGORIES = [
  'social_media',
  'research',
  'writing',
  'marketing',
  'development',
  'data_analysis',
  'automation',
  'customer_support',
  'productivity',
  'multimedia',
  'utility',
  'custom',
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_EXECUTION_TYPES = [
  'prompt',
  'instruction',
  'tool_calling',
  'script',
  'api',
  'mcp',
  'workflow',
  'event_triggered',
  'knowledge_retrieval',
  'data_transformation',
  'composite',
] as const;

export type SkillExecutionType = (typeof SKILL_EXECUTION_TYPES)[number];

export type SkillInputFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'secret';

export interface SkillInputField {
  name: string;
  type: SkillInputFieldType;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface SkillOutputField {
  name: string;
  type: string;
  description: string;
}

export type SkillParamType =
  | 'text'
  | 'secret'
  | 'number'
  | 'boolean'
  | 'select'
  | 'json';

export interface SkillConfigParam {
  key: string;
  label: string;
  type: SkillParamType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  options?: string[];
}

export interface SkillDependency {
  skillId: string;
  minVersion?: string;
  optional?: boolean;
}

export interface SkillPermissionScope {
  scope: string;
  label: string;
  description: string;
  sensitive: boolean;
}

export interface SkillExample {
  title: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  description?: string;
}

export interface SkillAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface SkillLifecycleHooks {
  onInstall?: string;
  onConfigure?: string;
  onExecute?: string;
  onUninstall?: string;
}

export interface SkillCompatibility {
  minPlatformVersion?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  platforms?: string[];
}

/**
 * Universal Skill Package Manifest.
 * Every skill (prompt, SKILL.md, script, connector, composite) conforms to this standard.
 */
export interface SkillPackageManifest {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  version: string;
  author: SkillAuthor;
  category: SkillCategory;
  tags: string[];
  executionType: SkillExecutionType;
  instructions: string;
  entryPoint?: string;
  inputs: Record<string, SkillInputField>;
  outputs: Record<string, SkillOutputField>;
  parameters: Record<string, SkillConfigParam>;
  requiredCapabilities: string[];
  dependencies: SkillDependency[];
  permissions: SkillPermissionScope[];
  supportedModels?: string[];
  templates?: Record<string, string>;
  scripts?: Record<string, string>;
  lifecycleHooks?: SkillLifecycleHooks;
  compatibility?: SkillCompatibility;
  license?: string;
  repository?: string;
  documentation?: string;
  examples?: SkillExample[];
}

export type SkillPackage = SkillPackageManifest;

export type SkillScope = 'GLOBAL' | 'WORKSPACE' | 'PERSONAL' | 'AGENT';

export type SkillInstallStatus =
  | 'ACTIVE'
  | 'DISABLED'
  | 'PENDING_APPROVAL'
  | 'FAILED'
  | 'UNINSTALLED';

export interface SkillInstallation {
  id: string;
  skillId: string;
  workspaceId: string;
  version: string;
  status: SkillInstallStatus;
  scope: SkillScope;
  installedById?: string | null;
  config: Record<string, unknown>;
  approvedPermissions: string[];
  pinnedVersion?: string;
  health: { ok: boolean; message?: string; checkedAt: string };
  createdAt: string;
  updatedAt: string;
}

export interface AgentSkillBinding {
  skillId: string;
  version?: string;
  enabled: boolean;
  priority: number;
  customConfig?: Record<string, unknown>;
}

export interface SkillExecutionContext {
  workspaceId: string;
  actingUserId?: string | null;
  agentId?: string | null;
  skillId: string;
  model?: { provider: string; model: string };
  memory?: Record<string, unknown>;
  secrets?: Record<string, string>;
  grantedPermissions: string[];
  executionId: string;
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface SkillExecutionResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
  toolCalls?: unknown[];
  tokensUsed?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  logs?: string[];
}

export interface SkillImportSource {
  type: 'github' | 'git_url' | 'zip' | 'skill_md' | 'package_json' | 'manifest';
  url?: string;
  content?: string;
  fileBuffer?: Buffer | Uint8Array;
  branch?: string;
}

export interface SkillImportPreview {
  valid: boolean;
  manifest: SkillPackageManifest;
  detectedType: SkillExecutionType;
  requiredCapabilities: string[];
  permissionsRequested: SkillPermissionScope[];
  warnings: string[];
  errors: string[];
}

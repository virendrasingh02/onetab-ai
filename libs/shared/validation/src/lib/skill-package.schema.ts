import { z } from 'zod';
import {
  SKILL_CATEGORIES,
  SKILL_EXECUTION_TYPES,
  SKILL_SCHEMA_VERSION,
  type SkillPackageManifest,
} from '@org/types';

const ID_REGEX = /^[a-z0-9_-]{1,64}$/;
const SEMVER_REGEX = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]+)?$/;

export const skillCategorySchema = z.enum(SKILL_CATEGORIES);

export const skillExecutionTypeSchema = z.enum(SKILL_EXECUTION_TYPES);

export const skillInputFieldSchema = z.object({
  name: z.string().trim().min(1).max(64),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'secret']),
  description: z.string().trim().max(1000).default(''),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
});

export const skillOutputFieldSchema = z.object({
  name: z.string().trim().min(1).max(64),
  type: z.string().trim().min(1).max(64).default('string'),
  description: z.string().trim().max(1000).default(''),
});

export const skillConfigParamSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(128),
  type: z.enum(['text', 'secret', 'number', 'boolean', 'select', 'json']),
  required: z.boolean().default(false),
  description: z.string().trim().max(1000).optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.string()).optional(),
});

export const skillDependencySchema = z.object({
  skillId: z.string().trim().min(1).max(64),
  minVersion: z.string().regex(SEMVER_REGEX, 'Must be valid semver').optional(),
  optional: z.boolean().default(false),
});

export const skillPermissionScopeSchema = z.object({
  scope: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(128),
  description: z.string().trim().max(1000).default(''),
  sensitive: z.boolean().default(false),
});

export const skillAuthorSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

export const skillExampleSchema = z.object({
  title: z.string().trim().min(1).max(128),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const skillPackageManifestSchema = z.object({
  schemaVersion: z.number().int().min(1).max(10).default(SKILL_SCHEMA_VERSION),
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      ID_REGEX,
      'Skill id must be lower-case alphanumeric with dashes or underscores.',
    ),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().min(1).max(4000),
  version: z
    .string()
    .trim()
    .regex(SEMVER_REGEX, 'Version must follow semver (e.g. 1.0.0)')
    .default('1.0.0'),
  author: skillAuthorSchema.default({ name: 'Community' }),
  category: skillCategorySchema.default('utility'),
  tags: z.array(z.string().trim().max(32)).default([]),
  executionType: skillExecutionTypeSchema.default('instruction'),
  instructions: z.string().trim().default(''),
  entryPoint: z.string().trim().max(256).optional(),
  inputs: z.record(z.string(), skillInputFieldSchema).default({}),
  outputs: z.record(z.string(), skillOutputFieldSchema).default({}),
  parameters: z.record(z.string(), skillConfigParamSchema).default({}),
  requiredCapabilities: z.array(z.string().trim().max(128)).default([]),
  dependencies: z.array(skillDependencySchema).default([]),
  permissions: z.array(skillPermissionScopeSchema).default([]),
  supportedModels: z.array(z.string().trim().max(64)).optional(),
  templates: z.record(z.string(), z.string()).default({}),
  scripts: z.record(z.string(), z.string()).default({}),
  lifecycleHooks: z
    .object({
      onInstall: z.string().optional(),
      onConfigure: z.string().optional(),
      onExecute: z.string().optional(),
      onUninstall: z.string().optional(),
    })
    .optional(),
  compatibility: z
    .object({
      minPlatformVersion: z.string().optional(),
      nodeVersion: z.string().optional(),
      pythonVersion: z.string().optional(),
      platforms: z.array(z.string()).optional(),
    })
    .optional(),
  license: z.string().trim().max(64).default('MIT'),
  repository: z.string().trim().max(512).optional(),
  documentation: z.string().optional(),
  examples: z.array(skillExampleSchema).default([]),
});

export const skillExecutionInputSchema = z.object({
  skillId: z.string().trim().min(1).max(64),
  input: z.record(z.string(), z.unknown()).default({}),
  configOverrides: z.record(z.string(), z.unknown()).optional(),
  dryRun: z.boolean().default(false),
  agentId: z.string().optional(),
});

export const skillImportRequestSchema = z.object({
  type: z.enum([
    'github',
    'git_url',
    'zip',
    'skill_md',
    'package_json',
    'manifest',
  ]),
  url: z.string().trim().optional(),
  content: z.string().optional(),
  branch: z.string().trim().default('main'),
  scope: z.enum(['GLOBAL', 'WORKSPACE', 'PERSONAL', 'AGENT']).default('WORKSPACE'),
  autoInstall: z.boolean().default(true),
});

export const skillBuilderDraftSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(ID_REGEX).optional(),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().min(1).max(4000),
  category: skillCategorySchema.default('custom'),
  tags: z.array(z.string().trim().max(32)).default([]),
  executionType: skillExecutionTypeSchema.default('instruction'),
  instructions: z.string().trim().default(''),
  inputs: z.record(z.string(), skillInputFieldSchema).default({}),
  outputs: z.record(z.string(), skillOutputFieldSchema).default({}),
  parameters: z.record(z.string(), skillConfigParamSchema).default({}),
  requiredCapabilities: z.array(z.string().trim().max(128)).default([]),
  permissions: z.array(skillPermissionScopeSchema).default([]),
  templates: z.record(z.string(), z.string()).default({}),
  scripts: z.record(z.string(), z.string()).default({}),
});

export function validateSkillPackage(
  data: unknown,
): { ok: true; manifest: SkillPackageManifest } | { ok: false; errors: string[] } {
  const result = skillPackageManifestSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    };
  }
  return {
    ok: true,
    manifest: result.data as SkillPackageManifest,
  };
}

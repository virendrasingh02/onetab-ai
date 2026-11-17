import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  SkillCategory,
  SkillExecutionType,
  SkillPackage,
} from '@org/types';
import { skillBuilderDraftSchema, validateSkillPackage } from '@org/validation';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillRuntimeService } from './skill-runtime.service.js';

export interface CreateCustomSkillInput {
  id?: string;
  name: string;
  description: string;
  category?: SkillCategory;
  tags?: string[];
  executionType?: SkillExecutionType;
  instructions: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  parameters?: Record<string, any>;
  requiredCapabilities?: string[];
  permissions?: Array<{ scope: string; label: string; description: string; sensitive: boolean }>;
  templates?: Record<string, string>;
  scripts?: Record<string, string>;
}

@Injectable()
export class SkillBuilderService {
  private readonly logger = new Logger(SkillBuilderService.name);

  constructor(
    private readonly registry: SkillRegistryService,
    private readonly runtime: SkillRuntimeService,
  ) {}

  /**
   * Create or update a custom user-built skill.
   */
  async buildAndRegisterSkill(
    input: CreateCustomSkillInput,
    workspaceId: string,
    authorName = 'User',
  ): Promise<SkillPackage> {
    const parseRes = skillBuilderDraftSchema.safeParse(input);
    if (!parseRes.success) {
      throw new BadRequestException(
        `Invalid skill builder draft: ${parseRes.error.issues.map((i) => i.message).join('; ')}`,
      );
    }

    const data = parseRes.data;
    const generatedId =
      data.id ||
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 48);

    const fullPackage: SkillPackage = {
      schemaVersion: 1,
      id: generatedId,
      name: data.name,
      description: data.description,
      version: '1.0.0',
      author: { name: authorName },
      category: data.category as SkillCategory,
      tags: data.tags || [],
      executionType: data.executionType as SkillExecutionType,
      instructions: data.instructions || '',
      inputs: (data.inputs as any) || {
        input: { name: 'input', type: 'string', description: 'Input text', required: true },
      },
      outputs: (data.outputs as any) || {
        result: { name: 'result', type: 'string', description: 'Generated output' },
      },
      parameters: (data.parameters as any) || {},
      requiredCapabilities: data.requiredCapabilities || [],
      dependencies: [],
      permissions: (data.permissions as any) || [
        {
          scope: 'content:generate',
          label: 'Generate output',
          description: 'Generates skill response',
          sensitive: false,
        },
      ],
      templates: data.templates || {},
      scripts: data.scripts || {},
    };

    const validation = validateSkillPackage(fullPackage);
    if (!validation.ok) {
      throw new BadRequestException(
        `Skill validation failed: ${validation.errors.join(', ')}`,
      );
    }

    return this.registry.registerSkill(validation.manifest, 'WORKSPACE', workspaceId);
  }

  /**
   * Interactive playground test execution for the skill builder.
   */
  async testDraftSkill(
    draft: CreateCustomSkillInput,
    testInput: Record<string, unknown>,
    workspaceId: string,
    actingUserId?: string,
  ) {
    const skill = await this.buildAndRegisterSkill(
      {
        ...draft,
        id: draft.id || `test-draft-${Date.now().toString(36)}`,
      },
      workspaceId,
      'Test Runner',
    );

    return this.runtime.executeSkill({
      skillId: skill.id,
      input: testInput,
      workspaceId,
      actingUserId,
      dryRun: true,
    });
  }
}

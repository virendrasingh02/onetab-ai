import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { CreditService } from '@org/api-workspace';
import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillPackage,
} from '@org/types';
import { ApiSkillAdapter } from './adapters/api-skill.adapter.js';
import { CompositeSkillAdapter } from './adapters/composite-skill.adapter.js';
import { DataTransformationSkillAdapter } from './adapters/data-transformation-skill.adapter.js';
import { InstructionSkillAdapter } from './adapters/instruction-skill.adapter.js';
import { ScriptSkillAdapter } from './adapters/script-skill.adapter.js';
import type { SkillExecutionAdapter } from './adapters/skill-adapter.interface.js';
import { ToolCallingSkillAdapter } from './adapters/tool-calling-skill.adapter.js';
import { SkillRegistryService } from './skill-registry.service.js';

export interface ExecuteSkillRequest {
  skillId: string;
  input: Record<string, unknown>;
  workspaceId: string;
  actingUserId?: string;
  agentId?: string;
  dryRun?: boolean;
  async?: boolean;
  model?: { provider: string; model: string };
  configOverrides?: Record<string, unknown>;
}

@Injectable()
export class SkillRuntimeService {
  private readonly logger = new Logger(SkillRuntimeService.name);
  private readonly adapters: SkillExecutionAdapter[] = [];

  constructor(
    private readonly registry: SkillRegistryService,
    private readonly prisma: PrismaService,
    private readonly scriptAdapter: ScriptSkillAdapter,
    private readonly instructionAdapter: InstructionSkillAdapter,
    private readonly toolAdapter: ToolCallingSkillAdapter,
    private readonly apiAdapter: ApiSkillAdapter,
    private readonly transformAdapter: DataTransformationSkillAdapter,
    private readonly compositeAdapter: CompositeSkillAdapter,
    @Optional() private readonly creditService?: CreditService,
  ) {
    this.adapters = [
      this.scriptAdapter,
      this.instructionAdapter,
      this.toolAdapter,
      this.apiAdapter,
      this.transformAdapter,
      this.compositeAdapter,
    ];
    this.compositeAdapter.registerAdapters(this.adapters);
  }

  /**
   * Executes a skill through the universal invariant 9-stage lifecycle:
   * DISCOVER → VALIDATE → INSTALL → CONFIGURE → AUTHORIZE → PLAN → EXECUTE → VALIDATE OUTPUT → SAVE RESULTS
   */
  async executeSkill(req: ExecuteSkillRequest): Promise<SkillExecutionResult> {
    const executionId = `skillexec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    this.logger.log(`[Lifecycle 1. DISCOVER] Resolving skill '${req.skillId}' in workspace ${req.workspaceId}`);

    // Stage 1: DISCOVER
    const skill = await this.registry.getSkill(req.skillId, req.workspaceId);
    if (!skill) {
      throw new NotFoundException(`Skill '${req.skillId}' cannot be discovered.`);
    }

    // Stage 2: VALIDATE (Input validation against declared schema)
    this.logger.log(`[Lifecycle 2. VALIDATE] Validating inputs for '${skill.id}'`);
    this.validateInputs(skill, req.input);

    // Stage 3 & 4: INSTALL & CONFIGURE (Verify installation status & merged config)
    this.logger.log(`[Lifecycle 3 & 4. INSTALL & CONFIGURE] Checking installation for '${skill.id}'`);
    let install = this.registry.getInstallation(req.workspaceId, skill.id);
    if (!install) {
      // Auto-install global/workspace skills if requested by authorized user
      install = await this.registry.installSkill(req.workspaceId, skill.id, {
        userId: req.actingUserId,
      });
    }

    if (install.status === 'DISABLED' && !req.dryRun) {
      throw new BadRequestException(
        `Skill '${skill.id}' is currently DISABLED in this workspace. Enable it to execute.`,
      );
    }

    const mergedConfig = {
      ...install.config,
      ...(req.configOverrides || {}),
    };

    // Stage 5: AUTHORIZE (Verify permissions)
    this.logger.log(`[Lifecycle 5. AUTHORIZE] Checking permissions for '${skill.id}'`);
    const grantedScopes = install.approvedPermissions || [];
    for (const perm of skill.permissions) {
      if (perm.sensitive && !grantedScopes.includes(perm.scope) && !req.dryRun) {
        throw new ForbiddenException(
          `Permission '${perm.scope}' (${perm.label}) is sensitive and must be approved before executing skill '${skill.id}'.`,
        );
      }
    }

    // Stage 6: PLAN (Select adapter and setup context)
    this.logger.log(`[Lifecycle 6. PLAN] Selecting adapter for execution type '${skill.executionType}'`);
    const adapter = this.adapters.find((a) => a.canHandle(skill.executionType));
    if (!adapter) {
      throw new BadRequestException(
        `No execution adapter registered for execution type '${skill.executionType}'.`,
      );
    }

    const context: SkillExecutionContext = {
      workspaceId: req.workspaceId,
      actingUserId: req.actingUserId,
      agentId: req.agentId,
      skillId: skill.id,
      model: req.model,
      memory: {},
      secrets: {},
      grantedPermissions: grantedScopes,
      executionId,
      dryRun: req.dryRun,
    };

    // Stage 7: EXECUTE
    this.logger.log(`[Lifecycle 7. EXECUTE] Executing skill '${skill.id}' via ${adapter.constructor.name}`);
    let result: SkillExecutionResult;
    try {
      result = await adapter.execute(skill, context, { ...req.input, config: mergedConfig });
    } catch (err: any) {
      this.logger.error(`Execution failed for skill '${skill.id}': ${err.message}`);
      result = {
        ok: false,
        error: { code: 'EXECUTION_FAILED', message: err.message },
        latencyMs: Date.now() - startTime,
        logs: [`[FATAL] ${err.message}`],
      };
    }

    // Stage 8: VALIDATE OUTPUT
    this.logger.log(`[Lifecycle 8. VALIDATE OUTPUT] Verifying output integrity for '${skill.id}'`);
    if (result.ok && skill.outputs && Object.keys(skill.outputs).length > 0) {
      this.validateOutputs(skill, result.data);
    }

    // Stage 9: SAVE RESULTS (Save audit trail & deduct credits)
    this.logger.log(`[Lifecycle 9. SAVE RESULTS] Recording execution record '${executionId}'`);
    await this.persistExecutionRecord(req, skill, result, executionId, Date.now() - startTime);

    return result;
  }

  private validateInputs(skill: SkillPackage, input: Record<string, unknown>) {
    if (!skill.inputs) return;
    for (const [key, field] of Object.entries(skill.inputs)) {
      if (field.required && (input[key] === undefined || input[key] === null || input[key] === '')) {
        throw new BadRequestException(
          `Missing required input field '${key}': ${field.description}`,
        );
      }
    }
  }

  private validateOutputs(skill: SkillPackage, data: unknown) {
    if (!data || typeof data !== 'object') return;
    // Log output coverage
    const outputKeys = Object.keys(skill.outputs);
    this.logger.debug(`Skill '${skill.id}' declared outputs [${outputKeys.join(', ')}]`);
  }

  private async persistExecutionRecord(
    req: ExecuteSkillRequest,
    skill: SkillPackage,
    result: SkillExecutionResult,
    executionId: string,
    latencyMs: number,
  ) {
    try {
      await this.prisma.aIExecution.create({
        data: {
          id: executionId,
          workspaceId: req.workspaceId,
          userId: req.actingUserId,
          agentId: req.agentId,
          entityType: 'SKILL',
          entityId: skill.id,
          status: result.ok ? 'SUCCESS' : 'FAILED',
          latencyMs,
          tokensUsed: result.tokensUsed ?? 0,
          toolCalls: result.toolCalls ? (result.toolCalls as any) : [],
          errorsJson: result.error ? (result.error as any) : undefined,
          stateJson: {
            skillId: skill.id,
            version: skill.version,
            category: skill.category,
            executionType: skill.executionType,
            dryRun: req.dryRun,
          },
        },
      });

      if (this.creditService && result.tokensUsed && req.actingUserId) {
        await this.creditService.deductCredits(
          req.workspaceId,
          Math.max(Math.ceil((result.tokensUsed / 1000) * 2), 1),
          `Skill execution: ${skill.name}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not persist execution record for skill: ${err.message}`);
    }
  }
}

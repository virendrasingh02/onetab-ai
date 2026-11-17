import { Injectable, Logger } from '@nestjs/common';
import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillExecutionType,
  SkillPackage,
} from '@org/types';
import type { SkillExecutionAdapter } from './skill-adapter.interface.js';

@Injectable()
export class CompositeSkillAdapter implements SkillExecutionAdapter {
  private readonly logger = new Logger(CompositeSkillAdapter.name);
  private adapters: SkillExecutionAdapter[] = [];

  registerAdapters(adapters: SkillExecutionAdapter[]) {
    this.adapters = adapters;
  }

  canHandle(type: SkillExecutionType): boolean {
    return type === 'composite' || type === 'workflow';
  }

  async execute(
    skill: SkillPackage,
    context: SkillExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const steps = (input['steps'] as Array<{
      id: string;
      skillId: string;
      type: SkillExecutionType;
      input: Record<string, unknown>;
    }>) || [];

    const stepResults: Record<string, unknown> = {};
    const executionLogs: string[] = [`Starting composite workflow '${skill.name}'`];
    let totalTokens = 0;

    if (steps.length === 0) {
      // Single composite with dependencies
      executionLogs.push(`Composite skill has ${skill.dependencies.length} dependencies.`);
      return {
        ok: true,
        data: {
          composite: true,
          skillId: skill.id,
          dependencies: skill.dependencies,
          finalOutput: `Composite pipeline '${skill.name}' completed with input: ${JSON.stringify(input)}`,
        },
        latencyMs: Date.now() - startTime,
        logs: executionLogs,
      };
    }

    for (const step of steps) {
      executionLogs.push(`Executing pipeline step '${step.id}' (skill: ${step.skillId})`);

      // Variable substitution from previous steps: e.g. {{steps.research.output}}
      const resolvedInput: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(step.input || {})) {
        if (typeof v === 'string' && v.startsWith('{{steps.') && v.endsWith('}}')) {
          const path = v.slice(8, -2).split('.');
          const stepId = path[0];
          const field = path[1] || 'output';
          const prev = (stepResults[stepId] as Record<string, unknown>)?.[field];
          resolvedInput[k] = prev ?? v;
        } else {
          resolvedInput[k] = v;
        }
      }

      const adapter = this.adapters.find((a) => a.canHandle(step.type));
      if (!adapter) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_NOT_FOUND',
            message: `No adapter found for pipeline step '${step.id}' with type '${step.type}'`,
          },
          latencyMs: Date.now() - startTime,
          logs: executionLogs,
        };
      }

      const subPackage: SkillPackage = {
        ...skill,
        id: step.skillId,
        executionType: step.type,
      };

      const result = await adapter.execute(subPackage, context, resolvedInput);
      if (!result.ok) {
        executionLogs.push(`[FAILED] Step '${step.id}' failed: ${result.error?.message}`);
        return {
          ok: false,
          error: {
            code: 'STEP_EXECUTION_FAILED',
            message: `Pipeline step '${step.id}' failed: ${result.error?.message}`,
          },
          latencyMs: Date.now() - startTime,
          logs: executionLogs,
        };
      }

      stepResults[step.id] = result.data;
      if (result.tokensUsed) totalTokens += result.tokensUsed;
      if (result.logs) executionLogs.push(...result.logs);
    }

    return {
      ok: true,
      data: {
        steps: stepResults,
        finalOutput: stepResults[steps[steps.length - 1].id],
      },
      tokensUsed: totalTokens,
      latencyMs: Date.now() - startTime,
      logs: executionLogs,
    };
  }
}

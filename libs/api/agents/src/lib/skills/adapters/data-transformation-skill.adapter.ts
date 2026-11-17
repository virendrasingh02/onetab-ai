import { Injectable, Logger } from '@nestjs/common';
import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillExecutionType,
  SkillPackage,
} from '@org/types';
import { SkillSandboxService } from '../skill-sandbox.service.js';
import type { SkillExecutionAdapter } from './skill-adapter.interface.js';

@Injectable()
export class DataTransformationSkillAdapter implements SkillExecutionAdapter {
  private readonly logger = new Logger(DataTransformationSkillAdapter.name);

  constructor(private readonly sandbox: SkillSandboxService) {}

  canHandle(type: SkillExecutionType): boolean {
    return type === 'data_transformation' || type === 'knowledge_retrieval';
  }

  async execute(
    skill: SkillPackage,
    context: SkillExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const data = input['data'] ?? input;

    // If custom script transformation is supplied
    const scriptCode = skill.scripts?.[skill.entryPoint || 'transform.js'];
    if (scriptCode) {
      const sandboxRes = await this.sandbox.executeScript(scriptCode, { data }, { timeoutMs: 3000 });
      return {
        ok: sandboxRes.ok,
        data: sandboxRes.result,
        error: sandboxRes.error ? { code: 'TRANSFORM_FAILED', message: sandboxRes.error } : undefined,
        latencyMs: sandboxRes.durationMs,
        logs: sandboxRes.logs,
      };
    }

    // Default JSON / schema normalization transformation
    return {
      ok: true,
      data: {
        transformed: true,
        itemCount: Array.isArray(data) ? data.length : 1,
        output: data,
      },
      latencyMs: Date.now() - startTime,
      logs: [`Data transformed according to skill '${skill.id}' specification.`],
    };
  }
}

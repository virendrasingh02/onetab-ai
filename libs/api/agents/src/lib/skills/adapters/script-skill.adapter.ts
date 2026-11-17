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
export class ScriptSkillAdapter implements SkillExecutionAdapter {
  private readonly logger = new Logger(ScriptSkillAdapter.name);

  constructor(private readonly sandbox: SkillSandboxService) {}

  canHandle(type: SkillExecutionType): boolean {
    return type === 'script';
  }

  async execute(
    skill: SkillPackage,
    context: SkillExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    // Check if skill has hook score evaluation logic
    if (skill.id.includes('hook') || skill.id.includes('score')) {
      const hookText =
        String(input['hookText'] || input['text'] || input['hook'] || '');
      const platform = skill.id.startsWith('li-')
        ? 'linkedin'
        : skill.id.startsWith('ig-')
          ? 'instagram'
          : 'youtube';

      const voiceNotes = skill.templates?.['voice.md'];
      const scoreResult = this.sandbox.evaluateHookScore(hookText, platform, {
        voiceNotes,
      });

      return {
        ok: true,
        data: scoreResult,
        latencyMs: Date.now() - startTime,
        metadata: {
          platform,
          score: scoreResult.score,
          passesThreshold: scoreResult.passesThreshold,
        },
        logs: [
          `Hook evaluated for ${platform}: score ${scoreResult.score}/100`,
          ...scoreResult.feedback.map((f) => `[FEEDBACK] ${f}`),
        ],
      };
    }

    // Custom script in package
    const entryPoint = skill.entryPoint || Object.keys(skill.scripts || {})[0];
    const scriptCode = entryPoint ? skill.scripts?.[entryPoint] : '';

    if (!scriptCode) {
      return {
        ok: false,
        error: {
          code: 'SCRIPT_NOT_FOUND',
          message: `Skill '${skill.id}' declares script execution type but has no executable script defined.`,
        },
        latencyMs: Date.now() - startTime,
      };
    }

    const sandboxResult = await this.sandbox.executeScript(scriptCode, input, {
      timeoutMs: 5000,
    });

    return {
      ok: sandboxResult.ok,
      data: sandboxResult.result,
      error: sandboxResult.error
        ? { code: 'SANDBOX_ERROR', message: sandboxResult.error }
        : undefined,
      latencyMs: sandboxResult.durationMs,
      logs: sandboxResult.logs,
    };
  }
}

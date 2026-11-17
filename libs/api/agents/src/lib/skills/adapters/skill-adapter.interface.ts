import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillExecutionType,
  SkillPackage,
} from '@org/types';

export interface SkillExecutionAdapter {
  canHandle(type: SkillExecutionType): boolean;
  execute(
    skill: SkillPackage,
    context: SkillExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SkillExecutionResult>;
}

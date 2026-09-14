import { Injectable } from '@nestjs/common';
import { AIRuntimeService, type AIEntityTurnContext } from '@org/api-agents';
import type { AgentToolExecution, CoworkerRunResult } from '@org/types';

export type CoworkerTurnContext = AIEntityTurnContext;

/**
 * Backward-compatible facade for Coworker turn execution.
 *
 * Delegates directly to the unified `AIRuntimeService`.
 */
@Injectable()
export class CoworkerRuntimeService {
  constructor(private readonly runtime: AIRuntimeService) {}

  async executeTurn(
    workspaceId: string,
    coworkerId: string,
    promptText: string,
    context: CoworkerTurnContext = {},
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
  ): Promise<CoworkerRunResult & { tools: AgentToolExecution[] }> {
    const res = await this.runtime.executeTurn(
      workspaceId,
      coworkerId,
      promptText,
      context,
      onToolUpdate,
    );
    return {
      coworkerName: res.entityName,
      result: res.result,
      logId: res.logId,
      tools: res.tools,
    };
  }
}

import { Injectable, Logger, Optional } from '@nestjs/common';
import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillExecutionType,
  SkillPackage,
} from '@org/types';
import { MCPToolRegistryService } from '../../mcp-tool-registry.service.js';
import type { SkillExecutionAdapter } from './skill-adapter.interface.js';

@Injectable()
export class ToolCallingSkillAdapter implements SkillExecutionAdapter {
  private readonly logger = new Logger(ToolCallingSkillAdapter.name);

  constructor(@Optional() private readonly mcpRegistry?: MCPToolRegistryService) {}

  canHandle(type: SkillExecutionType): boolean {
    return type === 'tool_calling' || type === 'mcp';
  }

  async execute(
    skill: SkillPackage,
    context: SkillExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const toolCalls: unknown[] = [];
    const logs: string[] = [];

    const capabilities = skill.requiredCapabilities || [];
    if (capabilities.length === 0) {
      return {
        ok: true,
        data: { message: 'No tools required for this skill.', input },
        latencyMs: Date.now() - startTime,
      };
    }

    if (!this.mcpRegistry) {
      return {
        ok: false,
        error: {
          code: 'TOOL_REGISTRY_UNAVAILABLE',
          message: 'MCP Tool Registry service is not available in the current context.',
        },
        latencyMs: Date.now() - startTime,
      };
    }

    // Determine target tool name
    const toolName = (input['toolName'] as string) || capabilities[0];
    const toolParams = (input['parameters'] as Record<string, unknown>) || input;

    try {
      logs.push(`Executing tool '${toolName}' requested by skill '${skill.id}'`);
      const result = await this.mcpRegistry.executeTool(toolName, toolParams, {
        workspaceId: context.workspaceId,
        actingUserId: context.actingUserId ?? null,
        agentId: context.agentId,
      });

      toolCalls.push({
        tool: toolName,
        params: toolParams,
        result,
      });

      return {
        ok: true,
        data: result,
        toolCalls,
        logs,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: {
          code: 'TOOL_EXECUTION_FAILED',
          message: err.message || `Failed executing tool '${toolName}'`,
        },
        toolCalls,
        logs: [...logs, `[ERROR] ${err.message}`],
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

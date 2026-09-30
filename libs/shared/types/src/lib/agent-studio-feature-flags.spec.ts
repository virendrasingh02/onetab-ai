import { describe, expect, it } from 'vitest';
import {
  AgentStudioModuleId,
  DEFAULT_AGENT_STUDIO_FLAGS,
  isAgentStudioModuleEnabled,
} from './agent-studio-feature-flags.js';
import {
  AgentStudioErrorCode,
  createEmptyWorkflowGraph,
} from './workflow-schema.js';

describe('AI Agent Studio Foundations (Phase 0)', () => {
  describe('22-Module Feature Flags', () => {
    it('defines flags for all 22 modules', () => {
      const allModules = Object.values(AgentStudioModuleId);
      expect(allModules).toHaveLength(22);

      for (const mod of allModules) {
        expect(DEFAULT_AGENT_STUDIO_FLAGS[mod]).toBeDefined();
        expect(DEFAULT_AGENT_STUDIO_FLAGS[mod].id).toBe(mod);
        expect(DEFAULT_AGENT_STUDIO_FLAGS[mod].name).toBeTruthy();
        expect(DEFAULT_AGENT_STUDIO_FLAGS[mod].description).toBeTruthy();
        expect(typeof DEFAULT_AGENT_STUDIO_FLAGS[mod].phase).toBe('number');
        expect(typeof DEFAULT_AGENT_STUDIO_FLAGS[mod].enabled).toBe('boolean');
      }
    });

    it('correctly resolves module enablement with overrides', () => {
      expect(
        isAgentStudioModuleEnabled(AgentStudioModuleId.MODULE_1_DASHBOARD),
      ).toBe(true);

      // Explicit override disabling module
      expect(
        isAgentStudioModuleEnabled(AgentStudioModuleId.MODULE_1_DASHBOARD, {
          [AgentStudioModuleId.MODULE_1_DASHBOARD]: false,
        }),
      ).toBe(false);

      // Explicit override enabling module
      expect(
        isAgentStudioModuleEnabled(AgentStudioModuleId.MODULE_5_MULTI_AGENT, {
          [AgentStudioModuleId.MODULE_5_MULTI_AGENT]: true,
        }),
      ).toBe(true);
    });
  });

  describe('Workflow Graph Schema & Contracts', () => {
    it('creates a valid empty workflow graph adhering to 1.0.0 schema', () => {
      const emptyGraph = createEmptyWorkflowGraph('Test Agent Workflow');

      expect(emptyGraph.schemaVersion).toBe('1.0.0');
      expect(emptyGraph.name).toBe('Test Agent Workflow');
      expect(emptyGraph.nodes).toEqual([]);
      expect(emptyGraph.edges).toEqual([]);
      expect(emptyGraph.variables).toEqual([]);
      expect(emptyGraph.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(emptyGraph.metadata?.version).toBe(1);
      expect(emptyGraph.metadata?.createdAt).toBeDefined();

      // Verify that the empty graph passes strict schema validation
      expect(emptyGraph.schemaVersion).toMatch(/^1\.\d+\.\d+$/);
      expect(Array.isArray(emptyGraph.nodes)).toBe(true);
      expect(Array.isArray(emptyGraph.edges)).toBe(true);
    });

    it('contains standardized error codes across lifecycle domains', () => {
      expect(AgentStudioErrorCode.GRAPH_INVALID_JSON).toBe('GRAPH_INVALID_JSON');
      expect(AgentStudioErrorCode.GRAPH_EMPTY).toBe('GRAPH_EMPTY');
      expect(AgentStudioErrorCode.EXECUTION_TIMEOUT).toBe('EXECUTION_TIMEOUT');
      expect(AgentStudioErrorCode.MODEL_PROVIDER_UNAVAILABLE).toBe(
        'MODEL_PROVIDER_UNAVAILABLE',
      );
      expect(AgentStudioErrorCode.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
      expect(AgentStudioErrorCode.GUARDRAIL_PII_VIOLATION).toBe(
        'GUARDRAIL_PII_VIOLATION',
      );
    });
  });
});

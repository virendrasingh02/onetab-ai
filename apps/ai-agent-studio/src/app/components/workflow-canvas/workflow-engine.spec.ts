import type { Connection, Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  getAllRegistryNodes,
  getNodeDefinition,
} from './node-registry.js';
import {
  validateWorkflowConnection,
} from './connection-validator.js';

const makeNode = (id: string, type: string, label?: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: label || id },
});

describe('AI Agent Studio Workflow Engine', () => {
  describe('AgentNodeRegistry (Section 3 & 4)', () => {
    it('registers all required core categories', () => {
      const nodes = getAllRegistryNodes();
      expect(nodes.length).toBeGreaterThanOrEqual(20);

      const categories = new Set(nodes.map((n) => n.category));
      expect(categories.has('triggers')).toBe(true);
      expect(categories.has('ai')).toBe(true);
      expect(categories.has('knowledge')).toBe(true);
      expect(categories.has('logic')).toBe(true);
      expect(categories.has('transform')).toBe(true);
      expect(categories.has('tools')).toBe(true);
      expect(categories.has('connectors')).toBe(true);
      expect(categories.has('human')).toBe(true);
      expect(categories.has('output')).toBe(true);
    });

    it('exposes rich metadata with handles, configSchema, and runtime targets', () => {
      const llmNode = getNodeDefinition('LLM');
      expect(llmNode).toBeDefined();
      expect(llmNode?.label).toContain('LLM');
      expect(llmNode?.inputs.length).toBeGreaterThanOrEqual(1);
      expect(llmNode?.outputs.length).toBeGreaterThanOrEqual(1);
      expect(llmNode?.runtime).toBe('model');

      const conditionNode = getNodeDefinition('CONDITION');
      expect(conditionNode).toBeDefined();
      expect(conditionNode?.outputs.some((o) => o.id === 'true')).toBe(true);
      expect(conditionNode?.outputs.some((o) => o.id === 'false')).toBe(true);
    });

    it('resolves node definitions and aliases accurately', () => {
      expect(getNodeDefinition('AGENT')).toBeDefined();
      expect(getNodeDefinition('AI_AGENT')?.type).toBe('AGENT');
      expect(getNodeDefinition('SLACK')?.category).toBe('connectors');
      expect(getNodeDefinition('FIRECRAWL')?.category).toBe('tools');
      expect(getNodeDefinition('HUMAN_APPROVAL')?.category).toBe('human');
    });
  });

  describe('Type-Safe Connection Engine (Section 7)', () => {
    const nodes: Node[] = [
      makeNode('start', 'START'),
      makeNode('agent', 'AGENT'),
      makeNode('prompt', 'PROMPT_TEMPLATE'),
      makeNode('llm', 'AI_CHAT_MODEL'),
      makeNode('tool', 'HTTP_REQUEST'),
      makeNode('cond', 'CONDITION'),
      makeNode('end', 'END'),
    ];

    it('validates forward workflow flow connections', () => {
      const edges: Edge[] = [];
      const conn: Connection = {
        source: 'start',
        target: 'agent',
        sourceHandle: null,
        targetHandle: null,
      };
      const result = validateWorkflowConnection(conn, nodes, edges);
      expect(result.valid).toBe(true);
    });

    it('rejects self-connections', () => {
      const edges: Edge[] = [];
      const conn: Connection = {
        source: 'agent',
        target: 'agent',
        sourceHandle: null,
        targetHandle: null,
      };
      const result = validateWorkflowConnection(conn, nodes, edges);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('itself');
    });

    it('rejects duplicate connections between identical handles', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'start', target: 'agent', sourceHandle: null, targetHandle: null },
      ];
      const conn: Connection = {
        source: 'start',
        target: 'agent',
        sourceHandle: null,
        targetHandle: null,
      };
      const result = validateWorkflowConnection(conn, nodes, edges);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already connected');
    });

    it('enforces agent slot compatibility via connection validator', () => {
      const edges: Edge[] = [];
      // Compatible prompt slot
      const validSlot: Connection = {
        source: 'agent',
        sourceHandle: 'prompt',
        target: 'prompt',
        targetHandle: null,
      };
      expect(validateWorkflowConnection(validSlot, nodes, edges).valid).toBe(true);

      // Incompatible prompt slot (trying to plug LLM into Prompt slot)
      const invalidSlot: Connection = {
        source: 'agent',
        sourceHandle: 'prompt',
        target: 'llm',
        targetHandle: null,
      };
      const res = validateWorkflowConnection(invalidSlot, nodes, edges);
      expect(res.valid).toBe(false);
    });

    it('rejects cycle creation while allowing branches', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'start', target: 'agent' },
        { id: 'e2', source: 'agent', target: 'cond' },
        { id: 'e3', source: 'cond', target: 'tool' },
      ];

      // Trying to connect 'tool' back to 'agent' creates a cycle
      const cycleConn: Connection = {
        source: 'tool',
        target: 'agent',
        sourceHandle: null,
        targetHandle: null,
      };
      const result = validateWorkflowConnection(cycleConn, nodes, edges);
      expect(result.valid).toBe(false);
      expect(result.reason?.toLowerCase()).toContain('loop');
    });
  });
});

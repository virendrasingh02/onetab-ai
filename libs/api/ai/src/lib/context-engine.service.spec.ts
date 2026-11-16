import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ContextEngineService } from './context-engine.service.js';
import type { KnowledgeGraphService } from './knowledge-graph.service.js';
import type { PrismaService } from '@org/database';

describe('ContextEngineService', () => {
  let contextEngine: ContextEngineService;
  let mockPrisma: any;
  let mockGraphService: any;
  let mockKnowledgeService: any;

  const mockNode = {
    id: 'node-auth',
    workspaceId: 'ws-1',
    entityType: 'FUNCTION',
    name: 'authenticateUser',
    identifier: 'src/auth/auth.ts#authenticateUser',
    description: 'Validates user credentials and issues JWT token',
    confidence: 1.0,
    sourceType: 'CODE',
    provenance: 'LOCAL_AST_PARSER',
    properties: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubgraph = {
    nodes: [mockNode],
    edges: [],
    totalNodes: 1,
    totalEdges: 0,
    centerNodeId: 'node-auth',
  };

  beforeEach(() => {
    mockPrisma = {
      knowledgeGraphNode: {
        findMany: vi.fn().mockResolvedValue([mockNode]),
      },
      workDocument: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      task: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockGraphService = {
      findEntity: vi.fn().mockImplementation((_ws, query) => {
        if (query.toLowerCase().includes('authenticateuser')) return Promise.resolve(mockNode);
        return Promise.resolve(null);
      }),
      queryGraph: vi.fn().mockResolvedValue(mockSubgraph),
      traverseGraph: vi.fn().mockResolvedValue(mockSubgraph),
    };

    mockKnowledgeService = {
      search: vi.fn().mockResolvedValue({
        chunks: [],
      }),
    };

    contextEngine = new ContextEngineService(
      mockPrisma as unknown as PrismaService,
      mockGraphService as unknown as KnowledgeGraphService,
      mockKnowledgeService,
    );
  });

  describe('Context Assembly Pipeline', () => {
    it('detects intent, resolves entities, and returns formatted compressed context', async () => {
      const result = await contextEngine.buildContext('ws-1', {
        query: 'How does authenticateUser validate credentials?',
        maxTokens: 1000,
      });

      expect(result.grounded).toBe(true);
      expect(result.entitiesResolved.length).toBeGreaterThan(0);
      expect(result.entitiesResolved[0].name).toBe('authenticateUser');
      expect(result.promptContext).toContain('authenticateUser');
      expect(result.tokensUsed).toBeLessThanOrEqual(1000);
      expect(result.tokensSavedEstimate).toBeGreaterThan(0);
      expect(result.retrievalLatencyMs).toBeDefined();
    });

    it('strictly enforces token budget limits', async () => {
      const lowTokenBudget = 50;
      const result = await contextEngine.buildContext('ws-1', {
        query: 'authenticateUser details',
        maxTokens: lowTokenBudget,
      });

      expect(result.tokensUsed).toBeLessThanOrEqual(lowTokenBudget + 10);
    });

    it('falls back gracefully to native docs and tasks when graph hits are empty', async () => {
      mockPrisma.knowledgeGraphNode.findMany.mockResolvedValue([]);
      mockGraphService.findEntity.mockResolvedValue(null);
      mockGraphService.queryGraph.mockResolvedValue({
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0,
      });
      mockGraphService.traverseGraph.mockResolvedValue({
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0,
      });

      mockPrisma.workDocument.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          title: 'Authentication Guide',
          content: { summary: 'JWT authentication overview' },
          updatedAt: new Date(),
        },
      ]);

      const result = await contextEngine.buildContext('ws-1', {
        query: 'Authentication Guide',
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.promptContext).toContain('Authentication Guide');
    });
  });
});

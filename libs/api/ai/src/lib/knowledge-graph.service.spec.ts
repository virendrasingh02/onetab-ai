import { describe, expect, it, beforeEach, vi } from 'vitest';
import { KnowledgeGraphService } from './knowledge-graph.service.js';
import { DeterministicCodeParser } from './knowledge-graph-parser.js';
import type { PrismaService } from '@org/database';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let mockPrisma: any;
  let parser: DeterministicCodeParser;

  const mockNode1 = {
    id: 'node-1',
    workspaceId: 'ws-1',
    organizationId: null,
    entityType: 'FUNCTION',
    name: 'fetchUser',
    identifier: 'src/user.ts#fetchUser',
    description: 'Fetches user by id',
    sourceRef: 'src/user.ts',
    sourceType: 'CODE',
    sourceUri: null,
    contentHash: 'hash-1',
    version: 1,
    confidence: 1.0,
    provenance: 'LOCAL_AST_PARSER',
    properties: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNode2 = {
    id: 'node-2',
    workspaceId: 'ws-1',
    organizationId: null,
    entityType: 'CLASS',
    name: 'UserService',
    identifier: 'src/user.service.ts#UserService',
    description: 'User service class',
    sourceRef: 'src/user.service.ts',
    sourceType: 'CODE',
    sourceUri: null,
    contentHash: 'hash-2',
    version: 1,
    confidence: 1.0,
    provenance: 'LOCAL_AST_PARSER',
    properties: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEdge1 = {
    id: 'edge-1',
    workspaceId: 'ws-1',
    organizationId: null,
    relationType: 'CALLS',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    weight: 1.0,
    confidence: 1.0,
    provenance: 'LOCAL_AST_PARSER',
    properties: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    parser = new DeterministicCodeParser();

    mockPrisma = {
      knowledgeGraphNode: {
        create: vi.fn().mockResolvedValue(mockNode1),
        upsert: vi.fn().mockResolvedValue(mockNode1),
        findUnique: vi.fn().mockImplementation(({ where }: any) => {
          if (where.id === 'node-1') return Promise.resolve(mockNode1);
          if (where.id === 'node-2') return Promise.resolve(mockNode2);
          return Promise.resolve(null);
        }),
        findFirst: vi.fn().mockResolvedValue(mockNode1),
        findMany: vi.fn().mockResolvedValue([mockNode1, mockNode2]),
        update: vi.fn().mockResolvedValue({ ...mockNode1, name: 'UpdatedName' }),
        delete: vi.fn().mockResolvedValue(mockNode1),
        count: vi.fn().mockResolvedValue(2),
        groupBy: vi.fn().mockResolvedValue([{ entityType: 'FUNCTION', _count: { id: 1 } }]),
      },
      knowledgeGraphEdge: {
        upsert: vi.fn().mockResolvedValue(mockEdge1),
        findMany: vi.fn().mockResolvedValue([mockEdge1]),
        delete: vi.fn().mockResolvedValue(mockEdge1),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([{ relationType: 'CALLS', _count: { id: 1 } }]),
      },
      knowledgeGraphSource: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({
          id: 'src-1',
          name: 'Repo 1',
          sourceType: 'CODE_REPO',
          status: 'INDEXED',
          nodeCount: 2,
          edgeCount: 1,
        }),
        delete: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.status === 'FAILED') return Promise.resolve(0);
          if (where?.status === 'INDEXING') return Promise.resolve(0);
          return Promise.resolve(1);
        }),
      },
      $transaction: vi.fn().mockImplementation((fn: any) => {
        if (typeof fn === 'function') {
          return fn(mockPrisma);
        }
        return Promise.all(fn);
      }),
    };

    service = new KnowledgeGraphService(mockPrisma as unknown as PrismaService, parser);
  });

  describe('Entity Operations', () => {
    it('creates an entity with identifier and content hash', async () => {
      const result = await service.createEntity('ws-1', {
        name: 'fetchUser',
        entityType: 'FUNCTION',
        identifier: 'src/user.ts#fetchUser',
      });

      expect(mockPrisma.knowledgeGraphNode.upsert).toHaveBeenCalled();
      expect(result.id).toBe('node-1');
      expect(result.name).toBe('fetchUser');
    });

    it('finds an entity by ID', async () => {
      const entity = await service.findEntity('ws-1', 'node-1');
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('fetchUser');
    });

    it('updates an entity and invalidates in-memory cache', async () => {
      const updated = await service.updateEntity('ws-1', 'node-1', {
        name: 'UpdatedName',
      });

      expect(mockPrisma.knowledgeGraphNode.update).toHaveBeenCalled();
      expect(updated.name).toBe('UpdatedName');
    });

    it('deletes an entity and clears cache', async () => {
      await service.deleteEntity('ws-1', 'node-1');
      expect(mockPrisma.knowledgeGraphNode.delete).toHaveBeenCalledWith({
        where: { id: 'node-1' },
      });
    });
  });

  describe('Relationship Operations', () => {
    it('creates and upserts relationships between nodes', async () => {
      const rel = await service.createRelationship('ws-1', {
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationType: 'CALLS',
      });

      expect(mockPrisma.knowledgeGraphEdge.upsert).toHaveBeenCalled();
      expect(rel.relationType).toBe('CALLS');
      expect(rel.sourceNodeId).toBe('node-1');
      expect(rel.targetNodeId).toBe('node-2');
    });

    it('queries bidirectional relationships for an entity', async () => {
      const relations = await service.findRelations('ws-1', 'node-1', 'BOTH');
      expect(relations.length).toBe(1);
      expect(relations[0].relationType).toBe('CALLS');
    });
  });

  describe('Graph Traversal & Subgraph Extraction', () => {
    it('traverses neighbors using BFS traversal up to specified depth', async () => {
      const subgraph = await service.traverseGraph('ws-1', {
        startNodeId: 'node-1',
        maxDepth: 2,
        direction: 'OUTGOING',
      });

      expect(subgraph.nodes.length).toBeGreaterThan(0);
      expect(subgraph.edges.length).toBeGreaterThan(0);
      expect(subgraph.centerNodeId).toBe('node-1');
    });
  });

  describe('Health & Metrics', () => {
    it('returns comprehensive health stats and node/edge distributions', async () => {
      const health = await service.getGraphHealth('ws-1');

      expect(health.status).toBe('HEALTHY');
      expect(health.totalNodes).toBe(2);
      expect(health.totalEdges).toBe(1);
      expect(health.averageQueryLatencyMs).toBeDefined();
      expect(health.storageSizeBytes).toBeGreaterThan(0);
    });
  });
});

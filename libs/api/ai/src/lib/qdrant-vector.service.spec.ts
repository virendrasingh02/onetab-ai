import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QdrantVectorService } from './qdrant-vector.service.js';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    collectionExists: vi.fn(),
    createCollection: vi.fn(),
    createPayloadIndex: vi.fn(),
    upsert: vi.fn(),
    query: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@qdrant/js-client-rest', () => ({
  // `new QdrantClient(...)` returns our shared stub (a constructor that
  // returns an object overrides the fresh instance).
  QdrantClient: class {
    constructor() {
      return mockClient;
    }
  },
}));

const makeConfig = (overrides: Record<string, string | undefined> = {}) =>
  ({ get: vi.fn((key: string) => overrides[key]) }) as unknown as ConfigService;

describe('QdrantVectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.collectionExists.mockResolvedValue({ exists: true });
    mockClient.createPayloadIndex.mockResolvedValue(undefined);
    mockClient.upsert.mockResolvedValue(undefined);
    mockClient.query.mockResolvedValue({ points: [] });
    mockClient.delete.mockResolvedValue(undefined);
  });

  describe('when QDRANT_URL is unset', () => {
    const svc = () => new QdrantVectorService(makeConfig());

    it('reports itself not configured', () => {
      expect(svc().isConfigured()).toBe(false);
    });

    it('throws (never silently no-ops) on upsert and search', async () => {
      await expect(
        svc().upsert('c', [{ key: 'k', vector: [1, 2], payload: {} }]),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(svc().search('c', [1, 2], 'ws-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('treats deleteByDocument as a no-op', async () => {
      await expect(svc().deleteByDocument('c', 'doc-1')).resolves.toBeUndefined();
    });
  });

  describe('when QDRANT_URL is set', () => {
    const svc = () =>
      new QdrantVectorService(makeConfig({ QDRANT_URL: 'http://qdrant:6333' }));

    it('is configured', () => {
      expect(svc().isConfigured()).toBe(true);
    });

    it('creates the collection with the first vector width when missing', async () => {
      mockClient.collectionExists.mockResolvedValue({ exists: false });
      await svc().upsert('workspace_docs', [
        { key: 'doc-1:chunk:0', vector: new Array(768).fill(0.1), payload: { workspaceId: 'ws-1' } },
      ]);
      expect(mockClient.createCollection).toHaveBeenCalledWith('workspace_docs', {
        vectors: { size: 768, distance: 'Cosine' },
      });
    });

    it('hashes the chunk key to a UUID-format point id (deterministic)', async () => {
      await svc().upsert('workspace_docs', [
        { key: 'doc-1:chunk:0', vector: [0.1, 0.2], payload: {} },
      ]);
      const points = mockClient.upsert.mock.calls[0]![1].points as Array<{ id: string }>;
      expect(points[0]!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      // same key -> same id on a second call
      mockClient.upsert.mockClear();
      await svc().upsert('workspace_docs', [
        { key: 'doc-1:chunk:0', vector: [0.3, 0.4], payload: {} },
      ]);
      const points2 = mockClient.upsert.mock.calls[0]![1].points as Array<{ id: string }>;
      expect(points2[0]!.id).toBe(points[0]!.id);
    });

    it('always applies the workspace filter on search', async () => {
      mockClient.query.mockResolvedValue({
        points: [{ id: 'p1', score: 0.9, payload: { text: 'hit' } }],
      });
      const hits = await svc().search('workspace_docs', [0.1, 0.2], 'ws-42', 3);
      expect(mockClient.query).toHaveBeenCalledWith('workspace_docs', {
        query: [0.1, 0.2],
        limit: 3,
        with_payload: true,
        filter: { must: [{ key: 'workspaceId', match: { value: 'ws-42' } }] },
      });
      expect(hits).toEqual([{ id: 'p1', score: 0.9, payload: { text: 'hit' } }]);
    });

    it('wraps a Qdrant transport error as ServiceUnavailable', async () => {
      mockClient.collectionExists.mockResolvedValue({ exists: true });
      mockClient.upsert.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(
        svc().upsert('workspace_docs', [{ key: 'k', vector: [1], payload: {} }]),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});

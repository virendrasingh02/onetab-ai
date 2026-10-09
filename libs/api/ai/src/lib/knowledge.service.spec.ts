import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "@org/database";
import { AIInfrastructureService } from "./ai-infrastructure.service.js";
import { KnowledgeService } from "./knowledge.service.js";
import { QdrantVectorService } from "./qdrant-vector.service.js";

describe("KnowledgeService", () => {
  let service: KnowledgeService;
  let mockPrisma: any;
  let mockVector: any;
  let mockAi: any;

  beforeEach(() => {
    mockPrisma = {
      knowledgeBase: {
        findMany: vi.fn().mockResolvedValue([
          { id: "kb-1", name: "Engineering Wiki", workspaceId: "ws-1" },
        ]),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.id === "kb-1") {
            return Promise.resolve({
              id: "kb-1",
              name: "Engineering Wiki",
              workspaceId: "ws-1",
              vectorCollection: "kb_ws-1",
            });
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-kb", ...data })),
        update: vi.fn().mockImplementation(({ data, where }) => Promise.resolve({ id: where.id, ...data })),
        delete: vi.fn().mockResolvedValue({ id: "kb-1" }),
      },
      knowledgeDocument: {
        findMany: vi.fn().mockResolvedValue([
          { id: "doc-1", name: "Architecture Guide", status: "INDEXED", chunkCount: 2 },
        ]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "doc-1", ...data })),
        update: vi.fn().mockImplementation(({ data, where }) => Promise.resolve({ id: where.id, ...data })),
        delete: vi.fn().mockResolvedValue({ id: "doc-1" }),
      },
      knowledgeChunk: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "chunk-1",
            chunkIndex: 0,
            content: "Microservices architecture overview.",
            document: { id: "doc-1", name: "Architecture Guide" },
          },
        ]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "c-1", ...data })),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        update: vi.fn().mockImplementation(({ data, where }) => Promise.resolve({ id: where.id, ...data })),
      },
    };

    mockVector = {
      isConfigured: vi.fn().mockReturnValue(true),
      search: vi.fn().mockResolvedValue([
        {
          id: "chunk-1",
          score: 0.92,
          payload: {
            documentId: "doc-1",
            documentName: "Architecture Guide",
            chunkIndex: 0,
            content: "Microservices architecture overview.",
          },
        },
      ]),
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteByDocument: vi.fn().mockResolvedValue(undefined),
    };

    mockAi = {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };

    service = new KnowledgeService(
      mockPrisma as unknown as PrismaService,
      mockVector as unknown as QdrantVectorService,
      mockAi as unknown as AIInfrastructureService
    );
  });

  it("lists workspace knowledge bases", async () => {
    const kbs = await service.listKnowledgeBases("ws-1");
    expect(kbs).toHaveLength(1);
    expect(kbs[0].name).toBe("Engineering Wiki");
  });

  it("creates a knowledge base", async () => {
    const kb = await service.createKnowledgeBase("ws-1", "u-1", {
      name: "Product Handbook",
      description: "Company policies and handbook",
    });
    expect(kb.name).toBe("Product Handbook");
    expect(mockPrisma.knowledgeBase.create).toHaveBeenCalled();
  });

  it("ingests document and chunks text into indexed parts", async () => {
    const rawText = "# Guidelines\n\nThis is a test paragraph for knowledge ingestion.";
    const doc = await service.ingestDocument("ws-1", "kb-1", {
      name: "guidelines.md",
      rawText,
      sourceType: "MANUAL",
    });
    expect(doc.name).toBe("guidelines.md");
    expect(mockPrisma.knowledgeDocument.create).toHaveBeenCalled();
    expect(mockPrisma.knowledgeChunk.create).toHaveBeenCalled();
  });

  it("performs semantic retrieval search against knowledge base", async () => {
    const results = await service.retrieve("ws-1", "kb-1", {
      query: "architecture",
      topK: 3,
    });
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("Microservices architecture");
    expect(results[0].score).toBeGreaterThan(0);
  });
  it("keyword mode skips vector search entirely", async () => {
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", topK: 3, mode: "KEYWORD" });
    expect(mockVector.search).not.toHaveBeenCalled();
    expect(results[0].chunkId).toBe("chunk-1");
  });

  it("hybrid mode merges both searches, keeping each passage's best score", async () => {
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([
      { id: "chunk-1", chunkIndex: 0, content: "Microservices architecture overview.", document: { id: "doc-1", name: "Architecture Guide" } },
      { id: "chunk-2", chunkIndex: 1, content: "Deploy architecture checklist.", document: { id: "doc-1", name: "Architecture Guide" } },
    ]);
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", topK: 5, mode: "HYBRID" });
    expect(results.map((r) => r.chunkId)).toEqual(["chunk-1", "chunk-2"]);
    // chunk-1 scores 0.92 by vector and 1.0 by keyword (every term matches): the higher one is kept
    expect(results.find((r) => r.chunkId === "chunk-1")?.score).toBe(1);
  });

  it("drops passages under the score threshold", async () => {
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", scoreThreshold: 0.95 });
    // Vector hit scores 0.92 (dropped); semantic results win outright, so nothing is returned
    expect(results).toEqual([]);
  });

  it("semantic mode doesn't fall back to keyword search", async () => {
    mockVector.search.mockResolvedValue([]);
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", mode: "SEMANTIC" });
    expect(results).toEqual([]);
    expect(mockPrisma.knowledgeChunk.findMany).not.toHaveBeenCalled();
  });
});

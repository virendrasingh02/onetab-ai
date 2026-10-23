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
    const storedDocs = new Map<string, any>();
    const kbRow = {
      id: "kb-1",
      name: "Engineering Wiki",
      workspaceId: "ws-1",
      vectorCollection: "kb_ws-1",
      embeddingModel: "m",
      settings: {},
    };
    mockPrisma = {
      $transaction: vi.fn().mockResolvedValue([]),
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
              embeddingModel: "m",
              settings: {},
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
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(storedDocs.get(where.id) ?? null)),
        create: vi.fn().mockImplementation(({ data }) => {
          const doc = { id: "doc-1", version: 1, ...data, knowledgeBase: kbRow };
          storedDocs.set("doc-1", doc);
          return Promise.resolve(doc);
        }),
        update: vi.fn().mockImplementation(({ data, where }) => {
          const doc = { ...(storedDocs.get(where.id) ?? { id: where.id, knowledgeBase: kbRow }), ...data };
          storedDocs.set(where.id, doc);
          return Promise.resolve(doc);
        }),
        delete: vi.fn().mockResolvedValue({ id: "doc-1" }),
      },
      knowledgeUsage: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([
          { kind: "ANSWER", grounded: true, latencyMs: 100, promptTokens: 10, completionTokens: 5 },
          { kind: "ANSWER", grounded: false, latencyMs: 300, promptTokens: 0, completionTokens: 0 },
          { kind: "RETRIEVE", grounded: null, latencyMs: 50, promptTokens: 0, completionTokens: 0 },
        ]),
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
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    service.retryDelayMs = 0;
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
    expect(mockPrisma.knowledgeChunk.createMany).toHaveBeenCalled();
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

  it("semantic mode uses vectors stored in Postgres when Qdrant has nothing", async () => {
    mockVector.search.mockResolvedValue([]);
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([
      { id: "c-a", chunkIndex: 0, content: "Match", embedding: [0.1, 0.2, 0.3], metadata: {}, document: { id: "doc-1", name: "Guide" } },
      { id: "c-b", chunkIndex: 1, content: "Other", embedding: [0.3, -0.2, 0.1], metadata: {}, document: { id: "doc-1", name: "Guide" } },
    ]);
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", mode: "SEMANTIC", topK: 1 });
    expect(results.map((r) => r.chunkId)).toEqual(["c-a"]);
    expect(results[0].score).toBe(1);
  });

  it("semantic mode works without Qdrant configured", async () => {
    mockVector.isConfigured.mockReturnValue(false);
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([
      { id: "c-a", chunkIndex: 0, content: "Match", embedding: [0.1, 0.2, 0.3], metadata: {}, document: { id: "doc-1", name: "Guide" } },
    ]);
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", mode: "SEMANTIC" });
    expect(mockVector.search).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  it("semantic mode returns nothing when the query can't be embedded", async () => {
    mockAi.generateEmbedding.mockRejectedValue(new Error("no provider"));
    const results = await service.retrieve("ws-1", "kb-1", { query: "architecture", mode: "SEMANTIC" });
    expect(results).toEqual([]);
  });

  it("stores embeddings on chunks at ingest", async () => {
    mockAi.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([{ id: "c-1", chunkIndex: 0, content: "hello" }]);
    await service.ingestDocument("ws-1", "kb-1", { name: "n", rawText: "hello", sourceType: "MANUAL" });
    expect(mockPrisma.knowledgeChunk.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ embedding: [0.1, 0.2] }) }),
    );
  });

  it("flags a document when embedding fails", async () => {
    mockAi.generateEmbeddings.mockRejectedValue(new Error("boom"));
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([{ id: "c-1", chunkIndex: 0, content: "hello" }]);
    const doc = await service.ingestDocument("ws-1", "kb-1", { name: "n", rawText: "hello", sourceType: "MANUAL" });
    expect(doc.errorMessage).toMatch(/keyword only/);
  });

  it("skips content already indexed in the base (dedup)", async () => {
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValueOnce({ id: "doc-9", name: "same.md", status: "INDEXED" });
    const doc = await service.ingestDocument("ws-1", "kb-1", { name: "copy.md", rawText: "hello", sourceType: "MANUAL" });
    expect(doc.deduplicated).toBe(true);
    expect(mockPrisma.knowledgeDocument.create).not.toHaveBeenCalled();
  });

  it("re-importing changed content creates a new version and replaces chunks", async () => {
    mockPrisma.knowledgeDocument.findFirst
      .mockResolvedValueOnce(null) // no identical content
      .mockResolvedValueOnce({ id: "doc-1", version: 2, metadata: {} }); // same name
    mockPrisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      name: "n",
      version: 3,
      rawText: "new text",
      knowledgeBase: { id: "kb-1", name: "Engineering Wiki", workspaceId: "ws-1", vectorCollection: "kb_ws-1", embeddingModel: "m", settings: {} },
    });
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([{ id: "c-1", chunkIndex: 0, content: "new" }]);
    await service.ingestDocument("ws-1", "kb-1", { name: "n", rawText: "new text", sourceType: "MANUAL" });
    expect(mockPrisma.knowledgeDocument.create).not.toHaveBeenCalled();
    expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 3 }) }),
    );
    expect(mockPrisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: "doc-1" } });
    expect(mockVector.deleteByDocument).toHaveBeenCalledWith("kb_ws-1", "doc-1");
  });

  it("rejects empty documents", async () => {
    await expect(
      service.ingestDocument("ws-1", "kb-1", { name: "n", rawText: "   ", sourceType: "MANUAL" }),
    ).rejects.toThrow(/no text/);
  });

  it("marks a document FAILED when indexing throws", async () => {
    mockPrisma.knowledgeChunk.createMany.mockRejectedValue(new Error("db down"));
    await expect(
      service.ingestDocument("ws-1", "kb-1", { name: "n", rawText: "hello", sourceType: "MANUAL" }),
    ).rejects.toThrow("db down");
    expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("refuses chunk access for a document outside the knowledge base (cross-tenant)", async () => {
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValue(null);
    await expect(service.listChunks("ws-1", "kb-1", "foreign-doc")).rejects.toThrow(/not found/i);
    await expect(service.updateChunk("ws-1", "kb-1", "foreign-doc", "c", "x")).rejects.toThrow(/not found/i);
    expect(mockPrisma.knowledgeChunk.update).not.toHaveBeenCalled();
  });

  it("refuses a knowledge base from another workspace", async () => {
    await expect(service.retrieve("ws-OTHER", "kb-2", { query: "x" })).rejects.toThrow(/not found/i);
  });

  it("applies metadata filters and returns nothing when none match", async () => {
    mockPrisma.knowledgeDocument.findMany.mockResolvedValue([{ id: "d1", metadata: { tags: ["hr"] } }]);
    const none = await service.retrieve("ws-1", "kb-1", { query: "architecture", filters: { tags: ["legal"] } });
    expect(none).toEqual([]);
    await service.retrieve("ws-1", "kb-1", { query: "architecture", filters: { tags: ["hr"] } });
    expect(mockVector.search).toHaveBeenCalledWith("kb_ws-1", expect.anything(), "ws-1", 5, ["d1"]);
  });

  it("reranks by query coverage", async () => {
    mockVector.search.mockResolvedValue([
      { id: "a", score: 0.8, payload: { chunkId: "a", documentId: "d", documentName: "D", chunkIndex: 0, content: "unrelated footnote" } },
      { id: "b", score: 0.7, payload: { chunkId: "b", documentId: "d", documentName: "D", chunkIndex: 1, content: "the refund policy allows returns" } },
    ]);
    const results = await service.retrieve("ws-1", "kb-1", { query: "refund policy", mode: "SEMANTIC", rerank: true, topK: 2 });
    expect(results[0].chunkId).toBe("b");
  });

  describe("answer", () => {
    it("does not call the model when nothing is retrieved", async () => {
      mockVector.search.mockResolvedValue([]);
      mockPrisma.knowledgeChunk.findMany.mockResolvedValue([]);
      mockAi.chat = vi.fn();
      const res = await service.answer("ws-1", "kb-1", { question: "what is x?" });
      expect(res.grounded).toBe(false);
      expect(res.sources).toEqual([]);
      expect(mockAi.chat).not.toHaveBeenCalled();
    });

    it("returns cited sources and strips invented citations", async () => {
      mockAi.chat = vi.fn().mockResolvedValue({
        message: { role: "assistant", content: "Microservices are used [1][7]." },
        model: "m",
      });
      const res = await service.answer("ws-1", "kb-1", { question: "architecture?", mode: "SEMANTIC" });
      expect(res.answer).toBe("Microservices are used [1].");
      expect(res.grounded).toBe(true);
      expect(res.sources[0]).toMatchObject({ sourceNumber: 1, cited: true, documentName: "Architecture Guide" });
    });

    it("wraps sources as untrusted data in the prompt", async () => {
      mockAi.chat = vi.fn().mockResolvedValue({ message: { role: "assistant", content: "ok [1]" } });
      await service.answer("ws-1", "kb-1", { question: "architecture?", mode: "SEMANTIC" });
      const messages = mockAi.chat.mock.calls[0][0].messages;
      expect(messages[0].content).toMatch(/untrusted/i);
      expect(messages[1].content).toContain('<source id="1"');
    });
  });

  it("records usage for retrievals and answers, and summarises it", async () => {
    mockAi.chat = vi.fn().mockResolvedValue({
      message: { role: "assistant", content: "ok [1]" },
      usage: { promptTokens: 12, completionTokens: 3 },
      model: "m",
    });
    await service.retrieve("ws-1", "kb-1", { query: "architecture" });
    await service.answer("ws-1", "kb-1", { question: "architecture?", mode: "SEMANTIC" });
    await new Promise((r) => setTimeout(r, 0));
    const kinds = mockPrisma.knowledgeUsage.create.mock.calls.map((c: any) => c[0].data.kind);
    expect(kinds).toEqual(["RETRIEVE", "ANSWER"]);
    expect(mockPrisma.knowledgeUsage.create.mock.calls[1][0].data).toMatchObject({ promptTokens: 12, completionTokens: 3, grounded: true });

    const summary = await service.usageSummary("ws-1", "kb-1", 7);
    expect(summary).toMatchObject({ queries: 3, answers: 2, ungrounded: 1, avgLatencyMs: 150, promptTokens: 10 });
  });

  it("never fails a search because usage could not be recorded", async () => {
    mockPrisma.knowledgeUsage.create.mockRejectedValue(new Error("db"));
    await expect(service.retrieve("ws-1", "kb-1", { query: "architecture" })).resolves.toHaveLength(1);
  });

  describe("model rerank", () => {
    const hits = [
      { id: "a", score: 0.8, payload: { chunkId: "a", documentId: "d", documentName: "D", chunkIndex: 0, content: "weakly related" } },
      { id: "b", score: 0.7, payload: { chunkId: "b", documentId: "d", documentName: "D", chunkIndex: 1, content: "direct answer" } },
    ];
    it("reorders by the model's grades", async () => {
      mockVector.search.mockResolvedValue(hits);
      mockAi.chat = vi.fn().mockResolvedValue({ message: { role: "assistant", content: "[1, 10]" } });
      const r = await service.retrieve("ws-1", "kb-1", { query: "q", mode: "SEMANTIC", rerank: true, rerankStrategy: "MODEL", topK: 2 });
      expect(r.map((x) => x.chunkId)).toEqual(["b", "a"]);
    });
    it("falls back to lexical when the model reply is unusable", async () => {
      mockVector.search.mockResolvedValue(hits);
      mockAi.chat = vi.fn().mockResolvedValue({ message: { role: "assistant", content: "no idea" } });
      const r = await service.retrieve("ws-1", "kb-1", { query: "direct answer", mode: "SEMANTIC", rerank: true, rerankStrategy: "MODEL", topK: 2 });
      expect(r[0].chunkId).toBe("b");
    });
  });

  describe("shared queue", () => {
    it("pushes uploads to the cache queue and a worker indexes them", async () => {
      const jobs: any[] = [];
      const cache = { pushQueue: vi.fn(async (_q: string, j: unknown) => void jobs.push(j)), popQueue: vi.fn(async () => jobs.shift() ?? null) };
      const queued = new KnowledgeService(mockPrisma, mockVector, mockAi, cache as any);
      queued.retryDelayMs = 0;
      const doc = await queued.ingestDocument("ws-1", "kb-1", { name: "n", rawText: "hello world", sourceType: "MANUAL" }, { background: true });
      expect(cache.pushQueue).toHaveBeenCalledWith("knowledge:indexing", { documentId: doc.id });
      mockPrisma.knowledgeChunk.findMany.mockResolvedValue([{ id: "c-1", chunkIndex: 0, content: "hello world" }]);
      vi.useFakeTimers();
      await queued.onModuleInit();
      await vi.advanceTimersByTimeAsync(1_500);
      queued.onModuleDestroy();
      vi.useRealTimers();
      expect(mockPrisma.knowledgeChunk.createMany).toHaveBeenCalled();
      expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "INDEXED" }) }),
      );
    });
  });

  it("prices answers from the model's listed per-million rates", async () => {
    const models = { findModel: vi.fn().mockReturnValue({ pricing: { pricingType: "usage", inputPricePerMillion: 2, outputPricePerMillion: 10 } }) };
    const priced = new KnowledgeService(mockPrisma, mockVector, mockAi, undefined, models as any);
    mockAi.chat = vi.fn().mockResolvedValue({
      message: { role: "assistant", content: "ok [1]" },
      usage: { promptTokens: 1000, completionTokens: 500 },
      model: "gpt-x",
    });
    await priced.answer("ws-1", "kb-1", { question: "architecture?", mode: "SEMANTIC" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockPrisma.knowledgeUsage.create.mock.calls.at(-1)[0].data.costUsd).toBeCloseTo(0.007, 6);
  });

  it("records zero cost for free or unpriced models", async () => {
    const models = { findModel: vi.fn().mockReturnValue({ pricing: { pricingType: "free" } }) };
    const free = new KnowledgeService(mockPrisma, mockVector, mockAi, undefined, models as any);
    mockAi.chat = vi.fn().mockResolvedValue({ message: { role: "assistant", content: "ok [1]" }, usage: { promptTokens: 9, completionTokens: 9 }, model: "m" });
    await free.answer("ws-1", "kb-1", { question: "architecture?", mode: "SEMANTIC" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockPrisma.knowledgeUsage.create.mock.calls.at(-1)[0].data.costUsd).toBe(0);
  });
});

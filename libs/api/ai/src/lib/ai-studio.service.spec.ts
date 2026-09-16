import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "@org/database";
import { AIStudioService } from "./ai-studio.service.js";

describe("AIStudioService", () => {
  let service: AIStudioService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      aIAgent: {
        count: vi.fn().mockImplementation(({ where }) => {
          if (where.type === "agent") return Promise.resolve(5);
          if (where.type === "coworker") return Promise.resolve(2);
          return Promise.resolve(7);
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "ag-1", name: "Reviewer", type: "agent", isActive: true, updatedAt: new Date() },
          { id: "ag-2", name: "Draft Agent", type: "agent", isActive: false, updatedAt: new Date() },
        ]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-ag", ...data })),
      },
      automationWorkflow: {
        count: vi.fn().mockResolvedValue(10),
        findMany: vi.fn().mockResolvedValue([
          { id: "wf-1", name: "Daily Report", isActive: true, updatedAt: new Date() },
        ]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-wf", ...data })),
      },
      aIApp: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([
          { id: "app-1", name: "Support Bot", isPublished: true, updatedAt: new Date() },
        ]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-app", ...data })),
      },
      knowledgeBase: {
        count: vi.fn().mockResolvedValue(4),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-kb", ...data })),
      },
      aIExecution: {
        count: vi.fn().mockImplementation(({ where }) => {
          if (where?.status === "COMPLETED") return Promise.resolve(80);
          return Promise.resolve(100);
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "exec-1",
            workspaceId: "ws-1",
            userId: "u-1",
            entityType: "agent",
            entityId: "ag-1",
            version: 1,
            status: "COMPLETED",
            startedAt: new Date(),
            finishedAt: new Date(),
            latencyMs: 350,
            tokensUsed: 120,
            totalCost: 0.0015,
            model: "llama3",
            toolCalls: [],
            errorsJson: null,
            stateJson: {},
            user: { id: "u-1", name: "Alice" },
          },
        ]),
      },
    };

    service = new AIStudioService(mockPrisma as unknown as PrismaService);
  });

  describe("getOverview", () => {
    it("aggregates overview metrics and resource buckets correctly", async () => {
      const overview = await service.getOverview("ws-1");
      expect(overview.totalAgents).toBe(5);
      expect(overview.totalCoworkers).toBe(2);
      expect(overview.totalWorkflows).toBe(10);
      expect(overview.totalApps).toBe(3);
      expect(overview.totalKnowledgeBases).toBe(4);
      expect(overview.totalExecutions).toBe(100);
      expect(overview.successRate).toBe(80);
      expect(overview.publishedResources.length).toBeGreaterThan(0);
      expect(overview.draftResources.length).toBeGreaterThan(0);
    });
  });

  describe("quickCreate", () => {
    it("creates an autonomous agent", async () => {
      const res = await service.quickCreate("ws-1", "u-1", { name: "Code Reviewer", type: "agent" });
      expect(res.type).toBe("agent");
      expect(mockPrisma.aIAgent.create).toHaveBeenCalled();
    });

    it("creates an AI coworker", async () => {
      const res = await service.quickCreate("ws-1", "u-1", { name: "Codey", type: "coworker" });
      expect(res.type).toBe("coworker");
      expect(mockPrisma.aIAgent.create).toHaveBeenCalled();
    });

    it("creates a visual workflow", async () => {
      const res = await service.quickCreate("ws-1", "u-1", { name: "Data Pipeline", type: "workflow" });
      expect(res.type).toBe("workflow");
      expect(mockPrisma.automationWorkflow.create).toHaveBeenCalled();
    });

    it("creates an AI app", async () => {
      const res = await service.quickCreate("ws-1", "u-1", { name: "Support App", type: "app" });
      expect(res.type).toBe("app");
      expect(mockPrisma.aIApp.create).toHaveBeenCalled();
    });

    it("creates a knowledge base", async () => {
      const res = await service.quickCreate("ws-1", "u-1", { name: "Engineering Wiki", type: "knowledge" });
      expect(res.type).toBe("knowledge");
      expect(mockPrisma.knowledgeBase.create).toHaveBeenCalled();
    });

    it("throws error for unsupported type", async () => {
      await expect(
        service.quickCreate("ws-1", "u-1", { name: "Test", type: "unknown" })
      ).rejects.toThrow("Unsupported resource type");
    });
  });
});

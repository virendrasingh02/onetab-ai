import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "@org/database";
import { AIAppsService } from "./ai-apps.service.js";

describe("AIAppsService", () => {
  let service: AIAppsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      aIApp: {
        findMany: vi.fn().mockResolvedValue([
          { id: "app-1", name: "Chatbot", workspaceId: "ws-1", isPublished: true },
        ]),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.id === "app-1") {
            return Promise.resolve({ id: "app-1", name: "Chatbot", workspaceId: "ws-1", isPublished: true });
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "new-app", ...data })),
        update: vi.fn().mockImplementation(({ data, where }) => Promise.resolve({ id: where.id, ...data })),
        delete: vi.fn().mockResolvedValue({ id: "app-1" }),
      },
      aIExecution: {
        create: vi.fn().mockResolvedValue({ id: "exec-123" }),
        update: vi.fn().mockResolvedValue({ id: "exec-123", status: "COMPLETED" }),
      },
    };

    service = new AIAppsService(mockPrisma as unknown as PrismaService);
  });

  it("lists workspace apps", async () => {
    const apps = await service.listApps("ws-1");
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe("Chatbot");
  });

  it("gets an app by id", async () => {
    const app = await service.getApp("ws-1", "app-1");
    expect(app.id).toBe("app-1");
  });

  it("throws not found when app does not exist", async () => {
    await expect(service.getApp("ws-1", "nonexistent")).rejects.toThrow("AI App not found");
  });

  it("creates a new app with generated slug", async () => {
    const app = await service.createApp("ws-1", "u-1", {
      name: "Customer Support",
      appType: "CHAT_APP",
      description: "Handles customer inquiries",
    });
    expect(app.name).toBe("Customer Support");
    expect(mockPrisma.aIApp.create).toHaveBeenCalled();
  });

  it("updates publishing state", async () => {
    await service.publishApp("ws-1", "app-1", false);
    expect(mockPrisma.aIApp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: { isPublished: false },
      })
    );
  });

  it("executes an app and records execution trace", async () => {
    const result = await service.executeApp("ws-1", "u-1", "app-1", { query: "hello" });
    expect(result.executionId).toBe("exec-123");
    expect(mockPrisma.aIExecution.create).toHaveBeenCalled();
    expect(mockPrisma.aIExecution.update).toHaveBeenCalled();
  });
});

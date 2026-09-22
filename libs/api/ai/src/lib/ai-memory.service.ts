import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';

/**
 * Read/delete surface for the workspace-scoped `AIMemory` table that
 * `save_memory`/`list_memory` (`MCPToolRegistryService`, `@org/api-agents`)
 * write to during an Agent/Coworker turn — lets a user inspect and remove
 * what an agent has remembered, per the platform's privacy requirement for
 * agent memory. Read-only from the API's side otherwise: writes only ever
 * come from an agent's own `save_memory` tool call, never directly from a
 * person, so memory always reflects something an agent actually decided was
 * worth keeping.
 */
@Injectable()
export class AIMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    return this.prisma.aIMemory.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async delete(workspaceId: string, key: string): Promise<void> {
    await this.prisma.aIMemory.deleteMany({ where: { workspaceId, key } });
  }
}

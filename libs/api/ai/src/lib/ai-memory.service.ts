import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';

export const AI_MEMORY_SCOPES = ['workspace', 'user', 'agent', 'project', 'conversation', 'task'] as const;
export type AIMemoryScope = (typeof AI_MEMORY_SCOPES)[number];

export interface AIMemoryFilterOptions {
  search?: string;
  scope?: string;
  agentId?: string;
  take?: number;
}

export interface AIMemoryUpsertInput {
  key: string;
  value: string;
  scope?: string;
  agentId?: string;
}

const MAX_KEY_LENGTH = 200;
const MAX_VALUE_LENGTH = 4000;

/**
 * Key prefixes a scope is stored under. Scoped memories are written as
 * `[scope] key` (or `[agent:<id>] key` for one agent), so a scope matches both
 * the bare and the id-qualified form. Unprefixed keys are workspace-wide.
 */
export function aiMemoryScopeWhere(scope: string): Record<string, unknown> {
  const s = scope.trim().toLowerCase();
  const prefixed = { OR: [{ key: { startsWith: `[${s}]` } }, { key: { startsWith: `[${s}:` } }] };
  return s === 'workspace' ? { OR: [...prefixed.OR, { NOT: { key: { startsWith: '[' } } }] } : prefixed;
}

/**
 * Workspace-scoped `AIMemory` — what agents remember via `save_memory`, plus
 * facts a workspace admin adds by hand. Scopes are key prefixes (see
 * {@link aiMemoryScopeWhere}); every query is bound to one workspace.
 */
@Injectable()
export class AIMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string, options?: AIMemoryFilterOptions) {
    const and: Record<string, unknown>[] = [];

    const q = options?.search?.trim();
    if (q) {
      and.push({
        OR: [
          { key: { contains: q, mode: 'insensitive' } },
          { value: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const agentId = options?.agentId?.trim();
    if (agentId) {
      and.push({ key: { startsWith: `[agent:${agentId}]` } });
    } else if (options?.scope?.trim()) {
      and.push(aiMemoryScopeWhere(options.scope));
    }

    return this.prisma.aIMemory.findMany({
      where: { workspaceId, ...(and.length ? { AND: and } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: options?.take ? Math.min(Math.max(options.take, 1), 200) : 200,
    });
  }

  async get(workspaceId: string, key: string) {
    return this.prisma.aIMemory.findUnique({ where: { workspaceId_key: { workspaceId, key } } });
  }

  /** A fact added by a person (an agent writes through `save_memory`). */
  async set(workspaceId: string, input: AIMemoryUpsertInput) {
    const rawKey = typeof input?.key === 'string' ? input.key.trim() : '';
    const value = typeof input?.value === 'string' ? input.value.trim() : '';
    if (!rawKey || !value) throw new BadRequestException('Both a key and a value are required.');
    if (rawKey.length > MAX_KEY_LENGTH) throw new BadRequestException(`Keys can be at most ${MAX_KEY_LENGTH} characters.`);
    if (value.length > MAX_VALUE_LENGTH) throw new BadRequestException(`Values can be at most ${MAX_VALUE_LENGTH} characters.`);

    const scope = typeof input.scope === 'string' ? input.scope.trim().toLowerCase() : undefined;
    if (scope && !(AI_MEMORY_SCOPES as readonly string[]).includes(scope)) {
      throw new BadRequestException(`Unknown memory scope '${scope}'.`);
    }
    const agentId = typeof input.agentId === 'string' ? input.agentId.trim() : '';

    let key = rawKey;
    if (!rawKey.startsWith('[')) {
      if (agentId) key = `[agent:${agentId}] ${rawKey}`;
      else if (scope && scope !== 'workspace') key = `[${scope}] ${rawKey}`;
    }

    return this.prisma.aIMemory.upsert({
      where: { workspaceId_key: { workspaceId, key } },
      create: { workspaceId, key, value, source: 'manual' },
      update: { value, source: 'manual' },
    });
  }

  async search(workspaceId: string, query: string, options?: { scope?: string; agentId?: string; limit?: number }) {
    return this.list(workspaceId, { search: query, scope: options?.scope, agentId: options?.agentId, take: options?.limit ?? 20 });
  }

  async delete(workspaceId: string, key: string): Promise<void> {
    await this.prisma.aIMemory.deleteMany({ where: { workspaceId, key } });
  }

  async forgetAgentMemories(workspaceId: string, agentId: string): Promise<{ count: number }> {
    const res = await this.prisma.aIMemory.deleteMany({
      where: { workspaceId, key: { startsWith: `[agent:${agentId}]` } },
    });
    return { count: res.count };
  }
}

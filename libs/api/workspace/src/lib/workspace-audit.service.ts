import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import type { WorkspaceAuditLogDto } from '@org/types';

export interface RecordAuditEntryInput {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const REDACTED_KEYS = new Set([
  'token',
  'tokenhash',
  'password',
  'passwordhash',
  'secret',
  'authorization',
  'cookie',
]);

function sanitizeMetadata(
  data?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

@Injectable()
export class WorkspaceAuditService {
  private readonly logger = new Logger(WorkspaceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Alias for record().
   */
  async log(input: RecordAuditEntryInput): Promise<void> {
    return this.record(input);
  }

  /**
   * Records a workspace audit log event asynchronously. Never throws.
   */
  async record(input: RecordAuditEntryInput): Promise<void> {
    try {
      const sanitizedMeta = sanitizeMetadata(input.metadata);

      await this.prisma.workspaceAuditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorId: input.actorId ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          metadata: (sanitizedMeta as any) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record workspace audit log entry', err as Error);
    }
  }

  async list(
    workspaceId: string,
    params?: { action?: string; limit?: number; offset?: number },
  ): Promise<{ items: WorkspaceAuditLogDto[]; total: number }> {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const where: Record<string, unknown> = { workspaceId };
    if (params?.action && params.action !== 'ALL') {
      where['action'] = params.action;
    }

    const [items, total] = await Promise.all([
      this.prisma.workspaceAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: { select: PUBLIC_USER_SELECT },
        },
      }),
      this.prisma.workspaceAuditLog.count({ where }),
    ]);

    return {
      total,
      items: items.map((row) => ({
        id: row.id,
        workspaceId: row.workspaceId,
        actorId: row.actorId,
        actor: row.actor ? toPublicUser(row.actor) : null,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

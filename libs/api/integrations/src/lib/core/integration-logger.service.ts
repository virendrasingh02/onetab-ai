import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

@Injectable()
export class IntegrationLoggerService {
  private readonly logger = new Logger(IntegrationLoggerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deeply sanitizes sensitive fields in log data or metadata.
   */
  sanitizeData(data: unknown): unknown {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = new Set([
      'authorization',
      'accesstoken',
      'refreshtoken',
      'token',
      'password',
      'clientsecret',
      'apikey',
      'secret',
      'key',
      'bearer',
      'encryptedaccesstoken',
      'encryptedrefreshtoken',
    ]);

    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const lower = k.toLowerCase().replace(/[-_]/g, '');
      if (sensitiveKeys.has(lower)) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'string' && (v.startsWith('Bearer ') || v.startsWith('Basic '))) {
        sanitized[k] = '[REDACTED_AUTH_HEADER]';
      } else if (typeof v === 'object' && v !== null) {
        sanitized[k] = this.sanitizeData(v);
      } else {
        sanitized[k] = v;
      }
    }

    return sanitized;
  }

  /**
   * Logs an action with structured metadata and writes to database audit log.
   */
  async logAudit(params: {
    integrationId?: string | null;
    workspaceId?: string | null;
    userId?: string | null;
    action: string;
    status: 'SUCCESS' | 'FAILURE';
    durationMs?: number;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const sanitizedDetails = params.details
      ? this.sanitizeData(params.details)
      : undefined;

    this.logger.log(
      `[IntegrationAudit] action=${params.action} status=${params.status} integration=${params.integrationId ?? 'none'} workspace=${params.workspaceId ?? 'none'} duration=${params.durationMs ?? 0}ms`,
    );

    try {
      await this.prisma.integrationAuditLog.create({
        data: {
          integrationId: params.integrationId,
          workspaceId: params.workspaceId,
          userId: params.userId,
          action: params.action,
          status: params.status,
          durationMs: params.durationMs,
          details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Retrieves recent audit logs for a workspace or integration.
   */
  async getAuditLogs(filter: {
    workspaceId?: string;
    integrationId?: string;
    limit?: number;
  }) {
    return this.prisma.integrationAuditLog.findMany({
      where: {
        ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
        ...(filter.integrationId ? { integrationId: filter.integrationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
    });
  }
}

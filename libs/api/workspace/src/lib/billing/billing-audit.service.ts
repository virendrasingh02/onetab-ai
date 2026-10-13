import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

/** Append-only record of sensitive billing changes (plan, coupon, subscription). */
@Injectable()
export class BillingAuditService {
  private readonly logger = new Logger(BillingAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * True the first time `key` is seen, false afterwards — durable de-duplication
   * for time-driven notices that a sweep would otherwise repeat every tick.
   */
  async firstTime(key: string): Promise<boolean> {
    const seen = await this.prisma.billingAuditLog.findFirst({
      where: { action: 'NOTICE_SENT', targetType: 'notice', targetId: key },
      select: { id: true },
    });
    if (seen) return false;
    await this.record({ action: 'NOTICE_SENT', targetType: 'notice', targetId: key });
    return true;
  }

  async record(entry: {
    action: string;
    targetType: string;
    targetId?: string | null;
    workspaceId?: string | null;
    actorId?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.billingAuditLog.create({
        data: {
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          workspaceId: entry.workspaceId ?? null,
          actorId: entry.actorId ?? null,
          details: (entry.details ?? {}) as object,
        },
      });
    } catch (err) {
      // Auditing must never take a billing flow down, but it must not be silent.
      this.logger.error(`Failed to write billing audit entry ${entry.action}: ${String(err)}`);
    }
  }
}

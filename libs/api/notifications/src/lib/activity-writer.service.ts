import { Injectable, Logger } from '@nestjs/common';
import { ActivityKind, PrismaService } from '@org/database';

export interface WriteActivityInput {
  workspaceId: string;
  kind: ActivityKind;
  /** The actor. Null for system events. */
  actorId?: string | null;
  channelId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  /** Pre-rendered one-liner for non-chat rows. */
  summary?: string | null;
  mentionedUserIds?: string[];
}

/**
 * Writes non-chat rows into `RecentActivity` — the same table Matrix message
 * sync writes into, so the Inbox is one merged stream rather than two.
 *
 * Chat rows still come only from `matrix-sync.service.ts`; this covers
 * everything the product does outside a channel (tasks, projects, documents).
 */
@Injectable()
export class ActivityWriterService {
  private readonly logger = new Logger(ActivityWriterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async write(input: WriteActivityInput): Promise<void> {
    try {
      await this.prisma.recentActivity.create({
        data: {
          workspaceId: input.workspaceId,
          kind: input.kind,
          userId: input.actorId ?? null,
          channelId: input.channelId ?? null,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          summary: input.summary ?? null,
          mentionedUserIds: input.mentionedUserIds ?? [],
        },
      });
    } catch (err) {
      // The feed is a convenience, never a correctness dependency of the write
      // that triggered it — a failure here must not bubble into that request.
      this.logger.warn(
        `Failed to write ${input.kind} activity for workspace ${input.workspaceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

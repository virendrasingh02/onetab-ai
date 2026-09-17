import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';
import type { ScheduledMessageView } from '@org/types';
import type {
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
} from '@org/validation';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';

/** Due messages delivered per tick, so a large backlog does not stall the loop. */
const BATCH = 50;

/**
 * A message the author asked to be sent later — real, server-persisted
 * delivery, replacing the previous `localStorage`-only stub that could never
 * actually fire once the composer that scheduled it was gone.
 *
 * Delivery posts into the room as the author, via the same appservice
 * `user_id=` impersonation the bridge already uses to post on behalf of a bot
 * (`MatrixAdminService.sendEventAs`) — here posting on behalf of the human who
 * scheduled it. This inherits Matrix's own membership enforcement for free:
 * if the author is no longer in the room by the scheduled time, the send is
 * rejected by Synapse exactly as a live send would be, and the row is marked
 * `FAILED` rather than silently dropped or fabricated as sent.
 */
@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly auth: MatrixAuthService,
  ) {}

  private toView(row: {
    id: string;
    workspaceId: string;
    authorId: string;
    conversationId: string;
    channelName: string | null;
    body: string;
    scheduledFor: Date;
    status: string;
    sentAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ScheduledMessageView {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      authorId: row.authorId,
      conversationId: row.conversationId,
      channelName: row.channelName,
      body: row.body,
      scheduledFor: row.scheduledFor.toISOString(),
      status: row.status as ScheduledMessageView['status'],
      sentAt: row.sentAt?.toISOString() ?? null,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** The caller's own scheduled messages in this workspace — never another member's. */
  async list(
    workspaceId: string,
    authorId: string,
  ): Promise<ScheduledMessageView[]> {
    const rows = await this.prisma.scheduledMessage.findMany({
      where: { workspaceId, authorId, status: { not: 'CANCELLED' } },
      orderBy: { scheduledFor: 'asc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    workspaceId: string,
    authorId: string,
    input: CreateScheduledMessageInput,
  ): Promise<ScheduledMessageView> {
    const scheduledFor = new Date(input.scheduledFor);
    if (scheduledFor.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future.');
    }

    const row = await this.prisma.scheduledMessage.create({
      data: {
        workspaceId,
        authorId,
        conversationId: input.conversationId,
        channelName: input.channelName,
        body: input.body,
        scheduledFor,
      },
    });
    return this.toView(row);
  }

  private async assertOwned(workspaceId: string, authorId: string, id: string) {
    const row = await this.prisma.scheduledMessage.findFirst({
      where: { id, workspaceId, authorId },
    });
    if (!row) throw new NotFoundException('Scheduled message not found.');
    if (row.status !== 'PENDING') {
      throw new ForbiddenException(
        'Only a pending scheduled message can be changed.',
      );
    }
    return row;
  }

  async update(
    workspaceId: string,
    authorId: string,
    id: string,
    input: UpdateScheduledMessageInput,
  ): Promise<ScheduledMessageView> {
    await this.assertOwned(workspaceId, authorId, id);
    const scheduledFor = input.scheduledFor
      ? new Date(input.scheduledFor)
      : undefined;
    if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future.');
    }

    const row = await this.prisma.scheduledMessage.update({
      where: { id },
      data: {
        body: input.body,
        scheduledFor,
      },
    });
    return this.toView(row);
  }

  async cancel(
    workspaceId: string,
    authorId: string,
    id: string,
  ): Promise<void> {
    await this.assertOwned(workspaceId, authorId, id);
    await this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /** Fires whether or not the scheduling browser session is still open. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'scheduled-messages-deliver' })
  async deliverDue(): Promise<void> {
    if (!this.admin.isEnabled) return;

    const due = await this.prisma.scheduledMessage.findMany({
      where: { status: 'PENDING', scheduledFor: { lte: new Date() } },
      orderBy: { scheduledFor: 'asc' },
      take: BATCH,
    });
    if (due.length === 0) return;

    for (const message of due) {
      try {
        const matrixUserId = await this.auth.ensureIdentity(message.authorId);
        if (!matrixUserId) {
          throw new Error('Author has no Matrix identity.');
        }
        await this.admin.sendEventAs(
          message.conversationId,
          matrixUserId,
          'm.room.message',
          { msgtype: 'm.text', body: message.body },
        );
        await this.prisma.scheduledMessage.update({
          where: { id: message.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (error) {
        this.logger.warn(
          `Scheduled message ${message.id} failed to send: ${String(error)}`,
        );
        await this.prisma.scheduledMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            errorMessage: String(error).slice(0, 500),
          },
        });
      }
    }
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationKind, PrismaService } from '@org/database';
import type { MessageReminder } from '@org/types';
import {
  MESSAGE_REMINDER_MAX_AHEAD_DAYS,
  type CreateMessageReminderInput,
} from '@org/validation';
import { NotificationCenterService } from './notification-center.service.js';

/** Due reminders handled per sweep — the rest wait a minute, none are lost. */
const SWEEP_BATCH = 200;

/** A reminder set a few seconds "in the past" (clock skew) still counts. */
const PAST_TOLERANCE_MS = 60_000;

type ReminderRow = {
  id: string;
  roomId: string;
  eventId: string;
  deepLink: string;
  snippet: string;
  remindAt: Date;
  firedAt: Date | null;
  createdAt: Date;
};

function toView(row: ReminderRow): MessageReminder {
  return {
    id: row.id,
    roomId: row.roomId,
    eventId: row.eventId,
    deepLink: row.deepLink,
    snippet: row.snippet,
    remindAt: row.remindAt.toISOString(),
    firedAt: row.firedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * "Remind me about this" on chat messages.
 *
 * A reminder is a row until it is due; the per-minute sweep turns it into a
 * MESSAGE_REMINDER notification — bell, desktop notification and sound all
 * come from the existing notification pipeline — that opens the message.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly center: NotificationCenterService,
  ) {}

  /** Setting a reminder on a message that already has one reschedules it. */
  async create(
    workspaceId: string,
    userId: string,
    input: CreateMessageReminderInput,
  ): Promise<MessageReminder> {
    const remindAt = new Date(input.remindAt);
    const now = Date.now();
    if (remindAt.getTime() < now - PAST_TOLERANCE_MS) {
      throw new BadRequestException('Pick a time in the future.');
    }
    if (remindAt.getTime() > now + MESSAGE_REMINDER_MAX_AHEAD_DAYS * 86_400_000) {
      throw new BadRequestException('Reminders can be set up to a year ahead.');
    }

    const data = {
      roomId: input.roomId,
      deepLink: input.deepLink,
      snippet: input.snippet.trim().slice(0, 280),
      remindAt,
    };
    const existing = await this.prisma.messageReminder.findFirst({
      where: { workspaceId, userId, eventId: input.eventId, firedAt: null },
      select: { id: true },
    });
    const row = existing
      ? await this.prisma.messageReminder.update({ where: { id: existing.id }, data })
      : await this.prisma.messageReminder.create({
          data: { ...data, workspaceId, userId, eventId: input.eventId },
        });
    return toView(row);
  }

  /** The caller's reminders that have not gone off yet, soonest first. */
  async listPending(workspaceId: string, userId: string): Promise<MessageReminder[]> {
    const rows = await this.prisma.messageReminder.findMany({
      where: { workspaceId, userId, firedAt: null },
      orderBy: { remindAt: 'asc' },
      take: 200,
    });
    return rows.map(toView);
  }

  async cancel(workspaceId: string, userId: string, reminderId: string): Promise<void> {
    const removed = await this.prisma.messageReminder.deleteMany({
      where: { id: reminderId, workspaceId, userId, firedAt: null },
    });
    if (removed.count === 0) throw new NotFoundException('Reminder not found.');
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'message-reminders' })
  async sweep(): Promise<void> {
    let due: Array<ReminderRow & { workspaceId: string; userId: string }>;
    try {
      due = await this.prisma.messageReminder.findMany({
        where: { firedAt: null, remindAt: { lte: new Date() } },
        orderBy: { remindAt: 'asc' },
        take: SWEEP_BATCH,
      });
    } catch (err) {
      this.logger.warn(`Reminder sweep could not read due reminders: ${String(err)}`);
      return;
    }

    for (const reminder of due) {
      try {
        // Claim before notifying, so two API instances never both fire it.
        const claimed = await this.prisma.messageReminder.updateMany({
          where: { id: reminder.id, firedAt: null },
          data: { firedAt: new Date() },
        });
        if (claimed.count === 0) continue;

        // Someone who has since left the workspace gets nothing.
        const member = await this.prisma.workspaceMember.count({
          where: {
            workspaceId: reminder.workspaceId,
            userId: reminder.userId,
            status: 'ACTIVE',
          },
        });
        if (member === 0) continue;

        await this.center.create({
          workspaceId: reminder.workspaceId,
          recipientId: reminder.userId,
          actorId: null,
          kind: NotificationKind.MESSAGE_REMINDER,
          title: reminder.snippet
            ? `Reminder: “${reminder.snippet}”`
            : 'Reminder about a message',
          body: 'You asked to be reminded about this message.',
          deepLink: reminder.deepLink,
          resourceType: 'message_reminder',
          resourceId: reminder.id,
        });
      } catch (err) {
        this.logger.warn(`Reminder ${reminder.id} could not be delivered: ${String(err)}`);
      }
    }
  }
}

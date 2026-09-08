import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toScheduledStatus } from '@org/api-common';
import { PrismaService } from '@org/database';
import { MAX_SCHEDULED_STATUSES, type ScheduledStatusView } from '@org/types';
import type {
  CreateScheduledStatusInput,
  UpdateScheduledStatusInput,
} from '@org/validation';

/** Fields, per recurrence, that are meaningful; the rest are nulled on write. */
type Recurrence = CreateScheduledStatusInput['recurrence'];

@Injectable()
export class ScheduledStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ScheduledStatusView[]> {
    const rows = await this.prisma.scheduledStatus.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toScheduledStatus);
  }

  async create(
    userId: string,
    input: CreateScheduledStatusInput,
  ): Promise<ScheduledStatusView> {
    const count = await this.prisma.scheduledStatus.count({ where: { userId } });
    if (count >= MAX_SCHEDULED_STATUSES) {
      throw new ConflictException(
        `You can keep at most ${MAX_SCHEDULED_STATUSES} scheduled statuses.`,
      );
    }

    const timezone = input.timezone ?? (await this.userTimezone(userId));
    const row = await this.prisma.scheduledStatus.create({
      data: { userId, timezone, ...this.shapeForRecurrence(input.recurrence, input) },
    });
    return toScheduledStatus(row);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateScheduledStatusInput,
  ): Promise<ScheduledStatusView> {
    const existing = await this.assertOwned(userId, id);

    const recurrence = (input.recurrence ?? existing.recurrence) as Recurrence;
    const merged = { ...existing, ...input, recurrence };
    this.assertConsistent(merged);

    const row = await this.prisma.scheduledStatus.update({
      where: { id },
      data: {
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.recurrence !== undefined
          ? // A recurrence switch rewrites the whole window shape.
            this.shapeForRecurrence(recurrence, merged)
          : this.patchSameRecurrence(input)),
      },
    });
    return toScheduledStatus(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.prisma.$transaction([
      this.prisma.scheduledStatus.delete({ where: { id } }),
      // If this entry is what currently drives the user's status, clear it too.
      this.prisma.user.updateMany({
        where: { id: userId, scheduledStatusAppliedId: id },
        data: {
          scheduledStatusAppliedId: null,
          statusText: null,
          statusEmoji: null,
          statusExpiresAt: null,
        },
      }),
    ]);
  }

  /* --------------------------------------------------------------------- */

  private async assertOwned(userId: string, id: string) {
    const row = await this.prisma.scheduledStatus.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('Scheduled status not found.');
    return row;
  }

  private async userTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    return user.timezone || 'UTC';
  }

  private assertConsistent(v: {
    recurrence: Recurrence;
    startAt?: string | Date | null;
    endAt?: string | Date | null;
    startMinute?: number | null;
    endMinute?: number | null;
    daysOfWeek?: number[] | null;
  }): void {
    const ms = (x: string | Date | null | undefined) =>
      x == null ? null : new Date(x).getTime();

    if (v.recurrence === 'ONE_TIME') {
      const s = ms(v.startAt);
      const e = ms(v.endAt);
      if (s == null || e == null) {
        throw new BadRequestException('A one-time status needs a start and end.');
      }
      if (e <= s) {
        throw new BadRequestException('End must be after the start.');
      }
      return;
    }

    if (v.startMinute == null || v.endMinute == null) {
      throw new BadRequestException('A recurring status needs a time of day.');
    }
    if (v.endMinute <= v.startMinute) {
      throw new BadRequestException(
        'End time must be after the start (no overnight windows).',
      );
    }
    if (
      v.recurrence === 'WEEKLY' &&
      (!v.daysOfWeek || v.daysOfWeek.length === 0)
    ) {
      throw new BadRequestException('Pick at least one day.');
    }
  }

  /** The full write shape for a given recurrence — irrelevant fields nulled. */
  private shapeForRecurrence(
    recurrence: Recurrence,
    v: {
      label?: string | null;
      statusText?: string | null;
      statusEmoji?: string | null;
      presence?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' | null;
      isEnabled?: boolean | null;
      priority?: number | null;
      startAt?: string | Date | null;
      endAt?: string | Date | null;
      startMinute?: number | null;
      endMinute?: number | null;
      activeFrom?: string | Date | null;
      activeUntil?: string | Date | null;
      daysOfWeek?: number[] | null;
    },
  ) {
    const common = {
      label: v.label as string,
      statusText: v.statusText as string,
      statusEmoji: v.statusEmoji ?? null,
      presence: v.presence ?? null,
      isEnabled: v.isEnabled ?? true,
      priority: v.priority ?? 0,
      recurrence,
    };

    if (recurrence === 'ONE_TIME') {
      return {
        ...common,
        startAt: v.startAt ? new Date(v.startAt) : null,
        endAt: v.endAt ? new Date(v.endAt) : null,
        startMinute: null,
        endMinute: null,
        daysOfWeek: [],
        activeFrom: null,
        activeUntil: null,
      };
    }

    return {
      ...common,
      startAt: null,
      endAt: null,
      startMinute: v.startMinute ?? null,
      endMinute: v.endMinute ?? null,
      daysOfWeek: recurrence === 'WEEKLY' ? v.daysOfWeek ?? [] : [],
      activeFrom: v.activeFrom ? new Date(v.activeFrom) : null,
      activeUntil: v.activeUntil ? new Date(v.activeUntil) : null,
    };
  }

  /** A partial write that keeps the current recurrence — only set fields. */
  private patchSameRecurrence(input: UpdateScheduledStatusInput) {
    const out: Record<string, unknown> = {};
    if (input.label !== undefined) out['label'] = input.label;
    if (input.statusText !== undefined) out['statusText'] = input.statusText;
    if (input.statusEmoji !== undefined) out['statusEmoji'] = input.statusEmoji;
    if (input.presence !== undefined) out['presence'] = input.presence;
    if (input.isEnabled !== undefined) out['isEnabled'] = input.isEnabled;
    if (input.priority !== undefined) out['priority'] = input.priority;
    if (input.startAt !== undefined) {
      out['startAt'] = input.startAt ? new Date(input.startAt) : null;
    }
    if (input.endAt !== undefined) {
      out['endAt'] = input.endAt ? new Date(input.endAt) : null;
    }
    if (input.startMinute !== undefined) out['startMinute'] = input.startMinute;
    if (input.endMinute !== undefined) out['endMinute'] = input.endMinute;
    if (input.daysOfWeek !== undefined) out['daysOfWeek'] = input.daysOfWeek;
    if (input.activeFrom !== undefined) {
      out['activeFrom'] = input.activeFrom ? new Date(input.activeFrom) : null;
    }
    if (input.activeUntil !== undefined) {
      out['activeUntil'] = input.activeUntil
        ? new Date(input.activeUntil)
        : null;
    }
    return out;
  }
}

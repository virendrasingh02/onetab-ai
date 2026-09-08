import { ScheduledStatusRecurrence } from '@org/types';
import { z } from 'zod';

const minuteOfDay = z.number().int().min(0).max(1439);

const scheduledStatusFields = {
  label: z.string().trim().min(1, 'Add a name').max(80),
  statusText: z.string().trim().min(1, 'Add status text').max(100),
  statusEmoji: z.string().trim().max(32).nullable().optional(),
  presence: z
    .enum(['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'])
    .nullable()
    .optional(),
  isEnabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  recurrence: z.enum([
    ScheduledStatusRecurrence.ONE_TIME,
    ScheduledStatusRecurrence.DAILY,
    ScheduledStatusRecurrence.WEEKDAYS,
    ScheduledStatusRecurrence.WEEKLY,
  ]),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  startMinute: minuteOfDay.nullable().optional(),
  endMinute: minuteOfDay.nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  activeFrom: z.string().datetime().nullable().optional(),
  activeUntil: z.string().datetime().nullable().optional(),
  /** Defaults to the user's own timezone in the service when omitted. */
  timezone: z.string().trim().min(1).max(64).optional(),
};

export const createScheduledStatusSchema = z
  .object(scheduledStatusFields)
  .superRefine((val, ctx) => {
    if (val.recurrence === ScheduledStatusRecurrence.ONE_TIME) {
      if (!val.startAt || !val.endAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endAt'],
          message: 'A one-time status needs a start and end time.',
        });
      } else if (Date.parse(val.endAt) <= Date.parse(val.startAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endAt'],
          message: 'End time must be after the start.',
        });
      }
      return;
    }

    if (val.startMinute == null || val.endMinute == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endMinute'],
        message: 'A recurring status needs a start and end time of day.',
      });
    } else if (val.endMinute <= val.startMinute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endMinute'],
        message: 'End time must be after the start (no overnight windows).',
      });
    }

    if (
      val.recurrence === ScheduledStatusRecurrence.WEEKLY &&
      (!val.daysOfWeek || val.daysOfWeek.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysOfWeek'],
        message: 'Pick at least one day.',
      });
    }
  });

/**
 * Partial — supports a targeted edit (`{ isEnabled: false }`) as well as a full
 * form save. The service re-checks cross-field consistency on the merged row.
 */
export const updateScheduledStatusSchema = z
  .object(scheduledStatusFields)
  .partial();

export type CreateScheduledStatusInput = z.infer<
  typeof createScheduledStatusSchema
>;
export type UpdateScheduledStatusInput = z.infer<
  typeof updateScheduledStatusSchema
>;

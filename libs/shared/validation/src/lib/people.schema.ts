import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { z } from 'zod';

const visibility = z.enum(['PRIVATE', 'TEAM', 'WORKSPACE']);
const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) =>
  text(max)
    .transform((v) => (v.length ? v : null))
    .nullable();
const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .transform((tags) => [
    ...new Map(tags.map((t) => [t.toLowerCase(), t])).values(),
  ]);

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be an http(s) URL');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
      new Date(`${v}T00:00:00Z`).toISOString().startsWith(v),
    'Not a real date',
  );

/**
 * A real phone number with its country code, stored as E.164 (`+919876543210`).
 * Empty / null clears it; anything libphonenumber cannot validate is rejected.
 */
const phoneNumber = z
  .string()
  .trim()
  .max(32)
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const parsed = parsePhoneNumberFromString(v);
    if (!parsed?.isValid()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid phone number with its country code',
      });
      return z.NEVER;
    }
    return parsed.number;
  });

/** Fields an employee edits on their own profile. */
export const updateEmployeeProfileSchema = z
  .object({
    preferredName: nullableText(80),
    phone: phoneNumber,
    skills: tagList,
    interests: tagList,
    links: z.array(z.object({ label: text(40).min(1), url: httpUrl })).max(10),
    birthMonth: z.number().int().min(1).max(12).nullable(),
    birthDay: z.number().int().min(1).max(31).nullable(),
    birthYear: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .nullable(),
  })
  .partial()
  .superRefine((v, ctx) => {
    const hasM = v.birthMonth != null;
    const hasD = v.birthDay != null;
    if (hasM !== hasD) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDay'],
        message: 'Provide both month and day',
      });
      return;
    }
    if (hasM && hasD) {
      const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
        (v.birthMonth as number) - 1
      ];
      if ((v.birthDay as number) > max) {
        ctx.addIssue({
          code: 'custom',
          path: ['birthDay'],
          message: 'Not a real date',
        });
      }
    }
    if (v.birthYear != null && !hasM) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthYear'],
        message: 'Set a birthday first',
      });
    }
  });
export type UpdateEmployeeProfileInput = z.infer<
  typeof updateEmployeeProfileSchema
>;

/** HR/admin-managed employment information (MANAGE_MEMBERS). */
export const updateEmploymentSchema = z
  .object({
    department: nullableText(80),
    team: nullableText(80),
    joiningDate: isoDate.nullable(),
    leftAt: isoDate.nullable(),
  })
  .partial()
  .superRefine((v, ctx) => {
    if (v.joiningDate && v.leftAt && v.leftAt < v.joiningDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['leftAt'],
        message: 'Cannot be before the joining date',
      });
    }
  });
export type UpdateEmploymentInput = z.infer<typeof updateEmploymentSchema>;

export const updateEmployeePrivacySchema = z
  .object({
    birthday: visibility,
    hideBirthYear: z.boolean(),
    anniversary: visibility,
    contact: visibility,
  })
  .partial();
export type UpdateEmployeePrivacyInput = z.infer<
  typeof updateEmployeePrivacySchema
>;

export const updateCelebrationPrefsSchema = z
  .object({
    birthdays: z.boolean(),
    anniversaries: z.boolean(),
    daysBefore: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(3),
      z.literal(7),
    ]),
    profileReminders: z.boolean(),
    reminderEveryDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  })
  .partial();
export type UpdateCelebrationPrefsInput = z.infer<
  typeof updateCelebrationPrefsSchema
>;

export const employeeDirectoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  department: z.string().trim().max(80).optional(),
  team: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  skill: z.string().trim().max(40).optional(),
  sort: z.enum(['name', 'department', 'joined']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export type EmployeeDirectoryQuery = z.infer<
  typeof employeeDirectoryQuerySchema
>;

export const celebrationsQuerySchema = z.object({
  /** Window start, `YYYY-MM-DD`; defaults to the viewer's today. */
  from: isoDate.optional(),
  /** Window length in days. */
  days: z.coerce.number().int().min(1).max(366).default(60),
});
export type CelebrationsQuery = z.infer<typeof celebrationsQuerySchema>;

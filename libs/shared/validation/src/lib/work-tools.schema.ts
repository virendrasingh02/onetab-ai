import {
  DocumentKind,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from '@org/types';
import { z } from 'zod';
import { iconPatchShape } from './icon.schema.js';

/**
 * An ISO timestamp, left as a string.
 *
 * Deliberately not `.transform(v => new Date(v))`: a transform makes the
 * schema's input and output types diverge, which the auth schemas already
 * document as breaking React Hook Form's `control` generics. The service turns
 * these into `Date`s at the persistence boundary instead.
 */
const isoDate = z
  .string()
  .datetime({ offset: true, message: 'Enter a valid date' });

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

// --- projects ---------------------------------------------------------------

export const projectSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Project URL must be at least 2 characters')
  .max(48, 'Project URL must be at most 48 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens',
  );

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(80, 'Project name must be at most 80 characters'),
  slug: projectSlugSchema,
  description: optionalText(500),
  // Hex colour so the board can render a swatch without sanitising CSS.
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #3b82f6')
    .optional(),
  startDate: isoDate.optional(),
  targetDate: isoDate.optional(),
  // The create dialog picks an icon before the project exists, so it rides
  // along with creation rather than costing a second request.
  ...iconPatchShape,
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: optionalText(500),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #3b82f6')
    .optional(),
  status: z.enum(ProjectStatus).optional(),
  startDate: isoDate.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  ...iconPatchShape,
});

// --- tasks ------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'A task needs a title')
    .max(200, 'Title must be at most 200 characters'),
  description: optionalText(5000),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  projectId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(5000),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  projectId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

/**
 * A drag on the board: the card's new column and its position within it.
 *
 * Separate from `updateTaskSchema` because the board sends this on every drop
 * and must not be able to smuggle other field changes through that path.
 */
export const moveTaskSchema = z.object({
  status: z.enum(TaskStatus),
  orderIndex: z.number().int().min(0),
});

export const createTaskCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write a comment first')
    .max(5000, 'Comment must be at most 5000 characters'),
});

// --- calendar ---------------------------------------------------------------

export const createCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1, 'An event needs a title').max(200),
    description: optionalText(2000),
    location: optionalText(200),
    startAt: isoDate,
    endAt: isoDate,
    isAllDay: z.boolean().optional(),
  })
  .refine((event) => Date.parse(event.endAt) >= Date.parse(event.startAt), {
    message: 'The event must end after it starts',
    path: ['endAt'],
  });

export const updateCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalText(2000),
    location: optionalText(200),
    startAt: isoDate.optional(),
    endAt: isoDate.optional(),
    isAllDay: z.boolean().optional(),
  })
  .refine(
    (event) =>
      !event.startAt ||
      !event.endAt ||
      Date.parse(event.endAt) >= Date.parse(event.startAt),
    { message: 'The event must end after it starts', path: ['endAt'] },
  );

// --- documents --------------------------------------------------------------

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'A document needs a title').max(200),
  content: z.string().max(500_000).optional(),
  kind: z.enum(DocumentKind).optional(),
  parentId: z.string().nullable().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(500_000).optional(),
  parentId: z.string().nullable().optional(),
});

// --- whiteboards ------------------------------------------------------------

export const createWhiteboardSchema = z.object({
  name: z.string().trim().min(1, 'A whiteboard needs a name').max(120),
});

export const updateWhiteboardSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  /** Opaque canvas JSON; validated as parseable, not by shape. */
  canvasData: z
    .string()
    .max(2_000_000)
    .refine((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, 'Canvas data must be valid JSON')
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
export type CreateCalendarEventInput = z.infer<
  typeof createCalendarEventSchema
>;
export type UpdateCalendarEventInput = z.infer<
  typeof updateCalendarEventSchema
>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type CreateWhiteboardInput = z.infer<typeof createWhiteboardSchema>;
export type UpdateWhiteboardInput = z.infer<typeof updateWhiteboardSchema>;

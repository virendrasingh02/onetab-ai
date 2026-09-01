import {
  CustomFieldType,
  CycleStatus,
  DocumentKind,
  IdentifierPrefixMode,
  IntakeSource,
  ProjectHealth,
  ProjectStatus,
  RelationType,
  TaskPriority,
  TaskStatus,
  ViewType,
  WorkItemType,
} from '@org/types';
import { z } from 'zod';
import { iconPatchShape } from './icon.schema.js';

/**
 * An ISO timestamp, left as a string.
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
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #3b82f6')
    .optional(),
  startDate: isoDate.optional(),
  targetDate: isoDate.optional(),
  teamId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  initiativeId: z.string().nullable().optional(),
  ticketPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, 'Use 2–10 letters or digits, such as WEB')
    .optional(),
  identifierPrefixMode: z.enum(IdentifierPrefixMode).optional(),
  ...iconPatchShape,
});

export const columnOrderSchema = z
  .array(z.enum(TaskStatus))
  .refine(
    (order) => new Set(order).size === order.length,
    'A status can only appear once in the column order',
  )
  .refine(
    (order) => order.length === Object.keys(TaskStatus).length,
    'The column order must list every status',
  );

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: optionalText(500),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #3b82f6')
    .optional(),
  status: z.enum(ProjectStatus).optional(),
  health: z.enum(ProjectHealth).optional(),
  healthScore: z.number().int().min(0).max(100).nullable().optional(),
  startDate: isoDate.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  teamId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  initiativeId: z.string().nullable().optional(),
  columnOrder: columnOrderSchema.optional(),
  ticketPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, 'Use 2–10 letters or digits, such as WEB')
    .optional(),
  identifierPrefixMode: z.enum(IdentifierPrefixMode).optional(),
  ...iconPatchShape,
});

export const projectIdentifierSettingsSchema = z.object({
  ticketPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, 'Use 2–10 uppercase letters or digits')
    .optional(),
  identifierPrefixMode: z.enum(IdentifierPrefixMode).optional(),
  regenerate: z.boolean().optional(),
});

// --- teams ------------------------------------------------------------------

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Key must be uppercase alphanumeric'),
  description: optionalText(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ...iconPatchShape,
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  key: z.string().trim().toUpperCase().min(2).max(10).optional(),
  description: optionalText(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ...iconPatchShape,
});

// --- initiatives ------------------------------------------------------------

export const createInitiativeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  objective: optionalText(500),
  description: optionalText(2000),
  ownerId: z.string().nullable().optional(),
  status: z.enum(ProjectStatus).optional(),
  health: z.enum(ProjectHealth).optional(),
  priority: z.enum(TaskPriority).optional(),
  targetDate: isoDate.nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  projectIds: z.array(z.string()).optional(),
  ...iconPatchShape,
});

export const updateInitiativeSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  objective: optionalText(500),
  description: optionalText(2000),
  ownerId: z.string().nullable().optional(),
  status: z.enum(ProjectStatus).optional(),
  health: z.enum(ProjectHealth).optional(),
  priority: z.enum(TaskPriority).optional(),
  targetDate: isoDate.nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  projectIds: z.array(z.string()).optional(),
  ...iconPatchShape,
});

// --- epics ------------------------------------------------------------------

export const createEpicSchema = z.object({
  projectId: z.string(),
  name: z.string().trim().min(2).max(100),
  description: optionalText(2000),
  ownerId: z.string().nullable().optional(),
  status: z.enum(ProjectStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  targetDate: isoDate.nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateEpicSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: optionalText(2000),
  ownerId: z.string().nullable().optional(),
  status: z.enum(ProjectStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  targetDate: isoDate.nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// --- modules ----------------------------------------------------------------

export const createModuleSchema = z.object({
  projectId: z.string(),
  name: z.string().trim().min(2).max(100),
  description: optionalText(2000),
  leadId: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  status: z.enum(ProjectStatus).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateModuleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: optionalText(2000),
  leadId: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  status: z.enum(ProjectStatus).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// --- cycles / sprints -------------------------------------------------------

export const createCycleSchema = z.object({
  projectId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(100),
  description: optionalText(1000),
  goal: optionalText(500),
  startDate: isoDate,
  endDate: isoDate,
  status: z.enum(CycleStatus).optional(),
});

export const updateCycleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: optionalText(1000),
  goal: optionalText(500),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  status: z.enum(CycleStatus).optional(),
});

// --- tasks / work items -----------------------------------------------------

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(200, 'Task title must be at most 200 characters'),
  description: optionalText(10000),
  type: z.enum(WorkItemType).optional(),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  projectId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  reporterId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  epicId: z.string().nullable().optional(),
  cycleId: z.string().nullable().optional(),
  moduleId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  estimate: z.number().min(0).max(1000).nullable().optional(),
  labels: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(10000),
  type: z.enum(WorkItemType).optional(),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  projectId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  reporterId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  epicId: z.string().nullable().optional(),
  cycleId: z.string().nullable().optional(),
  moduleId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  estimate: z.number().min(0).max(1000).nullable().optional(),
  timeSpent: z.number().min(0).nullable().optional(),
  completedAt: isoDate.nullable().optional(),
  labels: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const moveTaskSchema = z.object({
  status: z.enum(TaskStatus),
  orderIndex: z.number().int().min(0),
});

export const createWorkItemRelationSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  type: z.enum(RelationType),
});

export const createTaskCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write a comment first')
    .max(5000, 'Comment must be at most 5000 characters'),
});

// --- custom fields ----------------------------------------------------------

export const createCustomFieldSchema = z.object({
  projectId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(50),
  key: z.string().trim().min(1).max(50),
  type: z.enum(CustomFieldType),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

// --- saved views ------------------------------------------------------------

export const createSavedViewSchema = z.object({
  projectId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(100),
  type: z.enum(ViewType),
  filters: z.record(z.string(), z.any()),
  sorting: z.record(z.string(), z.any()).optional(),
  grouping: z.record(z.string(), z.any()).optional(),
  visibleColumns: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

export const updateSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(ViewType).optional(),
  filters: z.record(z.string(), z.any()).optional(),
  sorting: z.record(z.string(), z.any()).optional(),
  grouping: z.record(z.string(), z.any()).optional(),
  visibleColumns: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

// --- intake / triage --------------------------------------------------------

export const createIntakeRequestSchema = z.object({
  teamId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: optionalText(5000),
  source: z.enum(IntakeSource).optional(),
  requesterName: optionalText(100),
  requesterEmail: z.string().email().nullable().optional(),
  priority: z.enum(TaskPriority).optional(),
  slaDueDate: isoDate.nullable().optional(),
});

export const convertIntakeRequestSchema = z.object({
  projectId: z.string(),
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(WorkItemType).optional(),
  priority: z.enum(TaskPriority).optional(),
  assigneeId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
});

// --- project updates --------------------------------------------------------

export const createProjectUpdateSchema = z.object({
  projectId: z.string(),
  status: z.enum(ProjectHealth),
  title: z.string().trim().min(1).max(150),
  body: optionalText(5000),
  completedSummary: optionalText(1000),
  inProgressSummary: optionalText(1000),
  blockersSummary: optionalText(1000),
  nextStepsSummary: optionalText(1000),
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
export type ProjectIdentifierSettingsInput = z.infer<
  typeof projectIdentifierSettingsSchema
>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;
export type UpdateInitiativeInput = z.infer<typeof updateInitiativeSchema>;
export type CreateEpicInput = z.infer<typeof createEpicSchema>;
export type UpdateEpicInput = z.infer<typeof updateEpicSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type CreateWorkItemRelationInput = z.infer<
  typeof createWorkItemRelationSchema
>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
export type CreateIntakeRequestInput = z.infer<typeof createIntakeRequestSchema>;
export type ConvertIntakeRequestInput = z.infer<
  typeof convertIntakeRequestSchema
>;
export type CreateProjectUpdateInput = z.infer<typeof createProjectUpdateSchema>;
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

import { z } from 'zod';

/** Call notes are free text; this bounds a pasted wall of text, not normal use. */
const NOTE_MAX = 50_000;

/** Only web links — a summary link must never become a `javascript:` href. */
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Links must start with http:// or https://');

export const startCallSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required.'),
  channelId: z.string().nullable().optional(),
  meetingId: z.string().nullable().optional(),
  title: z.string().trim().min(1, 'Title cannot be empty.').max(200),
  kind: z.enum(['AUDIO', 'VIDEO']).default('AUDIO'),
  /** The Matrix VoIP call id — both ends send the same one. */
  matrixCallId: z.string().min(1).max(255).optional(),
});

export type StartCallInput = z.infer<typeof startCallSchema>;
export type CreateCallInput = StartCallInput;
export interface EndCallInput {
  endedAt?: string;
  durationSeconds?: number;
}

/**
 * Renaming or attaching a recording. Ending a call is not a field edit — it
 * goes through `POST /calls/:id/end`, which also closes participation and
 * kicks off the summary.
 */
export const updateCallSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  recordingUrl: httpUrl.nullable().optional(),
});

export type UpdateCallInput = z.infer<typeof updateCallSchema>;

export const createCallNoteSchema = z.object({
  content: z.string().max(NOTE_MAX),
});

export type CreateCallNoteInput = z.infer<typeof createCallNoteSchema>;

export const updateCallNoteSchema = z.object({
  content: z.string().max(NOTE_MAX),
});

export type UpdateCallNoteInput = z.infer<typeof updateCallNoteSchema>;

/** `PUT /calls/:id/notes/mine` — each participant keeps one running note. */
export const upsertMyCallNoteSchema = z.object({
  content: z.string().max(NOTE_MAX),
});

export type UpsertMyCallNoteInput = z.infer<typeof upsertMyCallNoteSchema>;

export const generateCallSummarySchema = z.object({
  force: z.boolean().optional(),
});

export type GenerateCallSummaryInput = z.infer<typeof generateCallSummarySchema>;

/** Sections the summary stores as fields; decisions/action items regenerate with `all`. */
export const CALL_SUMMARY_SECTIONS = [
  'overview',
  'keyPoints',
  'openQuestions',
  'followUps',
] as const;

export const regenerateCallSummarySectionSchema = z.object({
  section: z.enum(['all', ...CALL_SUMMARY_SECTIONS]).default('all'),
  confirmOverwrite: z.boolean().default(false),
});

export type RegenerateCallSummarySectionInput = z.infer<
  typeof regenerateCallSummarySectionSchema
>;

export const updateCallSummarySchema = z.object({
  overview: z.string().max(10_000).nullable().optional(),
  keyPoints: z.array(z.string().max(1000)).max(100).optional(),
  openQuestions: z.array(z.string().max(1000)).max(100).optional(),
  followUps: z.array(z.string().max(1000)).max(100).optional(),
  importantLinks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        url: httpUrl,
      }),
    )
    .max(50)
    .optional(),
  rawContent: z.string().max(NOTE_MAX).nullable().optional(),
  /**
   * A person may mark the summary edited or approved. Processing / ready /
   * failed describe the generator and are only ever set by the server.
   */
  status: z.enum(['EDITED', 'APPROVED']).optional(),
});

export type UpdateCallSummaryInput = z.infer<typeof updateCallSummarySchema>;

export const callSummaryFeedbackSchema = z.object({
  rating: z.enum(['HELPFUL', 'NOT_HELPFUL']),
  feedback: z.string().max(1000).optional(),
});

export type CallSummaryFeedbackInput = z.infer<typeof callSummaryFeedbackSchema>;

export const shareCallSummarySchema = z
  .object({
    target: z.enum([
      'conversation',
      'participants',
      'workspace',
      'specific_users',
      'link',
    ]),
    userIds: z.array(z.string()).max(200).optional(),
    postMessageToChat: z.boolean().default(false),
  })
  .refine(
    (value) => value.target !== 'specific_users' || (value.userIds?.length ?? 0) > 0,
    { message: 'Choose at least one person to share with.', path: ['userIds'] },
  );

export type ShareCallSummaryInput = z.infer<typeof shareCallSummarySchema>;

export const createCallActionItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(300),
  description: z.string().max(5000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type CreateCallActionItemInput = z.infer<
  typeof createCallActionItemSchema
>;

export const updateCallActionItemSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(['TODO', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type UpdateCallActionItemInput = z.infer<
  typeof updateCallActionItemSchema
>;

export const createCallDecisionSchema = z.object({
  content: z.string().trim().min(1, 'Decision content is required.').max(500),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type CreateCallDecisionInput = z.infer<typeof createCallDecisionSchema>;

export const updateCallDecisionSchema = z.object({
  content: z.string().trim().min(1).max(500).optional(),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type UpdateCallDecisionInput = z.infer<typeof updateCallDecisionSchema>;

export const appendCallTranscriptSchema = z.object({
  items: z
    .array(
      z.object({
        speakerId: z.string().nullable().optional(),
        speakerName: z.string().trim().min(1).max(200),
        text: z.string().min(1).max(5000),
        timestamp: z.number().int().nonnegative().default(0),
      }),
    )
    .min(1)
    .max(200),
});

export type AppendCallTranscriptInput = z.infer<
  typeof appendCallTranscriptSchema
>;

export const callNotesAssistSchema = z.object({
  action: z.enum([
    'summarize',
    'cleanup',
    'extract_actions',
    'extract_decisions',
    'generate_followup',
    'format',
  ]),
  notes: z.string().min(1).max(NOTE_MAX),
});

export type CallNotesAssistInput = z.infer<typeof callNotesAssistSchema>;

export const askCallQuestionSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty.').max(1000),
});

export type AskCallQuestionInput = z.infer<typeof askCallQuestionSchema>;

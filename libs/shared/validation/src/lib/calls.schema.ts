import { z } from 'zod';

export const startCallSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required.'),
  channelId: z.string().nullable().optional(),
  meetingId: z.string().nullable().optional(),
  title: z.string().min(1, 'Title cannot be empty.').max(200),
  kind: z.enum(['AUDIO', 'VIDEO']).default('AUDIO'),
});

export type StartCallInput = z.infer<typeof startCallSchema>;
export type CreateCallInput = StartCallInput;
export interface EndCallInput {
  endedAt?: string;
  durationSeconds?: number;
}

export const updateCallSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'ENDED']).optional(),
  recordingUrl: z.string().url().nullable().optional(),
});

export type UpdateCallInput = z.infer<typeof updateCallSchema>;

export const createCallNoteSchema = z.object({
  content: z.string(),
});

export type CreateCallNoteInput = z.infer<typeof createCallNoteSchema>;

export const updateCallNoteSchema = z.object({
  content: z.string(),
});

export type UpdateCallNoteInput = z.infer<typeof updateCallNoteSchema>;

export const generateCallSummarySchema = z.object({
  force: z.boolean().optional(),
});

export type GenerateCallSummaryInput = z.infer<typeof generateCallSummarySchema>;

export const regenerateCallSummarySectionSchema = z.object({
  section: z
    .enum([
      'all',
      'overview',
      'keyPoints',
      'decisions',
      'actionItems',
      'openQuestions',
      'followUps',
    ])
    .default('all'),
  confirmOverwrite: z.boolean().default(false),
});

export type RegenerateCallSummarySectionInput = z.infer<
  typeof regenerateCallSummarySectionSchema
>;

export const updateCallSummarySchema = z.object({
  overview: z.string().nullable().optional(),
  keyPoints: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
  followUps: z.array(z.string()).optional(),
  importantLinks: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  rawContent: z.string().nullable().optional(),
  status: z
    .enum(['PROCESSING', 'READY', 'FAILED', 'EDITED', 'APPROVED'])
    .optional(),
});

export type UpdateCallSummaryInput = z.infer<typeof updateCallSummarySchema>;

export const callSummaryFeedbackSchema = z.object({
  rating: z.enum(['HELPFUL', 'NOT_HELPFUL']),
  feedback: z.string().max(1000).optional(),
});

export type CallSummaryFeedbackInput = z.infer<typeof callSummaryFeedbackSchema>;

export const shareCallSummarySchema = z.object({
  target: z.enum([
    'conversation',
    'participants',
    'workspace',
    'specific_users',
    'link',
  ]),
  userIds: z.array(z.string()).optional(),
  postMessageToChat: z.boolean().default(false),
});

export type ShareCallSummaryInput = z.infer<typeof shareCallSummarySchema>;

export const createCallActionItemSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(300),
  description: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type CreateCallActionItemInput = z.infer<
  typeof createCallActionItemSchema
>;

export const updateCallActionItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
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
  content: z.string().min(1, 'Decision content is required.').max(500),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type CreateCallDecisionInput = z.infer<typeof createCallDecisionSchema>;

export const updateCallDecisionSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  sourceTimestamp: z.number().int().nonnegative().nullable().optional(),
});

export type UpdateCallDecisionInput = z.infer<typeof updateCallDecisionSchema>;

export const appendCallTranscriptSchema = z.object({
  items: z.array(
    z.object({
      speakerId: z.string().nullable().optional(),
      speakerName: z.string().min(1),
      text: z.string().min(1),
      timestamp: z.number().int().nonnegative().default(0),
    }),
  ),
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
  notes: z.string(),
});

export type CallNotesAssistInput = z.infer<typeof callNotesAssistSchema>;

export const askCallQuestionSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty.').max(1000),
});

export type AskCallQuestionInput = z.infer<typeof askCallQuestionSchema>;

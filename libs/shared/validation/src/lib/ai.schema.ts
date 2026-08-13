import { z } from 'zod';

/**
 * The prompt library.
 *
 * `promptText` is generous but bounded: a template is a starting point someone
 * pastes a document into, not the document itself, and an unbounded text column
 * behind a workspace-writable route is a storage-exhaustion surface.
 */
export const createPromptTemplateSchema = z.object({
  title: z.string().trim().min(1, 'A template needs a title').max(120),
  category: z.string().trim().min(1).max(60).optional(),
  promptText: z
    .string()
    .trim()
    .min(1, 'A template needs prompt text')
    .max(10_000),
});

export const updatePromptTemplateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  promptText: z.string().trim().min(1).max(10_000).optional(),
});

export type CreatePromptTemplateInput = z.infer<
  typeof createPromptTemplateSchema
>;
export type UpdatePromptTemplateInput = z.infer<
  typeof updatePromptTemplateSchema
>;

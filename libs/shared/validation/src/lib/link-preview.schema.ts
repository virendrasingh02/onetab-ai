import { z } from 'zod';

export const fetchLinkPreviewSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .max(2048, 'URL must not exceed 2048 characters')
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'URL must start with http:// or https://' },
    ),
});

export type FetchLinkPreviewInput = z.infer<typeof fetchLinkPreviewSchema>;

export const updateMessageLinkPreviewSchema = z.object({
  visibility: z.enum(['visible', 'hidden', 'removed']),
  previewId: z.string().optional(),
});

export type UpdateMessageLinkPreviewInput = z.infer<
  typeof updateMessageLinkPreviewSchema
>;

export const updateLinkPreviewPreferenceSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateLinkPreviewPreferenceInput = z.infer<
  typeof updateLinkPreviewPreferenceSchema
>;

export const updateLinkPreviewPolicySchema = z.object({
  policy: z.enum(['ENABLED', 'OPTIONAL', 'DISABLED']),
});

export type UpdateLinkPreviewPolicyInput = z.infer<
  typeof updateLinkPreviewPolicySchema
>;

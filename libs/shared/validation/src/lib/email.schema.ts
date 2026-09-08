import { z } from 'zod';

/** `PUT .../channels/:id/email` — workspace admin only. */
export const updateChannelEmailSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  threadPerSubject: z.boolean().optional(),
});

/**
 * Inbound-email webhook body. Providers differ (Postmark, Mailgun, SendGrid),
 * so this is lenient — the service normalises. Only `To` (or `recipient`) and
 * some form of body are actually required.
 */
export const inboundEmailSchema = z
  .object({
    From: z.string().optional(),
    FromName: z.string().optional(),
    FromFull: z.object({ Email: z.string(), Name: z.string().optional() }).optional(),
    To: z.string().optional(),
    ToFull: z.array(z.object({ Email: z.string() })).optional(),
    recipient: z.string().optional(),
    sender: z.string().optional(),
    Subject: z.string().optional(),
    subject: z.string().optional(),
    TextBody: z.string().optional(),
    'body-plain': z.string().optional(),
    'stripped-text': z.string().optional(),
    text: z.string().optional(),
    HtmlBody: z.string().optional(),
    MessageID: z.string().optional(),
    'Message-Id': z.string().optional(),
    'message-id': z.string().optional(),
    Headers: z
      .array(z.object({ Name: z.string(), Value: z.string() }))
      .optional(),
    'In-Reply-To': z.string().optional(),
    References: z.string().optional(),
    Attachments: z
      .array(z.object({ Name: z.string().optional() }).passthrough())
      .optional(),
    attachments: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type UpdateChannelEmailSettingsInput = z.infer<
  typeof updateChannelEmailSettingsSchema
>;
export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;

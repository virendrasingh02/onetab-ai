import { z } from 'zod';

export const agentDeploymentTargetSchema = z.enum([
  'WIDGET',
  'INLINE_WIDGET',
  'JS_EMBED',
  'IFRAME',
  'WEB_COMPONENT',
  'REACT',
  'REST_API',
  'HEADLESS',
  'WEBHOOK',
  'PLATFORM_APP',
  'ELECTRON_DESKTOP',
]);

export const agentDeploymentEnvironmentSchema = z.enum([
  'DEVELOPMENT',
  'STAGING',
  'PRODUCTION',
]);

export const agentDeploymentStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'DEPRECATED',
]);

export const createAgentDeploymentSchema = z.object({
  name: z.string().min(1).max(100).default('Production Deployment'),
  environment: agentDeploymentEnvironmentSchema.default('PRODUCTION'),
  target: agentDeploymentTargetSchema.default('WIDGET'),
  versionNumber: z.number().int().positive().optional(),
  allowedOrigins: z.array(z.string()).default([]),
  widgetConfig: z.record(z.string(), z.unknown()).default({}),
  securityConfig: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const updateAgentDeploymentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  environment: agentDeploymentEnvironmentSchema.optional(),
  status: agentDeploymentStatusSchema.optional(),
  versionNumber: z.number().int().positive().optional(),
  target: agentDeploymentTargetSchema.optional(),
  allowedOrigins: z.array(z.string()).optional(),
  widgetConfig: z.record(z.string(), z.unknown()).optional(),
  securityConfig: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** `ot_vis_` and 48 hex characters, as the server issues them. */
export const VISITOR_KEY = /^ot_vis_[a-f0-9]{48}$/;

export const initAgentSessionSchema = z.object({
  publicKey: z.string().min(1),
  agentId: z.string().optional(),
  /** The site framing the iframe embed, when the browser's own Origin is the API. */
  embedOrigin: z.string().max(300).optional(),
  userContext: z.record(z.string(), z.unknown()).default({}),
  /** The browser's anonymous visitor key, so its earlier conversations stay reachable. */
  visitorKey: z.string().regex(VISITOR_KEY).optional(),
  /** Pick up this conversation of the same visitor instead of starting a new one. */
  resumeSessionId: z.string().min(1).max(64).optional(),
});

export const sendSessionMessageSchema = z
  .object({
    message: z.string().max(8000).default(''),
    /** Files uploaded to this session with `POST /agent-sessions/:id/attachments`. */
    attachmentIds: z.array(z.string().min(1).max(64)).max(5).default([]),
    context: z.record(z.string(), z.unknown()).optional(),
    stream: z.boolean().optional().default(false),
  })
  .refine((v) => v.message.trim().length > 0 || v.attachmentIds.length > 0, {
    message: 'A message or an attachment is required.',
    path: ['message'],
  });

export const executeHeadlessAgentSchema = z.object({
  prompt: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional().default(false),
  deploymentId: z.string().optional(),
  versionNumber: z.number().int().positive().optional(),
});

export const approveActionSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
  modifiedParameters: z.record(z.string(), z.unknown()).optional(),
});

export const rollbackDeploymentSchema = z.object({
  targetVersion: z.number().int().positive(),
  summary: z.string().optional(),
});

export const createAgentDeploymentWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8).optional(),
  events: z.array(z.string()).default([
    'agent.run.completed',
    'agent.run.failed',
    'agent.approval.requested',
  ]),
});

export const createAgentApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(['agent:read', 'agent:execute']),
  expiresInDays: z.number().int().positive().optional(),
});

export type CreateAgentDeploymentInput = z.infer<typeof createAgentDeploymentSchema>;
export type UpdateAgentDeploymentInput = z.infer<typeof updateAgentDeploymentSchema>;
export type InitAgentSessionInput = z.infer<typeof initAgentSessionSchema>;
export type SendSessionMessageInput = z.infer<typeof sendSessionMessageSchema>;
export type ExecuteHeadlessAgentInput = z.infer<typeof executeHeadlessAgentSchema>;
export type ApproveActionInput = z.infer<typeof approveActionSchema>;
export type RollbackDeploymentInput = z.infer<typeof rollbackDeploymentSchema>;
export type CreateAgentDeploymentWebhookInput = z.infer<typeof createAgentDeploymentWebhookSchema>;
export type CreateAgentApiKeyInput = z.infer<typeof createAgentApiKeySchema>;

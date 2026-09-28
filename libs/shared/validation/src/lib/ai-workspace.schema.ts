import { z } from 'zod';

/**
 * Request bodies for the AI Workspace — agents, coworkers, workflows, runs,
 * approvals, knowledge, secrets and MCP connections.
 *
 * These routes took untyped `@Body()` objects, so a wrong type (an object for
 * `name`, a string for `tools`) reached Prisma and surfaced as a 500, and
 * nothing bounded how much text a workspace member could store. Every schema
 * here is an allow-list: `z.object` strips unknown keys, so a body cannot set
 * a column the route does not mean to expose.
 */

const text = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(64);
const record = z.record(z.string(), z.unknown());

/** A serialized React Flow graph. Generous, but a canvas is not a database. */
const graphJson = z.string().max(1_000_000, 'This graph is too large to save.');
const toolNames = z.array(text(120).min(1)).max(100);
/** Avatars may arrive as data URLs (see `pushUserProfile`); cap the payload. */
const avatarUrl = z.string().max(2_000_000).nullable();

/* --------------------------------------------------------------- agents ---- */

const agentFields = {
  name: text(120).min(1, 'Give the agent a name.'),
  role: text(120),
  description: text(2_000),
  avatarUrl,
  systemPrompt: z.string().max(50_000),
  welcomeMessage: z.string().max(4_000),
  provider: text(60),
  model: text(200),
  tools: toolNames,
  graphJson,
};

export const createAgentSchema = z.object({
  ...agentFields,
  role: agentFields.role.optional(),
  description: agentFields.description.optional(),
  avatarUrl: agentFields.avatarUrl.optional(),
  systemPrompt: agentFields.systemPrompt.optional(),
  welcomeMessage: agentFields.welcomeMessage.optional(),
  provider: agentFields.provider.optional(),
  model: agentFields.model.optional(),
  tools: agentFields.tools.optional(),
  graphJson: agentFields.graphJson.optional(),
  isMarketplace: z.boolean().optional(),
});

export const updateAgentSchema = createAgentSchema
  .omit({ isMarketplace: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

/* ------------------------------------------------- agents + coworkers ------ */

export const coworkerPermissionsSchema = z.object({
  knowledgeAccess: z.boolean().optional(),
  allowActions: toolNames.optional(),
  projectIds: z.array(id).max(200).optional(),
  channelIds: z.array(id).max(200).optional(),
});

const coworkerFields = {
  personality: z.string().max(4_000).optional(),
  systemInstructions: z.string().max(50_000).optional(),
  permissions: coworkerPermissionsSchema.optional(),
  configuration: record.optional(),
};

export const createCoworkerSchema = z.object({
  name: agentFields.name,
  role: agentFields.role.optional(),
  description: agentFields.description.optional(),
  avatarUrl: agentFields.avatarUrl.optional(),
  welcomeMessage: agentFields.welcomeMessage.optional(),
  provider: agentFields.provider.optional(),
  model: agentFields.model.optional(),
  ...coworkerFields,
  agentIds: z.array(id).max(50).optional(),
  integrationIds: z.array(id).max(50).optional(),
});

export const updateCoworkerSchema = z.object({
  name: agentFields.name.optional(),
  role: agentFields.role.optional(),
  description: agentFields.description.optional(),
  avatarUrl: agentFields.avatarUrl.optional(),
  welcomeMessage: agentFields.welcomeMessage.optional(),
  provider: agentFields.provider.optional(),
  model: agentFields.model.optional(),
  isActive: z.boolean().optional(),
  ...coworkerFields,
});

export const createAIEntitySchema = createCoworkerSchema.extend({
  type: z.enum(['agent', 'coworker']),
  systemPrompt: agentFields.systemPrompt.optional(),
  tools: agentFields.tools.optional(),
  graphJson: agentFields.graphJson.optional(),
  isMarketplace: z.boolean().optional(),
});

export const updateAIEntitySchema = updateCoworkerSchema.extend({
  systemPrompt: agentFields.systemPrompt.optional(),
  tools: agentFields.tools.optional(),
  graphJson: agentFields.graphJson.optional(),
  status: z.enum(['AVAILABLE', 'WORKING', 'IDLE', 'RUNNING_TASK', 'ERROR']).optional(),
});

export const executeAIEntitySchema = z.object({
  promptText: z.string().trim().min(1, 'Say what the agent should do.').max(20_000),
  channelId: id.optional(),
  channelName: text(120).optional(),
  projectId: id.optional(),
  projectName: text(200).optional(),
});

export const agentTestRunSchema = z.object({
  input: record.optional(),
  message: z.string().max(20_000).optional(),
  prompt: z.string().max(20_000).optional(),
});

export const agentVersionSchema = z.object({
  summary: text(500).optional(),
});

export const validateAgentGraphSchema = z.object({
  graphJson: graphJson.optional(),
});

/** Five or six space-separated cron fields; semantics are checked when run. */
const cronExpression = z
  .string()
  .trim()
  .regex(/^(\S+\s+){4,5}\S+$/, 'Use a cron expression such as "0 9 * * 1-5".')
  .max(120);

export const createAgentScheduleSchema = z.object({
  cronExpression,
  description: text(500).optional(),
});

export const updateAgentScheduleSchema = z.object({
  cronExpression: cronExpression.optional(),
  description: text(500).optional(),
  isActive: z.boolean().optional(),
});

export const linkAgentSchema = z.object({ agentId: id });
export const linkIntegrationSchema = z.object({ integrationId: id });
export const linkCoworkerSchema = z.object({ coworkerId: id });
export const setEnabledSchema = z.object({ isEnabled: z.boolean() });

/* ------------------------------------------------------------ workflows ---- */

const workflowFields = {
  name: text(160).min(1, 'Give the workflow a name.'),
  description: text(2_000),
  /** WEBHOOK, MANUAL, CRON, CHAT — or a workspace event name such as `task.created`. */
  triggerType: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_.]{1,60}$/, 'Unknown trigger type.'),
  nodesJson: graphJson,
  edgesJson: graphJson,
};

export const createWorkflowSchema = z.object({
  name: workflowFields.name,
  description: workflowFields.description.optional(),
  triggerType: workflowFields.triggerType.optional(),
  nodesJson: workflowFields.nodesJson.optional(),
  edgesJson: workflowFields.edgesJson.optional(),
  /** Templates start paused until someone fills in their steps. */
  isActive: z.boolean().optional(),
});

export const updateWorkflowSchema = z.object({
  name: workflowFields.name.optional(),
  description: workflowFields.description.optional(),
  triggerType: workflowFields.triggerType.optional(),
  nodesJson: workflowFields.nodesJson.optional(),
  edgesJson: workflowFields.edgesJson.optional(),
  isActive: z.boolean().optional(),
});

/** A trigger payload is caller data by design; only its size is bounded. */
export const triggerWorkflowSchema = record.refine(
  (value) => JSON.stringify(value).length <= 200_000,
  'This payload is too large.',
);

/* ----------------------------------------------------------------- runs ---- */

/** Query-string filters arrive as strings; numbers are coerced and bounded. */
export const aiExecutionFilterSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_APPROVAL']).optional(),
  entityType: z.enum(['WORKFLOW', 'AGENT', 'COWORKER', 'APP']).optional(),
  entityId: id.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
});

/* ------------------------------------------------------------ approvals ---- */

export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: text(2_000).optional(),
  revisedPayload: record.optional(),
});

/* ---------------------------------------------------- secrets and tools ---- */

export const createAISecretSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Use letters, numbers and underscores, e.g. FIRECRAWL_API_KEY.'),
  value: z.string().min(1, 'A secret needs a value.').max(8_192),
  description: text(500).optional(),
});

export const createMCPConnectionSchema = z.object({
  name: text(80).min(1, 'Name this connection.'),
  serverUrl: z.string().trim().url('Enter the server URL, e.g. https://mcp.example.com/mcp').max(2_000),
  transport: z.enum(['HTTP', 'SSE']).optional(),
  token: z.string().trim().max(8_192).optional(),
});

export const testMcpToolSchema = z.object({
  toolName: text(120).min(1),
  params: record.optional().default({}),
});

/* --------------------------------------------------- provider settings ---- */

export const saveProviderCredentialSchema = z.object({
  apiKey: z.string().trim().max(8_192).optional(),
  baseUrl: z.union([z.string().trim().url().max(2_000), z.literal('')]).optional(),
  defaultModel: text(200).optional(),
  enabled: z.boolean().optional(),
});

export const updateModelSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

/* ------------------------------------------------------------ knowledge ---- */

export const createKnowledgeBaseSchema = z.object({
  name: text(120).min(1, 'Give the knowledge base a name.'),
  description: text(2_000).optional(),
  icon: text(60).optional(),
  embeddingModel: text(120).optional(),
});

export const updateKnowledgeBaseSchema = createKnowledgeBaseSchema.partial();

export const ingestKnowledgeDocumentSchema = z.object({
  name: text(200).min(1),
  sourceType: z.enum(['FILE', 'URL', 'WORKSPACE', 'MANUAL']),
  sourceUri: z.string().trim().max(2_000).optional(),
  rawText: z.string().max(2_000_000).optional(),
  mimeType: text(120).optional(),
  metadata: record.optional(),
});

export const updateKnowledgeChunkSchema = z.object({
  content: z.string().trim().min(1).max(50_000),
});

export const knowledgeRetrievalSchema = z.object({
  query: z.string().trim().min(1).max(4_000),
  topK: z.number().int().min(1).max(50).optional(),
  mode: z.enum(['SEMANTIC', 'KEYWORD', 'HYBRID']).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
  filters: record.optional(),
});

/* -------------------------------------------------------------- AI apps ---- */

const aiAppFields = {
  name: text(120).min(1),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes.'),
  description: text(2_000),
  icon: text(60),
  appType: z.enum(['CHAT_APP', 'WORKFLOW_APP', 'AGENT_APP', 'CUSTOM_UI']),
  visibility: z.enum(['PRIVATE', 'WORKSPACE', 'PUBLIC']),
  agentId: id,
  workflowId: id,
  promptTemplateId: id,
  config: record,
};

export const createAIAppSchema = z.object({
  name: aiAppFields.name,
  appType: aiAppFields.appType,
  slug: aiAppFields.slug.optional(),
  description: aiAppFields.description.optional(),
  icon: aiAppFields.icon.optional(),
  visibility: aiAppFields.visibility.optional(),
  agentId: aiAppFields.agentId.optional(),
  workflowId: aiAppFields.workflowId.optional(),
  promptTemplateId: aiAppFields.promptTemplateId.optional(),
  config: aiAppFields.config.optional(),
});

export const updateAIAppSchema = createAIAppSchema.partial();

export const publishAIAppSchema = z.object({ isPublished: z.boolean() });

/* ------------------------------------------------------- studio helpers ---- */

export const aiQuickCreateSchema = z.object({
  name: text(120).min(1),
  type: z.enum(['agent', 'coworker', 'workflow', 'app']),
  description: text(2_000).optional(),
});

export const aiFeedbackSchema = z.object({
  executionId: id.optional(),
  agentId: id.optional(),
  workflowId: id.optional(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: text(2_000).optional(),
  issueCategory: text(60).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type CreateCoworkerInput = z.infer<typeof createCoworkerSchema>;
export type UpdateCoworkerInput = z.infer<typeof updateCoworkerSchema>;
export type CreateAIEntityInput = z.infer<typeof createAIEntitySchema>;
export type UpdateAIEntityInput = z.infer<typeof updateAIEntitySchema>;
export type ExecuteAIEntityInput = z.infer<typeof executeAIEntitySchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

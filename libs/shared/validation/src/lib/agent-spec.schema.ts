import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(64);
const record = z.record(z.string(), z.unknown());

export const agentCategorySchema = z.enum([
  'integration_agent',
  'workflow_agent',
  'knowledge_agent',
  'research_agent',
  'productivity_agent',
  'communication_agent',
  'coding_agent',
  'business_agent',
  'personal_agent',
  'custom_agent',
  'multi_agent',
]);

export const agentBuilderStateSchema = z.enum([
  'IDLE',
  'INTAKE',
  'UNDERSTAND',
  'REQUIREMENTS',
  'AGENT_PLAN',
  'PLAN_REVIEW',
  'BUILDING',
  'TESTING',
  'PREVIEW',
  'PUBLISH_REVIEW',
  'PUBLISHED',
  'ITERATING',
  'PAUSED',
  'ERROR',
  'CANCELLED',
]);

export const intentClassificationSchema = z.object({
  intent: z.enum(['create_agent', 'modify_agent', 'chat_with_agent', 'unknown']),
  category: agentCategorySchema,
  integration: text(120).nullable().optional(),
  agentic: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: text(1000).optional(),
  suggestedName: text(120).optional(),
  suggestedRole: text(120).optional(),
});

export const dynamicQuestionOptionSchema = z.object({
  label: text(200),
  value: text(200),
  description: text(500).optional(),
  isRecommended: z.boolean().optional(),
});

export const dynamicQuestionSchema = z.object({
  id: id,
  label: text(300),
  description: text(1000).optional(),
  type: z.enum(['single-select', 'multi-select', 'toggle', 'text']),
  options: z.array(dynamicQuestionOptionSchema).optional(),
  default: z.unknown().optional(),
  required: z.boolean(),
  group: text(100),
});

export const planStepSchema = z.object({
  id: id,
  title: text(200),
  description: text(1000),
  type: z.enum([
    'integration',
    'tool',
    'workflow',
    'memory',
    'permission',
    'prompt',
    'test',
    'publish',
  ]),
  dependencies: z.array(id),
  status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
  error: text(1000).optional(),
  details: record.optional(),
});

export const agentPlanSchema = z.object({
  steps: z.array(planStepSchema),
  overview: text(2000).optional(),
});

export const agentSpecToolRefSchema = z.object({
  id: id,
  name: text(120),
  description: text(1000).optional(),
  category: text(100).optional(),
  integration: text(100).optional(),
  permissionLevel: z.enum(['read', 'write', 'admin']).optional(),
  requiresConfirmation: z.boolean().optional(),
  inputSchema: record.optional(),
  outputSchema: record.optional(),
  enabled: z.boolean(),
});

export const agentSpecIntegrationRefSchema = z.object({
  provider: text(100),
  connectionId: id.optional(),
  requiredScopes: z.array(text(200)).optional(),
  status: z.enum(['connected', 'disconnected', 'needs_auth']).optional(),
});

export const agentSpecWorkflowRefSchema = z.object({
  id: id,
  name: text(150),
  trigger: text(100),
  stepsCount: z.number().int().nonnegative(),
  graphJson: z.string().max(1_000_000).optional(),
});

export const agentSpecTriggerRefSchema = z.object({
  type: z.enum([
    'manual',
    'chat',
    'schedule',
    'webhook',
    'event',
    'integration_event',
    'agent_delegation',
  ]),
  config: record.optional(),
});

export const agentSpecUIConfigSchema = z.object({
  icon: text(60).optional(),
  theme: text(60).optional(),
  avatarUrl: z.string().max(2_000_000).nullable().optional(),
  suggestedPrompts: z.array(text(300)).optional(),
  welcomeMessage: text(2000).optional(),
});

export const agentSpecSchema = z.object({
  id: id,
  workspaceId: id,
  name: text(120).min(1, 'Agent name is required'),
  description: text(2000).optional(),
  type: z.enum(['agent', 'coworker']),
  role: text(120),
  category: agentCategorySchema,

  instructions: z.object({
    systemPrompt: z.string().max(50_000),
    systemInstructions: z.string().max(50_000).optional(),
    personality: z.string().max(4_000).optional(),
  }),

  model: z.object({
    provider: text(60),
    model: text(200),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }),

  tools: z.array(agentSpecToolRefSchema),
  integrations: z.array(agentSpecIntegrationRefSchema),

  memory: z.object({
    useWorkspaceMemory: z.boolean(),
    conversationMemory: z.boolean(),
    userPreferences: z.boolean(),
  }),

  knowledge: z.object({
    knowledgeBaseIds: z.array(id),
    retrievalMode: z.enum(['SEMANTIC', 'KEYWORD', 'HYBRID']).optional(),
    topK: z.number().int().min(1).max(20).optional(),
  }),

  permissions: z.object({
    role: z.enum(['owner', 'editor', 'user', 'viewer']),
    toolPolicies: z.record(
      z.string(),
      z.object({
        requiresApproval: z.boolean().optional(),
        allowedRoles: z.array(z.string()).optional(),
      }),
    ),
    channelIds: z.array(id).optional(),
    projectIds: z.array(id).optional(),
  }),

  guardrails: z.object({
    pii: z.enum(['redact', 'block', 'warn']).optional(),
    maxTokensPerRun: z.number().int().positive().optional(),
    contentFilters: z.array(text(200)).optional(),
  }),

  workflows: z.array(agentSpecWorkflowRefSchema),
  triggers: z.array(agentSpecTriggerRefSchema),

  inputSchema: record.optional(),
  outputSchema: record.optional(),

  ui: agentSpecUIConfigSchema,

  version: z.number().int().min(1),
  status: z.enum(['draft', 'testing', 'published', 'paused', 'archived']),
});

export const agentDiffItemSchema = z.object({
  type: z.enum(['added', 'removed', 'modified', 'unchanged']),
  component: z.enum([
    'tool',
    'workflow',
    'prompt',
    'permission',
    'integration',
    'memory',
    'guardrail',
  ]),
  name: text(120),
  description: text(500),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});

export const agentIterationDiffSchema = z.object({
  userRequest: text(2000),
  impactSummary: text(2000),
  changes: z.array(agentDiffItemSchema),
  appliedSpec: agentSpecSchema,
});

export const agentBuilderRunEventSchema = z.object({
  runId: id,
  timestamp: z.number(),
  type: z.enum([
    'state_changed',
    'assistant_message',
    'question',
    'plan',
    'step_started',
    'tool_started',
    'tool_result',
    'step_done',
    'step_failed',
    'approval_required',
    'preview_ready',
    'error',
    'done',
  ]),
  payload: record,
});

export const aiModeIntakeRequestSchema = z.object({
  prompt: text(4000).min(3, 'Please describe the agent you want to create.'),
  existingAgentId: id.optional(),
});

export const aiModeRequirementsAnswersSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  useRecommendedDefaults: z.boolean().optional(),
});

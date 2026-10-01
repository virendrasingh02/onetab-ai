import { z } from 'zod';

/**
 * Request bodies for the AI Agent Studio: planning an agent from a sentence,
 * saving its blueprint, and running it. The blueprint schema is also how the
 * planner's model output is checked — anything the model returns that does not
 * fit is rejected rather than stored.
 */

const text = (max: number) => z.string().trim().max(max);
const stepId = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9_]*$/, 'Step ids are lower-case letters, digits and underscores.');

export const agentKindSchema = z.enum([
  'assistant',
  'task',
  'workflow',
  'research',
  'automation',
  'monitoring',
  'project',
  'personal',
  'team',
  'coworker',
  'builder',
  'supervisor',
]);

export const agentScopeSchema = z.union([
  z.enum([
    'tasks:read',
    'tasks:write',
    'projects:read',
    'docs:read',
    'docs:write',
    'meetings:read',
    'activity:read',
    'channels:read',
    'chat:send',
    'notify:send',
    'memory:read',
    'memory:write',
    'web:read',
    'agents:run',
  ]),
  z.string().regex(/^app:[a-z0-9_]{1,40}:(read|write)$/),
]);

export const agentEventSchema = z.enum([
  'task.created',
  'task.assigned',
  'task.completed',
  'task.overdue',
  'project.created',
  'project.updated',
  'document.created',
  'document.updated',
  'meeting.ended',
  'channel.message',
]);

const cronSchema = z
  .string()
  .trim()
  .max(120)
  .refine((v) => v.split(/\s+/).length === 5, 'A schedule has five parts: minute hour day month weekday.');

export const agentTriggerSchema = z.object({
  kind: z.enum(['manual', 'schedule', 'event']),
  cron: cronSchema.optional(),
  timezone: text(64).optional(),
  event: agentEventSchema.optional(),
  filter: z
    .object({ channelId: text(64).optional(), projectId: text(64).optional() })
    .optional(),
});

export const agentStepSchema = z.object({
  id: stepId,
  kind: z.enum(['collect', 'analyze', 'generate', 'action', 'approval', 'notify', 'condition', 'delegate']),
  title: text(160).min(1, 'Every step needs a title.'),
  why: text(500).optional(),
  tool: text(120).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  prompt: text(8_000).optional(),
  uses: z.array(stepId).max(20).optional(),
  condition: text(300).optional(),
  agentId: text(64).optional(),
  requiresApproval: z.boolean().optional(),
  onFailure: z.enum(['retry', 'continue', 'stop']).optional(),
  retries: z.number().int().min(0).max(5).optional(),
});

export const agentBlueprintSchema = z
  .object({
    version: z.literal(1),
    name: text(120).min(1, 'Give the agent a name.'),
    kind: agentKindSchema,
    objective: text(1_000),
    instructions: text(4_000).optional(),
    trigger: agentTriggerSchema,
    context: z.array(text(200)).max(20),
    steps: z.array(agentStepSchema).max(25, 'Keep an agent to 25 steps; split longer processes.'),
    output: z.object({
      format: z.enum(['report', 'todo_list', 'summary', 'answer', 'draft', 'tasks', 'alert']),
      destination: z.enum(['run', 'doc', 'channel', 'notification']),
      channelSlug: text(120).optional(),
      docTitle: text(200).optional(),
      fromStep: stepId.optional(),
    }),
    params: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
          label: text(120).min(1),
          type: z.enum(['project', 'channel', 'text', 'doc']),
          value: text(2_000).optional(),
          required: z.boolean().optional(),
          hint: text(300).optional(),
        }),
      )
      .max(10),
    scopes: z.array(agentScopeSchema).max(40),
    notify: z.object({ onComplete: z.boolean(), onFailure: z.boolean(), onApproval: z.boolean() }),
    questions: z
      .array(
        z.object({
          id: text(60).min(1),
          question: text(300).min(1),
          paramKey: text(40).optional(),
          field: z
            .enum(['output.channelSlug', 'trigger.cron', 'trigger.filter.channelId', 'trigger.filter.projectId'])
            .optional(),
        }),
      )
      .max(10),
    assumptions: z.array(text(300)).max(10),
    warnings: z.array(text(400)).max(10),
    source: z.object({
      kind: z.enum(['ai', 'template', 'manual']),
      prompt: text(4_000).optional(),
      templateId: text(60).optional(),
      model: text(200).optional(),
      fallbackReason: text(400).optional(),
    }),
  })
  .superRefine((bp, ctx) => {
    const ids = new Set<string>();
    bp.steps.forEach((step, index) => {
      if (ids.has(step.id)) {
        ctx.addIssue({ code: 'custom', path: ['steps', index, 'id'], message: `Two steps share the id “${step.id}”.` });
      }
      ids.add(step.id);
      if ((step.kind === 'collect' || step.kind === 'action' || step.kind === 'notify') && !step.tool) {
        ctx.addIssue({ code: 'custom', path: ['steps', index, 'tool'], message: `“${step.title}” needs a tool.` });
      }
      if (step.kind === 'condition' && !step.condition) {
        ctx.addIssue({ code: 'custom', path: ['steps', index, 'condition'], message: `“${step.title}” needs a condition.` });
      }
    });
    if (bp.trigger.kind === 'schedule' && !bp.trigger.cron) {
      ctx.addIssue({ code: 'custom', path: ['trigger', 'cron'], message: 'A scheduled agent needs a schedule.' });
    }
    if (bp.trigger.kind === 'event' && !bp.trigger.event) {
      ctx.addIssue({ code: 'custom', path: ['trigger', 'event'], message: 'Choose the event the agent reacts to.' });
    }
  });

/** "Build me an agent that…" */
export const planAgentSchema = z.object({
  prompt: text(4_000).min(3, 'Describe what the agent should do.'),
  /** Start from this template instead of planning from scratch. */
  templateId: text(60).optional(),
  /** The viewer's IANA time zone, so "6 PM" means their 6 PM. */
  timezone: text(64).optional(),
});

export const createStudioAgentSchema = z.object({
  blueprint: agentBlueprintSchema,
  /** Switch it on straight away (only when nothing blocks it). */
  activate: z.boolean().optional(),
});

export const updateStudioAgentSchema = z.object({
  blueprint: agentBlueprintSchema,
  /** Replace a graph that was edited on the canvas since the last compile. */
  overwriteCanvasEdits: z.boolean().optional(),
});

export const runStudioAgentSchema = z.object({
  /** What the person asked for — `{{input.text}}` in the agent's steps. */
  text: text(8_000).optional(),
  /** `test` runs the plan without changing anything: writes are simulated. */
  mode: z.enum(['live', 'test']).optional(),
  /** Sample event data for a test run of an event-triggered agent. */
  event: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 50_000, 'This sample event is too large.')
    .optional(),
});

export const restartRunSchema = z.object({
  stepId: text(80).min(1),
});

export const setAgentStateSchema = z.object({
  state: z.enum(['active', 'paused', 'archived', 'draft']),
});

export type PlanAgentInput = z.infer<typeof planAgentSchema>;
export type CreateStudioAgentInput = z.infer<typeof createStudioAgentSchema>;
export type UpdateStudioAgentInput = z.infer<typeof updateStudioAgentSchema>;
export type RunStudioAgentInput = z.infer<typeof runStudioAgentSchema>;
export type RestartRunInput = z.infer<typeof restartRunSchema>;
export type SetAgentStateInput = z.infer<typeof setAgentStateSchema>;

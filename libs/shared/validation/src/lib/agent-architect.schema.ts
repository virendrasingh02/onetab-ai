import { z } from 'zod';

/**
 * AI Agent Studio — prompt-to-agent. Request bodies for understanding a
 * request and editing an agent in plain words, and the schema every
 * generated spec must pass before anyone sees it (or a graph is built from it).
 */

const text = (max: number) => z.string().trim().max(max);

/** "Create an agent that…" → a spec and a workflow preview. Nothing is saved. */
export const understandAgentSchema = z.object({
  prompt: text(4_000).min(3, 'Describe what the agent should do.'),
  templateId: text(80).optional(),
});

/** A plain-language change to an agent's canvas graph. Nothing is saved. */
export const editAgentGraphSchema = z.object({
  command: text(2_000).min(2, 'Say what to change.'),
  /** The graph being edited — the canvas may hold unsaved changes. */
  graphJson: z.string().max(1_000_000),
});

const step = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(['collect', 'analyze', 'generate', 'action', 'approval', 'notify', 'condition', 'delegate', 'knowledge']),
  title: text(200).min(1),
  why: text(500).optional(),
  tool: text(160).optional(),
  app: text(60).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  prompt: text(8_000).optional(),
  condition: text(300).optional(),
  requiresApproval: z.boolean().optional(),
  retries: z.number().int().min(0).max(5).optional(),
  onFailure: z.enum(['retry', 'continue', 'stop']).optional(),
});

export const agentArchitectSpecSchema = z.object({
  version: z.literal(1),
  goal: text(1_000),
  domain: z.enum(['hr', 'sales', 'marketing', 'finance', 'support', 'ecommerce', 'banking', 'insurance', 'operations', 'engineering', 'legal', 'education', 'healthcare', 'general']),
  agent: z.object({
    name: text(120).min(1),
    description: text(1_000),
    icon: text(40),
    category: text(60),
    tags: z.array(text(60)).max(10),
    instructions: text(8_000),
    model: text(120).optional(),
    temperature: z.number().min(0).max(2),
  }),
  trigger: z.object({
    kind: z.enum(['manual', 'schedule', 'event', 'webhook', 'email', 'chat', 'form']),
    cron: text(120).optional(),
    timezone: text(80).optional(),
    event: text(80).optional(),
    label: text(200),
  }),
  inputs: z.array(text(80)).max(20),
  outputs: z.array(text(80)).max(20),
  steps: z.array(step).min(1).max(30),
  tools: z.array(text(160)).max(40),
  apps: z.array(z.object({ provider: text(60), label: text(80), connected: z.boolean(), purpose: text(200) })).max(20),
  knowledge: z.object({ enabled: z.boolean(), knowledgeBaseId: text(80).optional(), name: text(200).optional(), reason: text(300).optional() }),
  memory: z.object({ enabled: z.boolean(), scope: z.enum(['private', 'shared']), reason: text(300).optional() }),
  approvals: z.array(z.string().max(60)).max(30),
  permissions: z.array(text(80)).max(40),
  errorHandling: z.object({ retries: z.number().int().min(0).max(5), notifyOnFailure: z.boolean() }),
  team: z
    .object({
      mode: z.enum(['router', 'sequential', 'parallel']),
      members: z.array(z.object({ key: text(80).min(1), name: text(120).min(1), role: text(200), instructions: text(4_000) })).min(2).max(8),
    })
    .optional(),
  missingConfiguration: z
    .array(
      z.object({
        id: text(80).min(1),
        kind: z.enum(['connection', 'data_source', 'knowledge', 'channel', 'schedule', 'param', 'delivery']),
        title: text(200),
        detail: text(500),
        options: z.array(text(120)).max(10),
        provider: text(60).optional(),
        required: z.boolean(),
      }),
    )
    .max(20),
  recommendations: z
    .array(
      z.object({
        id: text(80).min(1),
        kind: z.enum(['knowledge', 'approval', 'memory', 'retry', 'failure_alerts', 'multi_agent', 'escalation', 'schedule']),
        title: text(200),
        reason: text(500),
        recommended: z.boolean(),
      }),
    )
    .max(12),
  assumptions: z.array(text(400)).max(12),
  warnings: z.array(text(400)).max(12),
  source: z.object({ kind: z.enum(['ai', 'template']), prompt: text(4_000), model: text(160).optional(), fallbackReason: text(1_000).optional() }),
});

/** Switching a canvas agent's scheduled runs on or off. */
export const setCanvasActivationSchema = z.object({ active: z.boolean() });

export type UnderstandAgentInput = z.infer<typeof understandAgentSchema>;
export type EditAgentGraphInput = z.infer<typeof editAgentGraphSchema>;

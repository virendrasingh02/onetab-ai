import { describe, expect, it, vi } from 'vitest';
import { PLATFORM_TOOLS, findAgentTemplate } from '@org/types';
import { AgentPlannerService, extractJsonObject, sanitizeModelBlueprint } from './agent-planner.service.js';
import { describeBlueprintChanges } from './agent-studio.service.js';

const KNOWN = new Set(Object.keys(PLATFORM_TOOLS));

describe('extractJsonObject', () => {
  it('reads fenced and chatty replies', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('Here is the plan: {"a":2} hope it helps')).toEqual({ a: 2 });
    expect(extractJsonObject('no json here')).toBeNull();
  });
});

describe('sanitizeModelBlueprint', () => {
  it('drops steps that use tools that do not exist, and says so', () => {
    const { blueprint, warnings } = sanitizeModelBlueprint(
      {
        name: 'Report',
        kind: 'personal',
        trigger: { kind: 'schedule', cron: '0 18 * * 1-5' },
        steps: [
          { id: 'tasks', kind: 'collect', title: 'Get tasks', tool: 'find_tasks', input: { assignee: 'me' } },
          { id: 'crm', kind: 'collect', title: 'Read the CRM', tool: 'salesforce_magic' },
          { id: 'tasks', kind: 'generate', title: 'Write it', prompt: 'Write', uses: ['tasks', 'crm', 'later'] },
        ],
      },
      KNOWN,
    );
    expect(blueprint.steps!.map((s) => s.id)).toEqual(['tasks', 'tasks_2']);
    expect(blueprint.steps![1]!.uses).toEqual(['tasks']);
    expect(warnings).toEqual([expect.stringContaining('salesforce_magic')]);
    expect(blueprint.trigger).toEqual({ kind: 'schedule', cron: '0 18 * * 1-5' });
  });

  it('repairs kinds, events and inputs a model got wrong', () => {
    const { blueprint } = sanitizeModelBlueprint(
      {
        kind: 'wizard',
        trigger: { kind: 'event', event: 'email.received' },
        steps: [
          { kind: 'action', title: 'Do it' },
          { kind: 'collect', title: 'Get', tool: 'find_tasks', input: 'not an object' },
          { kind: 'condition', title: 'Maybe' },
        ],
        output: { format: 'poem', destination: 'channel', channelSlug: '#general' },
      },
      KNOWN,
    );
    expect(blueprint.kind).toBe('task');
    expect(blueprint.trigger).toEqual({ kind: 'event' });
    expect(blueprint.steps!.map((s) => s.kind)).toEqual(['generate', 'collect', 'analyze']);
    expect(blueprint.steps![1]!.input).toBeUndefined();
    expect(blueprint.output).toEqual({ format: 'summary', destination: 'channel', channelSlug: 'general' });
  });
});

function makePlanner(opts: { chat?: () => Promise<unknown>; projects?: Array<{ id: string; name: string }>; connected?: unknown[] } = {}) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }) },
    project: { findMany: vi.fn().mockResolvedValue(opts.projects ?? []) },
  };
  const registry = {
    getToolDefinitions: () =>
      Object.entries(PLATFORM_TOOLS).map(([name, meta]) => ({ name, description: meta.label, parameters: { query: {} }, meta })),
  };
  const integrations = {
    getConnectedIntegrations: vi.fn().mockResolvedValue(opts.connected ?? []),
    getActions: vi.fn().mockResolvedValue([]),
  };
  const ai = { chat: vi.fn(opts.chat ?? (async () => { throw new Error('No AI provider is configured.'); })) };
  const planner = new AgentPlannerService(
    prisma as any,
    ai as any,
    { resolve: () => ({ provider: 'openai', model: 'gpt-4o' }) } as any,
    { resolveCredential: async () => ({ apiKey: 'k' }) } as any,
    registry as any,
    integrations as any,
  );
  return { planner, ai, prisma };
}

describe('AgentPlannerService.plan', () => {
  it('falls back to the closest template when no model is available, and says why', async () => {
    const { planner } = makePlanner();
    const { blueprint, understanding } = await planner.plan('ws', 'u', { prompt: 'Prepare my daily work report at 6 PM' });
    expect(blueprint.source).toMatchObject({ kind: 'template', templateId: 'daily-report', fallbackReason: 'No AI provider is configured.' });
    expect(blueprint.trigger).toMatchObject({ kind: 'schedule', cron: '0 18 * * *', timezone: 'Asia/Kolkata' });
    expect(blueprint.scopes.sort()).toEqual(['activity:read', 'docs:write', 'meetings:read', 'tasks:read']);
    expect(understanding.plannedBy).toBe('template');
    expect(understanding.runsWhen).toMatch(/Every day at 6:00 PM/);
  });

  it('plans with the model, then grants exactly the scopes its steps need', async () => {
    const { planner } = makePlanner({
      chat: async () => ({
        message: {
          content: JSON.stringify({
            name: 'Blocker check',
            kind: 'project',
            objective: 'Find what is blocked.',
            trigger: { kind: 'manual' },
            steps: [
              { id: 'overview', kind: 'collect', title: 'Read the project', tool: 'get_project_overview', input: { projectId: '{{params.projectId}}' } },
              { id: 'post', kind: 'action', title: 'Post it', tool: 'send_channel_message', input: { channelSlug: 'eng', messageText: '{{report.aiOutput}}' } },
              { id: 'report', kind: 'generate', title: 'Explain', prompt: 'Explain blockers' },
            ],
            output: { format: 'answer', destination: 'run' },
          }),
        },
      }),
      projects: [{ id: 'p_alpha', name: 'Project Alpha' }, { id: 'p_beta', name: 'Beta' }],
    });
    const { blueprint } = await planner.plan('ws', 'u', { prompt: 'Why is Project Alpha delayed?' });
    expect(blueprint.source.kind).toBe('ai');
    expect(blueprint.scopes.sort()).toEqual(['chat:send', 'projects:read']);
    // Posting to a channel reaches other people: approval by default.
    expect(blueprint.steps.find((s) => s.id === 'post')?.requiresApproval).toBe(true);
    // The project param the model referenced is declared and filled from the request.
    expect(blueprint.params).toEqual([expect.objectContaining({ key: 'projectId', type: 'project', value: 'p_alpha' })]);
    expect(blueprint.assumptions).toContain('Uses the project “Project Alpha”.');
  });

  it('keeps a template’s schedule when started from the template, not from words', async () => {
    const { planner } = makePlanner();
    const { blueprint } = await planner.plan('ws', 'u', { prompt: 'Daily work report', templateId: 'daily-report' });
    expect(blueprint.trigger).toMatchObject({ kind: 'schedule', cron: '0 18 * * 1-5' });
  });

  it('keeps the plan’s hour when the request names no time of day', async () => {
    const { planner } = makePlanner();
    const { blueprint } = await planner.plan('ws', 'u', { prompt: 'Send me a daily report of my work' });
    expect(blueprint.source).toMatchObject({ kind: 'template', templateId: 'daily-report' });
    expect(blueprint.trigger).toMatchObject({ kind: 'schedule', cron: '0 18 * * *' });
  });

  it('keeps a schedule the model read out of the request', async () => {
    const { planner } = makePlanner({
      chat: async () => ({
        message: {
          content: JSON.stringify({
            name: 'Morning plan',
            trigger: { kind: 'schedule', cron: '30 7 * * 1-5' },
            steps: [{ id: 'tasks', kind: 'collect', title: 'Get tasks', tool: 'find_tasks', input: { assignee: 'me' } }],
          }),
        },
      }),
    });
    const { blueprint } = await planner.plan('ws', 'u', { prompt: 'Every weekday morning at 7:30 plan my day' });
    expect(blueprint.trigger).toMatchObject({ kind: 'schedule', cron: '30 7 * * 1-5' });
  });

  it('asks only what it could not decide', async () => {
    const { planner } = makePlanner();
    const { blueprint } = await planner.plan('ws', 'u', { prompt: 'x', templateId: 'message-to-task' });
    expect(blueprint.questions).toEqual([{ id: 'watch_channel', question: 'Which channel should it watch?', field: 'trigger.filter.channelId' }]);
  });

  it('warns when a plan needs an app that is not connected', async () => {
    const { planner } = makePlanner();
    const { blueprint } = await planner.plan('ws', 'u', { prompt: 'x', templateId: 'email-follow-up' });
    expect(blueprint.warnings.join(' ')).toMatch(/Gmail isn’t connected/);
  });
});

describe('describeBlueprintChanges', () => {
  it('summarises what changed between versions', () => {
    const before = findAgentTemplate('daily-report')!.blueprint();
    const after = {
      ...before,
      trigger: { ...before.trigger, cron: '0 19 * * 1-5' },
      steps: before.steps.filter((s) => s.id !== 'meetings'),
      scopes: [...before.scopes, 'chat:send' as const],
    };
    const text = describeBlueprintChanges(before, after);
    expect(text).toMatch(/runs weekdays at 7:00 pm/i);
    expect(text).toMatch(/removed “Read today’s meeting notes”/);
    expect(text).toMatch(/granted chat:send/);
    expect(describeBlueprintChanges(null, after)).toBe('Created from a plan');
    expect(describeBlueprintChanges(before, before)).toBe('Saved without changes');
  });

  it('ignores key order, as a profile read back from the database has it reordered', () => {
    const before = findAgentTemplate('daily-report')!.blueprint();
    const reorder = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).reverse()) as T;
    const stored = { ...before, steps: before.steps.map(reorder), output: reorder(before.output) };
    expect(describeBlueprintChanges(stored, before)).toBe('Saved without changes');
    expect(describeBlueprintChanges(stored, { ...before, instructions: 'Keep it short.' })).toBe('Updated the writing guidance');
  });
});

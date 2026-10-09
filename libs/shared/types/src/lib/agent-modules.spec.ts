import { describe, expect, it } from 'vitest';
import {
  composeAgentPrompt,
  DEFAULT_PROMPT_SETTINGS,
  estimateTokens,
  jsonSchemaError,
  lintAgentPrompt,
  promptResponseFormat,
  promptVariableRefs,
  readCanvasToolPolicies,
  readKnowledgeBinding,
  readPromptSettings,
  resolvePromptVariables,
  type AgentPromptSettings,
} from './agent-modules.js';
import { compileStudioGraph } from './studio-graph.js';

const settings = (patch: Partial<AgentPromptSettings>): AgentPromptSettings => ({ ...DEFAULT_PROMPT_SETTINGS, ...patch });

describe('readPromptSettings', () => {
  it('reads nothing as the defaults', () => {
    expect(readPromptSettings(undefined)).toEqual(DEFAULT_PROMPT_SETTINGS);
    expect(readPromptSettings('junk')).toEqual(DEFAULT_PROMPT_SETTINGS);
  });

  it('drops invalid variables, blank list items and unknown enums', () => {
    const read = readPromptSettings({
      tone: 'shouty',
      goals: ['  Help  ', '', 3],
      variables: [{ name: 'customer.name', defaultValue: 'there' }, { name: 'bad name' }, { name: '' }],
      output: { format: 'yaml' },
      examples: [{ input: 'hi', output: 'hello', kind: 'negative', enabled: false }],
    });
    expect(read.tone).toBe('neutral');
    expect(read.goals).toEqual(['Help']);
    expect(read.variables).toEqual([{ name: 'customer.name', defaultValue: 'there' }]);
    expect(read.output.format).toBe('auto');
    expect(read.examples[0]).toMatchObject({ id: 'example-1', kind: 'negative', enabled: false });
  });
});

describe('composeAgentPrompt', () => {
  it('leaves the instructions untouched when nothing is set (old agents run as before)', () => {
    expect(composeAgentPrompt('  Be helpful.  ', DEFAULT_PROMPT_SETTINGS)).toBe('Be helpful.');
  });

  it('adds only the sections that are set, in a stable order', () => {
    const out = composeAgentPrompt(
      'You answer billing questions.',
      settings({
        objective: 'Resolve the ticket',
        goals: ['Be accurate'],
        tone: 'concise',
        reasoning: { plan: true, selfCheck: false, askWhenUnclear: false },
        safety: { citeSources: true, noFabrication: false, protectPersonalData: false, escalation: 'the customer asks for a refund' },
        output: { format: 'json', schema: '{"type":"object"}' },
        examples: [
          { id: '1', input: 'Where is my invoice?', output: 'In Settings → Billing.', kind: 'positive', enabled: true },
          { id: '2', input: 'x', output: 'y', kind: 'positive', enabled: false },
        ],
      }),
    );
    const order = ['You answer billing', '## Objective', '## Goals', '## How to work', '## Safety', '## Tone', '## Output', '## Examples'];
    const positions = order.map((h) => out.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(out).toContain('refund');
    expect(out).toContain('```json\n{"type":"object"}\n```');
    expect(out).toContain('Example 1:');
    expect(out).not.toContain('Example 2');
  });

  it('labels negative examples as replies to avoid', () => {
    const out = composeAgentPrompt('', settings({ examples: [{ id: 'n', input: 'Q', output: 'Bad', kind: 'negative', enabled: true }] }));
    expect(out).toContain('a reply to AVOID');
  });
});

describe('variables', () => {
  it('finds references once each, in order', () => {
    expect(promptVariableRefs('Hi {{ user.name }}, re {{ticket}} — {{user.name}}')).toEqual(['user.name', 'ticket']);
  });

  it('resolves from values, then defaults, and leaves unknown references as written', () => {
    const r = resolvePromptVariables('{{a.b}} {{c}} {{d}}', { a: { b: 1 } }, { c: 'two' });
    expect(r.text).toBe('1 two {{d}}');
    expect(r.missing).toEqual(['d']);
    expect(resolvePromptVariables('{{x.y}}', { 'x.y': 'flat' }).text).toBe('flat');
  });
});

describe('lintAgentPrompt', () => {
  it('flags undeclared and unused variables but knows runtime roots and step ids', () => {
    const issues = lintAgentPrompt(
      'Use {{input.message}}, {{step1.result}} and {{customer.tier}}.',
      settings({ variables: [{ name: 'unused' }] }),
      ['step1'],
    );
    const messages = issues.map((i) => i.message).join('\n');
    expect(messages).toContain('{{customer.tier}} isn’t declared');
    expect(messages).not.toContain('{{input.message}} isn’t declared');
    expect(messages).not.toContain('{{step1.result}} isn’t declared');
    expect(messages).toContain('{{unused}} is declared but');
  });

  it('catches an invalid schema and a format conflict', () => {
    const issues = lintAgentPrompt('Answer in markdown.', settings({ output: { format: 'json', schema: '{nope' } }));
    expect(issues.some((i) => i.level === 'error' && i.field === 'output')).toBe(true);
    expect(issues.some((i) => i.message.includes('ask for Markdown'))).toBe(true);
  });

  it('warns about half-written examples', () => {
    const issues = lintAgentPrompt('Do it well and carefully for every customer.', settings({ examples: [{ id: '1', input: 'q', output: '', kind: 'positive', enabled: true }] }));
    expect(issues.find((i) => i.field === 'examples')?.level).toBe('warning');
  });
});

describe('small readers', () => {
  it('maps output formats onto the runtime response format', () => {
    expect(promptResponseFormat(settings({ output: { format: 'text', schema: '' } }))).toBe('plain');
    expect(promptResponseFormat(DEFAULT_PROMPT_SETTINGS)).toBeUndefined();
  });

  it('validates schemas', () => {
    expect(jsonSchemaError('')).toBeNull();
    expect(jsonSchemaError('[]')).toMatch(/object/);
    expect(jsonSchemaError('{"type":"object"}')).toBeNull();
  });

  it('reads knowledge bindings with clamped top-K', () => {
    expect(readKnowledgeBinding({})).toBeNull();
    expect(readKnowledgeBinding({ knowledgeBaseId: 'kb', topK: 99, mode: 'HYBRID', minScore: 0.4 })).toEqual({
      knowledgeBaseId: 'kb',
      topK: 20,
      mode: 'HYBRID',
      minScore: 0.4,
    });
  });

  it('keeps only stricter tool policies', () => {
    expect(readCanvasToolPolicies({ a: 'ask_user', b: 'auto_allow', c: 'blocked' })).toEqual({ a: 'ask_user', c: 'blocked' });
  });

  it('estimates tokens', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('compileStudioGraph with module settings', () => {
  const graph = {
    nodes: [
      { id: 't', type: 'TRIGGER_MANUAL', data: { config: {} } },
      {
        id: 'a',
        type: 'AGENT',
        data: {
          label: 'Helper',
          config: {
            instructions: 'Help {{customer.name}}.',
            fallbackModel: 'gpt-4o-mini',
            model: 'gpt-4o',
            toolPolicies: { 'SLACK.send_message': 'ask_user', create_task: 'blocked', search_docs: 'auto_allow' },
            promptSettings: {
              objective: 'Close tickets',
              output: { format: 'markdown' },
              variables: [{ name: 'customer.name', defaultValue: 'there' }],
            },
          },
        },
      },
      { id: 'kb', type: 'KB_SEARCH', data: { config: { knowledgeBaseId: 'kb1', topK: 3, mode: 'HYBRID', minScore: 0.5 } } },
      { id: 'kb-off', type: 'KB_SEARCH', data: { config: { knowledgeBaseId: 'kb2', enabled: false } } },
    ],
    edges: [
      { id: 'e1', source: 't', target: 'a' },
      { id: 'e2', source: 'a', target: 'kb', sourceHandle: 'embedding' },
      { id: 'e3', source: 'a', target: 'kb-off', sourceHandle: 'embedding' },
    ],
  };

  it('composes the prompt and carries format, defaults, fallback, knowledge and policies', () => {
    const [agent] = compileStudioGraph(graph).agents;
    expect(agent.instructions).toContain('Help {{customer.name}}.');
    expect(agent.instructions).toContain('## Objective\nClose tickets');
    expect(agent.responseFormat).toBe('markdown');
    expect(agent.variableDefaults).toEqual({ 'customer.name': 'there' });
    expect(agent.fallbackModel).toBe('gpt-4o-mini');
    expect(agent.knowledge).toEqual([{ knowledgeBaseId: 'kb1', topK: 3, mode: 'HYBRID', minScore: 0.5 }]);
    expect(agent.rules?.policies).toEqual({ slack_send_message: 'ask_user', create_task: 'blocked' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  conditionSpecFrom,
  evaluateCondition,
  normalizeWorkflowNode,
  normalizeWorkflowNodes,
  parseConditionExpression,
} from './workflow-graph.js';

describe('normalizeWorkflowNode', () => {
  it('reads the canvas shape: settings flat on data, UI keys dropped', () => {
    const node = normalizeWorkflowNode({
      id: 'n1',
      type: 'LLM',
      data: {
        type: 'LLM',
        label: 'Summarise',
        subtitle: 'gpt · 0.7',
        prompt: 'Summarise {{input.text}}',
        model: 'gpt-4o',
        disabled: false,
      },
    });
    expect(node.type).toBe('LLM');
    expect(node.label).toBe('Summarise');
    expect(node.config).toEqual({ prompt: 'Summarise {{input.text}}', model: 'gpt-4o' });
  });

  it('reads the former Studio shape: settings nested in data.config', () => {
    const node = normalizeWorkflowNode({
      id: 'n2',
      type: 'FIRECRAWL_SEARCH',
      data: { label: 'Search', config: { query: '{{input.query}}', limit: 5 } },
    });
    expect(node.type).toBe('FIRECRAWL_SEARCH');
    expect(node.config).toEqual({ query: '{{input.query}}', limit: 5 });
  });

  it('lets an explicit API config win over data', () => {
    const node = normalizeWorkflowNode({
      id: 'n3',
      type: 'HTTP_REQUEST',
      config: { url: 'https://api.example.com' },
      data: { url: 'https://stale.example.com', method: 'POST' },
    });
    expect(node.config).toEqual({ url: 'https://api.example.com', method: 'POST' });
  });

  it('resolves legacy React Flow component names through data.type', () => {
    expect(normalizeWorkflowNode({ id: 'n4', type: 'aiActionNode', data: { type: 'llm' } }).type).toBe(
      'LLM',
    );
  });

  it('keeps data so a disabled flag is still visible to the engine', () => {
    const node = normalizeWorkflowNode({ id: 'n5', type: 'DELAY', data: { disabled: true } });
    expect(node.data?.['disabled']).toBe(true);
  });

  it('drops malformed entries from a stored list', () => {
    expect(normalizeWorkflowNodes([null, { type: 'X' }, { id: 'ok', type: 'START' }])).toHaveLength(1);
    expect(normalizeWorkflowNodes('not an array')).toEqual([]);
  });
});

describe('parseConditionExpression', () => {
  it.each([
    ['input.status == "done"', { field: 'input.status', operator: 'eq', value: 'done' }],
    ["input.status === 'done'", { field: 'input.status', operator: 'eq', value: 'done' }],
    ['score >= 0.8', { field: 'score', operator: 'gte', value: '0.8' }],
    ['count < 3', { field: 'count', operator: 'lt', value: '3' }],
    ['plan != free', { field: 'plan', operator: 'ne', value: 'free' }],
    ['payload.email contains "@acme"', { field: 'payload.email', operator: 'contains', value: '@acme' }],
    ['exists input.userId', { field: 'input.userId', operator: 'exists' }],
    ['!input.userId', { field: 'input.userId', operator: 'notExists' }],
    ['{{ input.flag }}', { field: 'input.flag', operator: 'exists' }],
    ['items[0].name == "a"', { field: 'items[0].name', operator: 'eq', value: 'a' }],
  ])('parses %s', (expression, expected) => {
    expect(parseConditionExpression(expression)).toEqual(expected);
  });

  it.each(['', 'process.exit()', 'a + b == c', '== 3'])('refuses %s', (expression) => {
    expect(parseConditionExpression(expression)).toBeNull();
  });
});

describe('evaluateCondition', () => {
  const payload = {
    input: { status: 'done', score: 0.92, tags: ['vip', 'beta'], empty: '' },
    items: [{ name: 'a' }],
  };

  it('evaluates structured fields', () => {
    expect(evaluateCondition(conditionSpecFrom({ field: 'input.status', operator: 'eq', value: 'done' }), payload)).toBe(true);
  });

  it('evaluates free-text expressions the canvas stores', () => {
    expect(evaluateCondition(conditionSpecFrom({ expression: 'input.score > 0.9' }), payload)).toBe(true);
    expect(evaluateCondition(conditionSpecFrom({ expression: 'input.score > 0.95' }), payload)).toBe(false);
    expect(evaluateCondition(conditionSpecFrom({ expression: 'input.tags contains vip' }), payload)).toBe(true);
    expect(evaluateCondition(conditionSpecFrom({ expression: 'items[0].name == "a"' }), payload)).toBe(true);
  });

  it('treats an empty string as not existing', () => {
    expect(evaluateCondition(conditionSpecFrom({ expression: 'exists input.empty' }), payload)).toBe(false);
  });

  it('is false, not true, for a condition it cannot understand', () => {
    expect(evaluateCondition(conditionSpecFrom({ expression: 'a + b == c' }), payload)).toBe(false);
    expect(evaluateCondition(conditionSpecFrom({}), payload)).toBe(false);
  });

  it('does not coerce non-numbers into numeric comparisons', () => {
    expect(evaluateCondition(conditionSpecFrom({ expression: 'input.status > 1' }), payload)).toBe(false);
  });
});

import { workflowCronExpression } from './workflow-schedule.listener.js';

describe('workflowCronExpression', () => {
  it('reads the cron from a canvas trigger node', () => {
    const nodes = JSON.stringify([
      { id: 't', type: 'TRIGGER', data: { type: 'TRIGGER', triggerKind: 'CRON', cron: '0 9 * * 1-5' } },
      { id: 'l', type: 'LLM', data: { type: 'LLM', prompt: 'x' } },
    ]);
    expect(workflowCronExpression(nodes)).toBe('0 9 * * 1-5');
  });

  it('returns null when there is no trigger schedule', () => {
    expect(workflowCronExpression(JSON.stringify([{ id: 'l', type: 'LLM', data: {} }]))).toBeNull();
    expect(workflowCronExpression('nope')).toBeNull();
  });
});

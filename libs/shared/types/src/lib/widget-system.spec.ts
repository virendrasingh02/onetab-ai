import { describe, expect, it } from 'vitest';
import {
  WIDGET_CATEGORIES,
  WORKFLOW_WIDGET_NODE_TYPES,
  isWidgetNodeType,
} from './widget-system.js';
import {
  createWidgetDefinitionSchema,
  executeWidgetSchema,
} from '@org/validation';

describe('Widget System Types & Schemas', () => {
  it('defines 5 core widget categories matching platform architecture', () => {
    expect(WIDGET_CATEGORIES).toContain('data_viz');
    expect(WIDGET_CATEGORIES).toContain('interactive_input');
    expect(WIDGET_CATEGORIES).toContain('ai_powered');
    expect(WIDGET_CATEGORIES).toContain('app_connector');
    expect(WIDGET_CATEGORIES).toContain('productivity');
    expect(WIDGET_CATEGORIES.length).toBe(5);
  });

  it('defines 10 React Flow custom widget node types', () => {
    expect(WORKFLOW_WIDGET_NODE_TYPES.length).toBe(10);
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_TRIGGER');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_RENDERER');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_INPUT');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_OUTPUT');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_DATA_SOURCE');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_EVENT_HANDLER');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_ACTION');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_CONDITION');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_APPROVAL');
    expect(WORKFLOW_WIDGET_NODE_TYPES).toContain('WIDGET_ERROR_HANDLER');

    expect(isWidgetNodeType('WIDGET_RENDERER')).toBe(true);
    expect(isWidgetNodeType('AI_CHAT_MODEL')).toBe(false);
  });

  it('validates widget creation input schema', () => {
    const valid = {
      name: 'Agent Latency Tracker',
      category: 'data_viz',
      componentType: 'line_chart',
      appearance: {
        size: 'standard',
      },
      dataSource: {
        type: 'api_rest',
        apiUrl: 'https://api.example.com/metrics',
      },
    };
    const parsed = createWidgetDefinitionSchema.parse(valid);
    expect(parsed.name).toBe('Agent Latency Tracker');
    expect(parsed.category).toBe('data_viz');
    expect(parsed.componentType).toBe('line_chart');
  });

  it('validates widget execution schema', () => {
    const validExec = {
      executionType: 'DATA_FETCH',
      inputPayload: { timeframe: '30d' },
    };
    const parsed = executeWidgetSchema.parse(validExec);
    expect(parsed.executionType).toBe('DATA_FETCH');
  });
});

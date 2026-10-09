import { describe, expect, it } from 'vitest';
import {
  createWidgetDefinitionSchema,
  executeWidgetSchema,
} from './widget-system.schema.js';

describe('Widget System Schemas', () => {
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

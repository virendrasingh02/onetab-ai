import { describe, expect, it } from 'vitest';
import { out, outputSchemaFields } from './output-schema.js';

describe('outputSchemaFields', () => {
  const schema = out.object({
    messages: out.array(out.object({ subject: out.string('Subject line'), from: out.object({ email: out.string() }) }), 'Emails'),
    count: out.number(),
  });

  it('flattens objects and shows a list with its first item’s fields', () => {
    const paths = outputSchemaFields(schema).map((f) => f.path);
    expect(paths).toEqual(['messages', 'messages.0.subject', 'messages.0.from', 'messages.0.from.email', 'count']);
  });

  it('carries type and description', () => {
    const fields = outputSchemaFields(schema);
    expect(fields.find((f) => f.path === 'messages')).toEqual({ path: 'messages', type: 'array', description: 'Emails' });
    expect(fields.find((f) => f.path === 'messages.0.subject')?.description).toBe('Subject line');
  });

  it('stops at the depth limit', () => {
    const deep = out.object({ a: out.object({ b: out.object({ c: out.object({ d: out.string() }) }) }) });
    expect(outputSchemaFields(deep, 2).map((f) => f.path)).toEqual(['a', 'a.b']);
  });

  it('is empty for anything that is not an object schema', () => {
    expect(outputSchemaFields(undefined)).toEqual([]);
    expect(outputSchemaFields('x')).toEqual([]);
    expect(outputSchemaFields({ type: 'string' })).toEqual([]);
  });
});

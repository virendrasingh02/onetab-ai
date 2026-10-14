import { describe, expect, it } from 'vitest';
import { validateActionInput } from './action-input.js';

const schema = {
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    limit: { type: 'number' },
    notify: { type: 'boolean' },
    items: { type: 'array' },
    status: { type: 'string', enum: ['open', 'closed'] },
  },
  required: ['orderId'],
};

describe('validateActionInput', () => {
  it('names missing required fields, treating blanks as missing', () => {
    expect(validateActionInput(schema, {})).toEqual({ ok: false, errors: ['“orderId” is required.'] });
    expect(validateActionInput(schema, { orderId: '  ' }).ok).toBe(false);
  });

  it('converts the string forms workflow variables arrive in', () => {
    const result = validateActionInput(schema, { orderId: 42, limit: '10', notify: 'true', items: '["a"]' });
    expect(result).toEqual({ ok: true, input: { orderId: '42', limit: 10, notify: true, items: ['a'] } });
  });

  it('rejects values of the wrong shape and values outside an enum', () => {
    const result = validateActionInput(schema, { orderId: '1', limit: 'lots', notify: 'maybe', status: 'weird' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        '“limit” must be a number.',
        '“notify” must be true or false.',
        '“status” must be one of: open, closed.',
      ]);
    }
  });

  it('lets optional fields be empty and passes unknown fields through', () => {
    expect(validateActionInput(schema, { orderId: '1', limit: '', extra: 1 })).toEqual({
      ok: true,
      input: { orderId: '1', limit: '', extra: 1 },
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  generateId,
  generateShortId,
  generateSortableId,
  getUuidVersion,
  isValidId,
  isValidUuid,
} from './id.js';

describe('id utilities', () => {
  it('generates valid v4 UUIDs that are unique', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateId()));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(getUuidVersion(id)).toBe(4);
  });

  it('supports prefixes', () => {
    const id = generateId('node');
    expect(id.startsWith('node_')).toBe(true);
    expect(isValidUuid(id.slice(5))).toBe(true);
    expect(isValidId(id)).toBe(true);
  });

  it('generates sortable v7 ids in creation order', () => {
    const a = generateSortableId();
    const b = generateSortableId();
    expect(getUuidVersion(a)).toBe(7);
    expect(a < b).toBe(true);
  });

  it('generates short ids', () => {
    expect(generateShortId('b')).toMatch(/^b_[0-9a-f]{8}$/);
  });

  it('validates uuids and legacy ids', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid(42)).toBe(false);
    expect(isValidId('clx1234567890abcdefghijkl')).toBe(true);
    expect(isValidId('')).toBe(false);
    expect(isValidId('a b')).toBe(false);
    expect(isValidId('../etc')).toBe(false);
    expect(isValidId('x'.repeat(200))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  evaluateCondition,
  evaluateTemplate,
  getNestedValue,
} from './card-evaluator.js';

describe('card-evaluator', () => {
  describe('getNestedValue', () => {
    it('resolves flat properties', () => {
      expect(getNestedValue({ name: 'Alex' }, 'name')).toBe('Alex');
    });

    it('resolves deeply nested object paths', () => {
      const data = { customer: { company: { name: 'Acme Corp', size: 100 } } };
      expect(getNestedValue(data, 'customer.company.name')).toBe('Acme Corp');
      expect(getNestedValue(data, 'customer.company.size')).toBe(100);
    });

    it('resolves array indexing', () => {
      const data = { items: ['apple', 'banana', 'orange'], users: [{ id: 1 }, { id: 2 }] };
      expect(getNestedValue(data, 'items[1]')).toBe('banana');
      expect(getNestedValue(data, 'users[0].id')).toBe(1);
    });

    it('returns undefined for nonexistent paths', () => {
      expect(getNestedValue({ a: 1 }, 'b.c.d')).toBeUndefined();
    });
  });

  describe('applyFilter', () => {
    it('applies string transformations', () => {
      expect(applyFilter('hello world', 'uppercase')).toBe('HELLO WORLD');
      expect(applyFilter('HELLO', 'lowercase')).toBe('hello');
      expect(applyFilter('onetab', 'capitalize')).toBe('Onetab');
    });

    it('applies currency formatting', () => {
      expect(applyFilter(1250.5, 'currency')).toBe('$1,250.50');
      expect(applyFilter(500, 'currency:€')).toBe('€500.00');
    });

    it('applies number formatting', () => {
      expect(applyFilter(1234567.891, 'number:2')).toBe('1,234,567.89');
    });

    it('applies truncate filter', () => {
      expect(applyFilter('This is a very long text string for preview', 'truncate:10')).toBe('This is a …');
    });

    it('applies default filter', () => {
      expect(applyFilter(null, 'default:N/A')).toBe('N/A');
      expect(applyFilter('Actual Value', 'default:N/A')).toBe('Actual Value');
    });
  });

  describe('evaluateTemplate', () => {
    it('interpolates template expressions with data bindings', () => {
      const data = { user: { name: 'Sarah', role: 'Engineer' }, score: 98.5 };
      const template = 'User: {{user.name}} ({{user.role}}) with score: {{score}}';
      expect(evaluateTemplate(template, data)).toBe('User: Sarah (Engineer) with score: 98.5');
    });

    it('supports filter chains inside template bindings', () => {
      const data = { product: 'enterprise suite', price: 4500 };
      const template = '{{product | capitalize}} costs {{price | currency}}';
      expect(evaluateTemplate(template, data)).toBe('Enterprise suite costs $4,500.00');
    });
  });

  describe('evaluateCondition', () => {
    it('evaluates equals operator', () => {
      expect(evaluateCondition({ field: 'status', operator: 'equals', value: 'active' }, { status: 'active' })).toBe(true);
      expect(evaluateCondition({ field: 'status', operator: 'equals', value: 'active' }, { status: 'paused' })).toBe(false);
    });

    it('evaluates greater_than and less_than operators', () => {
      expect(evaluateCondition({ field: 'risk', operator: 'greater_than', value: 80 }, { risk: 95 })).toBe(true);
      expect(evaluateCondition({ field: 'risk', operator: 'greater_than', value: 80 }, { risk: 50 })).toBe(false);
    });

    it('evaluates contains operator', () => {
      expect(evaluateCondition({ field: 'tags', operator: 'contains', value: 'vip' }, { tags: ['client', 'vip'] })).toBe(true);
      expect(evaluateCondition({ field: 'title', operator: 'contains', value: 'bug' }, { title: 'Critical bug in production' })).toBe(true);
    });

    it('evaluates AND / OR logic groups', () => {
      const condition = {
        and: [
          { field: 'role', operator: 'equals' as const, value: 'admin' },
          { field: 'verified', operator: 'equals' as const, value: true },
        ],
      };
      expect(evaluateCondition(condition, { role: 'admin', verified: true })).toBe(true);
      expect(evaluateCondition(condition, { role: 'admin', verified: false })).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  getByPath,
  resolveVariables,
  extractVariablePaths,
} from './variable-resolver.js';

describe('variable-resolver', () => {
  it('resolves nested paths with getByPath', () => {
    const data = {
      user: { firstName: 'Alice', profile: { city: 'Tokyo' } },
      otp: { code: '123456' },
    };
    expect(getByPath(data, 'user.firstName')).toBe('Alice');
    expect(getByPath(data, 'user.profile.city')).toBe('Tokyo');
    expect(getByPath(data, 'otp.code')).toBe('123456');
    expect(getByPath(data, 'user.unknown')).toBeUndefined();
    expect(getByPath(data, 'user.__proto__')).toBeUndefined();
  });

  it('interpolates simple variables with HTML escaping', () => {
    const template = 'Hello {{user.name}}! Your role is {{user.role}}.';
    const data = { user: { name: '<script>alert(1)</script>Bob', role: 'Admin & Owner' } };
    const result = resolveVariables(template, data);
    expect(result).toBe('Hello &lt;script&gt;alert(1)&lt;/script&gt;Bob! Your role is Admin &amp; Owner.');
  });

  it('supports raw unescaped variables with triple mustaches', () => {
    const template = '<div>{{{custom.badge}}}</div>';
    const data = { custom: { badge: '<span class="badge">PRO</span>' } };
    expect(resolveVariables(template, data)).toBe('<div><span class="badge">PRO</span></div>');
  });

  it('handles fallback defaults with ||', () => {
    const template = 'Hi {{user.name || "friend"}}, welcome to {{workspace.name || "OneTab"}}!';
    expect(resolveVariables(template, {})).toBe('Hi friend, welcome to OneTab!');
    expect(resolveVariables(template, { user: { name: 'Alice' } })).toBe('Hi Alice, welcome to OneTab!');
  });

  it('handles #if and #else blocks', () => {
    const template = '{{#if user.isPremium}}Thanks for subscribing!{{else}}Upgrade today!{{/if}}';
    expect(resolveVariables(template, { user: { isPremium: true } })).toBe('Thanks for subscribing!');
    expect(resolveVariables(template, { user: { isPremium: false } })).toBe('Upgrade today!');
  });

  it('handles #unless blocks', () => {
    const template = '{{#unless user.verified}}Please verify your email.{{/unless}}';
    expect(resolveVariables(template, { user: { verified: false } })).toBe('Please verify your email.');
    expect(resolveVariables(template, { user: { verified: true } })).toBe('');
  });

  it('supports formatDate and formatCurrency helpers', () => {
    const date = new Date('2026-05-15T12:00:00Z');
    const template = 'Due on {{formatDate task.dueDate}} for {{formatCurrency billing.amount billing.currency}}';
    const data = {
      task: { dueDate: date },
      billing: { amount: 1500, currency: 'USD' },
    };
    const result = resolveVariables(template, data);
    expect(result).toContain('2026');
    expect(result).toContain('$1,500.00');
  });

  it('extracts variable paths', () => {
    const template =
      'Hello {{user.firstName}}, your OTP code is {{otp.code}} and expires in {{otp.expiresIn}}. {{#if security.loginUrl}}Login: {{security.loginUrl}}{{/if}}';
    const paths = extractVariablePaths(template);
    expect(paths).toContain('user.firstName');
    expect(paths).toContain('otp.code');
    expect(paths).toContain('otp.expiresIn');
    expect(paths).toContain('security.loginUrl');
  });

  it('never re-interprets substituted values as template syntax', () => {
    const data = { user: { name: '{{secret}}' }, badge: '{{secret}}', secret: 'LEAK' };
    expect(resolveVariables('Hi {{user.name}}', data)).toBe('Hi {{secret}}');
    expect(resolveVariables('<b>{{{badge}}}</b>', data)).toBe('<b>{{secret}}</b>');
  });

  it('resolves nested #if blocks from the inside out', () => {
    const template = '{{#if a}}A{{#if b}}B{{else}}notB{{/if}}!{{else}}none{{/if}}';
    expect(resolveVariables(template, { a: true, b: true })).toBe('AB!');
    expect(resolveVariables(template, { a: true, b: false })).toBe('AnotB!');
    expect(resolveVariables(template, { a: false, b: true })).toBe('none');
  });

  it('accepts entity-encoded fallback literals from escaped attributes', () => {
    expect(resolveVariables('{{url || &quot;https://x.test&quot;}}', {}, { escape: false })).toBe('https://x.test');
  });
});

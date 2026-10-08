import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateRegistry } from './registry.js';
import type { EmailTemplateDefinition } from '@org/types';

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    // Registry without Prisma (using in-memory system catalog & overrides)
    registry = new TemplateRegistry();
  });

  it('initializes with all system templates across 14 categories', () => {
    const templates = registry.getSystemTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(155);

    const categories = new Set(templates.map((t) => t.category));
    expect(categories.has('AUTHENTICATION')).toBe(true);
    expect(categories.has('WORKSPACE')).toBe(true);
    expect(categories.has('TEAM')).toBe(true);
    expect(categories.has('PROJECTS')).toBe(true);
    expect(categories.has('TASKS')).toBe(true);
    expect(categories.has('DOCS')).toBe(true);
    expect(categories.has('MESSAGING')).toBe(true);
    expect(categories.has('MEETINGS')).toBe(true);
    expect(categories.has('AI_AGENTS')).toBe(true);
    expect(categories.has('HIRE')).toBe(true);
    expect(categories.has('VOICE')).toBe(true);
    expect(categories.has('BILLING')).toBe(true);
    expect(categories.has('SECURITY')).toBe(true);
    expect(categories.has('SYSTEM')).toBe(true);
  });

  it('retrieves default template case-insensitively', async () => {
    const authOtp = await registry.getTemplate('auth_otp');
    expect(authOtp).toBeDefined();
    expect(authOtp?.templateKey).toBe('AUTH_OTP');
    expect(authOtp?.category).toBe('AUTHENTICATION');
    expect(authOtp?.subject).toContain('{{otp.code}}');

    const agentApproval = await registry.getTemplate('AGENT_APPROVAL_REQUIRED');
    expect(agentApproval).toBeDefined();
    expect(agentApproval?.category).toBe('AI_AGENTS');
  });

  it('filters templates by category, status, and search query', async () => {
    const billingTemplates = await registry.listTemplates({ category: 'BILLING' });
    expect(billingTemplates.length).toBeGreaterThan(0);
    expect(billingTemplates.every((t) => t.category === 'BILLING')).toBe(true);

    const searchResults = await registry.listTemplates({ search: 'password' });
    expect(searchResults.length).toBeGreaterThan(0);
    expect(
      searchResults.some((t) => t.templateKey.includes('PASSWORD') || t.name.toLowerCase().includes('password')),
    ).toBe(true);
  });

  it('allows saving and retrieving custom memory overrides', async () => {
    const customDefinition: EmailTemplateDefinition = {
      templateKey: 'AUTH_OTP',
      name: 'Custom Auth OTP',
      category: 'AUTHENTICATION',
      description: 'Custom override for auth OTP',
      subject: 'Your Custom Code: {{otp.code}}',
      previewText: 'Use your custom code to sign in',
      htmlBody: '<p>Your custom code is <strong>{{otp.code}}</strong></p>',
      variablesSchema: [
        { name: 'otp.code', required: true, description: 'One-time code' },
      ],
      status: 'ACTIVE',
      version: 2,
      isSystemTemplate: false,
    };

    // The version is server-owned: it advances from what is stored, whatever
    // the client sends.
    const systemVersion = (await registry.getTemplate('AUTH_OTP'))!.version;
    const saved = await registry.saveTemplate(customDefinition);
    expect(saved.version).toBe(systemVersion + 1);
    expect(saved.subject).toBe('Your Custom Code: {{otp.code}}');

    const retrieved = await registry.getTemplate('AUTH_OTP');
    expect(retrieved?.subject).toBe('Your Custom Code: {{otp.code}}');
    expect(retrieved?.version).toBe(systemVersion + 1);

    // A workspace override is invisible outside that workspace.
    await registry.saveTemplate({ templateKey: 'AUTH_OTP', workspaceId: 'ws_1', subject: 'WS only' });
    expect((await registry.getTemplate('AUTH_OTP', 'ws_1'))?.subject).toBe('WS only');
    expect((await registry.getTemplate('AUTH_OTP', 'ws_2'))?.subject).toBe('Your Custom Code: {{otp.code}}');
    const globalList = await registry.listTemplates({ search: 'AUTH_OTP' });
    expect(globalList.find((t) => t.templateKey === 'AUTH_OTP')?.subject).toBe('Your Custom Code: {{otp.code}}');
  });

  it('resets a custom template back to system default', async () => {
    // Override first
    await registry.saveTemplate({
      templateKey: 'AUTH_OTP',
      name: 'Overridden Auth OTP',
      category: 'AUTHENTICATION',
      subject: 'Temporary Override',
      htmlBody: '<p>Temp</p>',
      variablesSchema: [],
      status: 'ACTIVE',
      version: 5,
      isSystemTemplate: false,
    });

    // Reset
    const reset = await registry.resetToDefault('AUTH_OTP');
    expect(reset).toBeDefined();
    expect(reset?.subject).toContain('{{otp.code}}');
    expect(reset?.isSystemTemplate).toBe(true);

    const afterReset = await registry.getTemplate('AUTH_OTP');
    expect(afterReset?.subject).toContain('{{otp.code}}');
    expect(afterReset?.isSystemTemplate).toBe(true);
  });
});

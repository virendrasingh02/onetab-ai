import { describe, it, expect } from 'vitest';
import { TemplateRenderer } from './template-renderer.js';
import type { EmailTemplateDefinition } from '@org/types';

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  const sampleTemplate: EmailTemplateDefinition = {
    templateKey: 'AGENT_APPROVAL_REQUIRED',
    name: 'Agent Requires Approval',
    category: 'AI_AGENTS',
    description: 'Triggered when an AI agent needs human approval',
    subject: 'Action Required: Agent {{agent.name}} requires approval',
    previewText: 'Agent {{agent.name}} is waiting for your sign-off',
    htmlBody: `
      <h2>Approval Required</h2>
      <p>The AI Agent <strong>{{agent.name}}</strong> (Run ID: {{agent.runId}}) needs approval for step <em>{{step.name}}</em>.</p>
      {{#if approval.riskLevel}}
        <p>Risk Level: {{approval.riskLevel}}</p>
      {{/if}}
      <p><a href="{{approval.url}}">Review and Approve</a></p>
    `,
    variablesSchema: [
      { name: 'agent.name', required: true },
      { name: 'agent.runId', required: true },
      { name: 'step.name', required: true },
      { name: 'approval.url', required: true },
      { name: 'approval.riskLevel', required: false },
    ],
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
  };

  it('interpolates variables into subject and HTML body', () => {
    const result = renderer.render(sampleTemplate, {
      data: {
        agent: {
          name: 'DataSyncBot',
          runId: 'run-9876',
        },
        step: {
          name: 'Publish to Production',
        },
        approval: {
          url: 'https://app.onetab.ai/agents/approval/9876',
          riskLevel: 'HIGH',
        },
      },
    });

    expect(result.subject).toBe('Action Required: Agent DataSyncBot requires approval');
    expect(result.html).toContain('The AI Agent <strong>DataSyncBot</strong>');
    expect(result.html).toContain('Run ID: run-9876');
    expect(result.html).toContain('Publish to Production');
    expect(result.html).toContain('Risk Level: HIGH');
    expect(result.html).toContain('https://app.onetab.ai/agents/approval/9876');
  });

  it('wraps HTML body in EmailLayout with workspace branding and security notices', () => {
    const result = renderer.render(sampleTemplate, {
      data: {
        agent: { name: 'BillingAgent', runId: 'run-123' },
        step: { name: 'Charge Card' },
        approval: { url: 'https://app.onetab.ai/review' },
      },
      branding: {
        workspaceName: 'Acme Corp',
        workspaceLogo: 'https://acme.com/logo.png',
        primaryColor: '#0055ff',
        customFooter: 'Confidential Internal Notice',
      },
    });

    expect(result.html).toContain('Acme Corp');
    expect(result.html).toContain('https://acme.com/logo.png');
    expect(result.html).toContain('Confidential Internal Notice');
    expect(result.html.toLowerCase()).toContain('<!doctype html>');
  });

  it('generates clean plain-text fallback', () => {
    const result = renderer.render(sampleTemplate, {
      data: {
        agent: { name: 'ResearchBot', runId: 'run-555' },
        step: { name: 'Fetch Sources' },
        approval: { url: 'https://app.onetab.ai/review' },
      },
    });

    expect(result.text).toBeDefined();
    expect(result.text).toContain('The AI Agent ResearchBot');
    expect(result.text).toContain('Run ID: run-555');
    // Plain text should not contain HTML tags
    expect(result.text).not.toContain('<strong>');
    expect(result.text).not.toContain('<h2>');
  });

  it('renders sample preview data with provided or generated mock values', () => {
    const preview = renderer.renderPreview(sampleTemplate);

    expect(preview.subject).toBeDefined();
    expect(preview.subject).not.toContain('{{agent.name}}');
    expect(preview.html).toBeDefined();
    expect(preview.text).toBeDefined();
  });
});

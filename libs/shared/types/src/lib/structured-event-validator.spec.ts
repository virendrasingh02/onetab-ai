import { describe, expect, it } from 'vitest';
import { validateStructuredEvent } from './structured-event-validator.js';

describe('validateStructuredEvent', () => {
  it('validates and normalizes AI Agent events', () => {
    const raw = {
      type: 'mie.ai.agent.v1',
      agentId: 'agent-researcher',
      status: 'running',
      agentName: 'Research Agent',
      model: 'GPT-5',
      durationMs: 1200,
      tools: [
        { name: 'web_search', status: 'success', durationMs: 400 },
      ],
      sources: [
        { title: 'Doc 1', url: 'https://example.com' },
      ],
    };

    const res = validateStructuredEvent(raw);
    expect(res.valid).toBe(true);
    expect(res.event?.type).toBe('mie.ai.agent');
    expect((res.event as any).status).toBe('running');
    expect((res.event as any).tools?.length).toBe(1);
    expect((res.event as any).sources?.length).toBe(1);
  });

  it('validates App Response events', () => {
    const raw = {
      type: 'mie.app.response',
      appId: 'crm',
      appName: 'Sales CRM',
      eventType: 'lead.created',
      title: 'New Lead Created',
      fields: [
        { label: 'Company', value: 'Acme Corp', inline: true },
      ],
    };

    const res = validateStructuredEvent(raw);
    expect(res.valid).toBe(true);
    expect(res.event?.type).toBe('mie.app.response');
    expect((res.event as any).appName).toBe('Sales CRM');
  });

  it('validates Approval events', () => {
    const raw = {
      type: 'mie.approval.v1',
      approvalId: 'appr-123',
      title: 'Deploy to Staging',
      description: 'Approve release v2.4.0',
      status: 'pending',
      riskLevel: 'high',
      sideEffects: ['Restarts worker process', 'Flushes cache'],
    };

    const res = validateStructuredEvent(raw);
    expect(res.valid).toBe(true);
    expect(res.event?.type).toBe('mie.approval');
    expect((res.event as any).riskLevel).toBe('high');
    expect((res.event as any).sideEffects?.length).toBe(2);
  });

  it('validates Form events', () => {
    const raw = {
      type: 'mie.form',
      formId: 'form-onboarding',
      title: 'User Profile Setup',
      fields: [
        { id: 'f1', name: 'email', label: 'Work Email', type: 'email', required: true },
        { id: 'f2', name: 'role', label: 'Job Role', type: 'select', options: [{ label: 'Dev', value: 'dev' }] },
      ],
    };

    const res = validateStructuredEvent(raw);
    expect(res.valid).toBe(true);
    expect(res.event?.type).toBe('mie.form');
    expect((res.event as any).fields?.length).toBe(2);
  });

  it('validates Workflow events', () => {
    const raw = {
      type: 'mie.workflow.v1',
      workflowId: 'wf-101',
      title: 'Content Generation Pipeline',
      currentStepIndex: 1,
      steps: [
        { id: 's1', name: 'Research', status: 'completed', durationMs: 500 },
        { id: 's2', name: 'Analysis', status: 'running' },
        { id: 's3', name: 'Writing', status: 'pending' },
      ],
    };

    const res = validateStructuredEvent(raw);
    expect(res.valid).toBe(true);
    expect(res.event?.type).toBe('mie.workflow');
    expect((res.event as any).steps?.length).toBe(3);
  });

  it('validates Custom Universal Card events', () => {
    const raw = {
      type: 'mie.card.v1',
      cardId: 'crm-lead',
      version: 2,
      data: {
        name: 'Sarah Connor',
        company: 'Cyberdyne',
        status: 'Qualified',
      },
    };

    const res = validateStructuredEvent(raw);
    expect(res.valid).toBe(true);
    expect(res.event?.type).toBe('mie.card');
    expect((res.event as any).cardId).toBe('crm-lead');
    expect((res.event as any).version).toBe(2);
    expect((res.event as any).data?.name).toBe('Sarah Connor');
  });

  it('returns invalid for unrecognized event types', () => {
    const res = validateStructuredEvent({ type: 'unknown.type.xyz' });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Unrecognized structured event type');
  });

  it('returns invalid for non-object payloads', () => {
    expect(validateStructuredEvent(null).valid).toBe(false);
    expect(validateStructuredEvent('string').valid).toBe(false);
  });
});

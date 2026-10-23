import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { promptWithAttachments } from './agent-runtime-bridge.service.js';
import { AgentSessionService, conversationTitle } from './agent-session.service.js';

const VISITOR = `ot_vis_${'b'.repeat(48)}`;

function sessionRow(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    deploymentId: 'd1',
    agentId: 'a1',
    sessionToken: 'ot_sess_1',
    visitorKey: VISITOR,
    title: null,
    clientOrigin: null,
    userContext: {},
    messages: [],
    attachments: [],
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    deployment: { widgetConfig: {}, agent: { name: 'Taylor', welcomeMessage: 'Hi' } },
    ...over,
  } as never;
}

describe('widget conversation titles', () => {
  it('uses the first message, collapsed and capped', () => {
    expect(conversationTitle('  Where is\n my order? ')).toBe('Where is my order?');
    expect(conversationTitle('x'.repeat(120))!.length).toBe(80);
  });

  it('falls back to the first file name, or nothing', () => {
    expect(conversationTitle('', [{ id: 'f', name: 'lab-results.pdf', mimeType: 'application/pdf', size: 1 }])).toBe('lab-results.pdf');
    expect(conversationTitle('   ')).toBeNull();
  });
});

describe('prompts with attachments', () => {
  it('leaves a plain message alone', () => {
    expect(promptWithAttachments('Hello', [])).toBe('Hello');
  });

  it('appends each file and asks for a review when the visitor wrote nothing', () => {
    const prompt = promptWithAttachments('', [{ name: 'invoice "Q3".csv', text: 'a,b' }]);
    expect(prompt.startsWith('Please review the attached file.')).toBe(true);
    expect(prompt).toContain(`<attached_file name="invoice 'Q3'.csv">\na,b\n</attached_file>`);
  });

  it('shares the budget between files and says what was cut', () => {
    const prompt = promptWithAttachments('Compare', [{ name: 'a.txt', text: 'x'.repeat(100) }, { name: 'b.txt', text: '' }], 40);
    expect(prompt).toContain('[…truncated, 80 more characters]');
    expect(prompt).toContain('(no readable text)');
  });
});

describe('a visitor reaches only their own conversations', () => {
  const service = (prisma: Record<string, unknown>) =>
    new AgentSessionService({ agentDeploymentSession: prisma } as never, {} as never);

  it('opens another conversation only by the same visitor on the same deployment', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await expect(service({ findFirst }).openConversation(sessionRow(), 's_other')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: 's_other', deploymentId: 'd1', visitorKey: VISITOR, status: 'ACTIVE' });
  });

  it('refuses to open anything for a session with no visitor key', async () => {
    const findFirst = vi.fn();
    await expect(service({ findFirst }).openConversation(sessionRow({ visitorKey: null }), 's_other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('deletes another conversation only within the visitor’s own', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    await expect(service({ updateMany }).deleteConversation(sessionRow(), 's_x')).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany.mock.calls[0][0].where).toMatchObject({ id: 's_x', deploymentId: 'd1', visitorKey: VISITOR });
  });

  it('sends only attachments this session holds', () => {
    const svc = service({});
    const session = { attachments: [{ id: 'att_1', name: 'a.pdf', mimeType: 'application/pdf', size: 1, text: 't', createdAt: '' }] };
    expect(svc.resolveAttachments(session, ['att_1', 'att_1'])).toHaveLength(1);
    expect(() => svc.resolveAttachments(session, ['att_2'])).toThrow(NotFoundException);
  });
});

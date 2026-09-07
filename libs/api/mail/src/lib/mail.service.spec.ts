import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';
import { passwordResetEmail, workspaceInviteEmail } from './templates.js';

function makeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('MailService', () => {
  const msg = {
    to: 'user@example.com',
    subject: 'Hi',
    html: '<p>Hi</p>',
    text: 'Hi',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the log transport and reports delivered', async () => {
    const service = new MailService(makeConfig({}));
    const result = await service.send(msg);
    expect(result).toEqual({ delivered: true, transport: 'log' });
  });

  it('http transport POSTs the provider-shaped body with auth', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
      );
    const service = new MailService(
      makeConfig({
        MAIL_TRANSPORT: 'http',
        MAIL_API_URL: 'https://mail.example.com/send',
        MAIL_API_KEY: 'k_123',
        MAIL_FROM: 'OneTab <noreply@onetab.ai>',
      }),
    );

    const result = await service.send(msg);

    expect(result).toEqual({ delivered: true, transport: 'http', id: 'msg_1' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mail.example.com/send');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer k_123');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      from: 'OneTab <noreply@onetab.ai>',
      to: 'user@example.com',
      subject: 'Hi',
    });
  });

  it('http transport never throws on a provider failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const service = new MailService(
      makeConfig({
        MAIL_TRANSPORT: 'http',
        MAIL_API_URL: 'https://mail.example.com/send',
      }),
    );
    const result = await service.send(msg);
    expect(result).toEqual({ delivered: false, transport: 'http' });
  });

  it('http transport with no URL configured degrades to not-delivered', async () => {
    const service = new MailService(makeConfig({ MAIL_TRANSPORT: 'http' }));
    const result = await service.send(msg);
    expect(result.delivered).toBe(false);
  });
});

describe('email templates', () => {
  it('password reset carries the URL in both parts and escapes HTML', () => {
    const out = passwordResetEmail({
      resetUrl: 'https://app.test/reset?token=abc&x=1',
      expiresInMinutes: 30,
    });
    expect(out.text).toContain('https://app.test/reset?token=abc&x=1');
    expect(out.html).toContain('token=abc&amp;x=1');
    expect(out.subject).toMatch(/reset/i);
  });

  it('workspace invite names the inviter, workspace and role', () => {
    const out = workspaceInviteEmail({
      inviterName: 'Ada',
      workspaceName: 'Acme',
      role: 'MEMBER',
      acceptUrl: 'https://app.test/invite/tok',
    });
    expect(out.subject).toContain('Ada');
    expect(out.subject).toContain('Acme');
    expect(out.text).toContain('https://app.test/invite/tok');
    expect(out.text).toContain('MEMBER');
  });
});

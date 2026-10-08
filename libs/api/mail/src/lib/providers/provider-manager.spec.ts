import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailProviderManager } from './provider-manager.js';
import { parseAddress } from './sendgrid.provider.js';
import { EmailValidationError } from '../email.errors.js';

function manager(values: Record<string, string>) {
  return new EmailProviderManager({ get: (k: string) => values[k] } as unknown as ConfigService);
}

const payload = { to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('EmailProviderManager', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the log driver unless MAIL_TRANSPORT=http', () => {
    const m = manager({ RESEND_API_KEY: 're_x' });
    expect(m.primaryName).toBe('log');
    expect(m.fallbackNames).toEqual([]);
  });

  it('auto-selects the first configured driver and chains the rest', () => {
    const m = manager({ MAIL_TRANSPORT: 'http', RESEND_API_KEY: 're_x', SENDGRID_API_KEY: 'SG.x' });
    expect(m.primaryName).toBe('resend');
    expect(m.fallbackNames).toEqual(['sendgrid']);
  });

  it('honours MAIL_PROVIDER', () => {
    const m = manager({ MAIL_TRANSPORT: 'http', MAIL_PROVIDER: 'sendgrid', RESEND_API_KEY: 're_x', SENDGRID_API_KEY: 'SG.x' });
    expect(m.primaryName).toBe('sendgrid');
    expect(m.fallbackNames).toEqual(['resend']);
  });

  it('stays on an unconfigured real driver rather than silently logging', async () => {
    const m = manager({ MAIL_TRANSPORT: 'http' });
    expect(m.primaryName).toBe('resend');
    await expect(m.send(payload)).rejects.toThrow(/RESEND_API_KEY/);
  });

  it('fails over to the next driver on a provider error', async () => {
    const m = manager({ MAIL_TRANSPORT: 'http', RESEND_API_KEY: 're_x', SENDGRID_API_KEY: 'SG.x' });
    vi.spyOn(m.getProvider('resend')!, 'send').mockRejectedValue(new Error('down'));
    vi.spyOn(m.getProvider('sendgrid')!, 'send').mockResolvedValue({ id: 'sg_1', provider: 'sendgrid' });
    await expect(m.send(payload)).resolves.toEqual({ id: 'sg_1', provider: 'sendgrid' });
  });

  it('does not fail over a payload the provider rejected as invalid', async () => {
    const m = manager({ MAIL_TRANSPORT: 'http', RESEND_API_KEY: 're_x', SENDGRID_API_KEY: 'SG.x' });
    vi.spyOn(m.getProvider('resend')!, 'send').mockRejectedValue(new EmailValidationError('bad to'));
    const sendgrid = vi.spyOn(m.getProvider('sendgrid')!, 'send');
    await expect(m.send(payload)).rejects.toBeInstanceOf(EmailValidationError);
    expect(sendgrid).not.toHaveBeenCalled();
  });

  it('never reports SMTP as able to send', async () => {
    const m = manager({ MAIL_TRANSPORT: 'http', MAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.test' });
    await expect(m.send(payload)).rejects.toThrow(/not implemented/);
  });
});

describe('parseAddress', () => {
  it('splits display name and address', () => {
    expect(parseAddress('Mie <noreply@askmie.ai>')).toEqual({ name: 'Mie', email: 'noreply@askmie.ai' });
    expect(parseAddress('"Acme Corp" <a@acme.test>')).toEqual({ name: 'Acme Corp', email: 'a@acme.test' });
    expect(parseAddress('plain@x.test')).toEqual({ email: 'plain@x.test' });
  });
});

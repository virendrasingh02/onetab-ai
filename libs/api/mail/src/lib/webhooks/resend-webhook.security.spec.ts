import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ResendWebhookService } from './resend-webhook.service';

const SECRET = 'whsec_' + Buffer.from('super-secret-key-material').toString('base64');
const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'e1' } });

function service(env: Record<string, string> = { RESEND_WEBHOOK_SECRET: SECRET }) {
  return new ResendWebhookService({ get: (k: string) => env[k] } as never);
}

function sign(id: string, ts: string, payload = body, secret = SECRET) {
  const key = Buffer.from(secret.slice(6), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${ts}.${payload}`).digest('base64')}`;
}

const now = () => String(Math.floor(Date.now() / 1000));

describe('Resend webhook authentication', () => {
  it('accepts a correctly signed, fresh delivery', () => {
    const ts = now();
    expect(
      service().verifySignature(body, { 'svix-id': 'm1', 'svix-timestamp': ts, 'svix-signature': sign('m1', ts) }),
    ).toBe(true);
  });

  it('rejects a forged signature', () => {
    const ts = now();
    const forged = sign('m1', ts, body, 'whsec_' + Buffer.from('attacker').toString('base64'));
    expect(
      service().verifySignature(body, { 'svix-id': 'm1', 'svix-timestamp': ts, 'svix-signature': forged }),
    ).toBe(false);
  });

  it('rejects a tampered body', () => {
    const ts = now();
    expect(
      service().verifySignature(body.replace('delivered', 'bounced'), {
        'svix-id': 'm1',
        'svix-timestamp': ts,
        'svix-signature': sign('m1', ts),
      }),
    ).toBe(false);
  });

  it('rejects a replay outside the timestamp window', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(
      service().verifySignature(body, { 'svix-id': 'm1', 'svix-timestamp': old, 'svix-signature': sign('m1', old) }),
    ).toBe(false);
  });

  it('fails closed when no secret is configured, even outside production', () => {
    expect(service({ NODE_ENV: 'development' }).verifySignature(body, {})).toBe(false);
  });

  it('only allows unsigned events with the explicit opt-in', () => {
    expect(service({ RESEND_WEBHOOK_INSECURE: 'true' }).verifySignature(body, {})).toBe(true);
  });
});

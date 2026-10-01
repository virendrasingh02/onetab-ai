import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendProvider } from './providers/resend.provider.js';
import { LogEmailProvider } from './providers/log.provider.js';
import { EmailService } from './email.service.js';
import { ResendWebhookService } from './webhooks/resend-webhook.service.js';
import {
  EmailAuthenticationError,
  EmailRateLimitError,
  EmailValidationError,
} from './email.errors.js';
import {
  workspaceInvitationEmail,
  magicSignInEmail,
  passwordResetEmail,
  emailVerificationEmail,
  welcomeEmail,
  passwordChangedEmail,
  securityAlertEmail,
} from './templates/index.js';
import * as crypto from 'crypto';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('ResendProvider', () => {
  const payload = {
    to: 'user@example.com',
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    text: 'Welcome',
    idempotencyKey: 'idemp_123',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST to Resend endpoint with auth and idempotency header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 're_msg_1' }), { status: 200 }),
    );

    const provider = new ResendProvider({
      apiKey: 're_secret_key',
      apiUrl: 'https://api.resend.com/emails',
      defaultFrom: 'Mie <noreply@askmie.ai>',
    });

    const result = await provider.send(payload);

    expect(result).toEqual({ id: 're_msg_1', provider: 'resend' });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init as RequestInit).method).toBe('POST');

    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer re_secret_key');
    expect(headers['Idempotency-Key']).toBe('idemp_123');
  });

  it('maps 401/403 to EmailAuthenticationError without exposing the API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid API key re_secret_key' }), {
        status: 401,
      }),
    );

    const provider = new ResendProvider({
      apiKey: 're_secret_key',
      apiUrl: 'https://api.resend.com/emails',
    });

    await expect(provider.send(payload)).rejects.toThrow(EmailAuthenticationError);
    await expect(provider.send(payload)).rejects.toThrow(
      expect.not.stringContaining('re_secret_key'),
    );
  });

  it('maps 429 to EmailRateLimitError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Too many requests' }), {
        status: 429,
        headers: { 'retry-after': '10' },
      }),
    );

    const provider = new ResendProvider({
      apiKey: 're_key',
      maxRetries: 0,
    });

    await expect(provider.send(payload)).rejects.toThrow(EmailRateLimitError);
  });

  it('does not retry 422 validation errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid recipient' }), {
        status: 422,
      }),
    );

    const provider = new ResendProvider({
      apiKey: 're_key',
      maxRetries: 2,
    });

    await expect(provider.send(payload)).rejects.toThrow(EmailValidationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('EmailService - Idempotency & Database Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    LogEmailProvider.clear();
  });

  it('skips sending when matching idempotencyKey was already sent', async () => {
    const mockPrisma = {
      emailDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'delivery_1',
          status: 'SENT',
          providerMessageId: 're_existing_msg',
          provider: 'resend',
        }),
        create: vi.fn(),
      },
    };

    const config = makeConfig({
      MAIL_TRANSPORT: 'http',
      RESEND_API_KEY: 're_test',
    });

    const service = new EmailService(config, mockPrisma as any);
    const result = await service.send({
      to: 'user@example.com',
      subject: 'Invite',
      text: 'Invite text',
      html: '<p>Invite text</p>',
      idempotencyKey: 'invite:workspace1:v1',
    });

    expect(result.delivered).toBe(true);
    expect(result.skippedDuplicate).toBe(true);
    expect(result.id).toBe('re_existing_msg');
    expect(mockPrisma.emailDelivery.create).not.toHaveBeenCalled();
  });

  it('persists audit delivery record on send', async () => {
    const mockPrisma = {
      emailDelivery: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'del_rec_123' }),
      },
    };

    const config = makeConfig({
      MAIL_TRANSPORT: 'log',
    });

    const service = new EmailService(config, mockPrisma as any);
    const result = await service.send({
      to: 'ada@example.com',
      subject: 'Security Alert',
      text: 'Alert text',
      html: '<p>Alert text</p>',
      idempotencyKey: 'alert:user1:tok1',
    });

    expect(result.delivered).toBe(true);
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledOnce();
    const createCall = mockPrisma.emailDelivery.create.mock.calls[0][0];
    expect(createCall.data.recipient).toBe('ada@example.com');
    expect(createCall.data.status).toBe('SENT');
  });
});

describe('ResendWebhookService', () => {
  const secret = 'whsec_mfaslkhjf8934y52kljshfkjsdhfkjshdf=';
  const config = makeConfig({
    RESEND_WEBHOOK_SECRET: secret,
  });

  it('verifies valid Svix HMAC-SHA256 signature', () => {
    const service = new ResendWebhookService(config);

    const svixId = 'msg_svix_123';
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_123' } });

    const keyBuffer = Buffer.from(secret.slice(6), 'base64');
    const signature = crypto
      .createHmac('sha256', keyBuffer)
      .update(`${svixId}.${svixTimestamp}.${body}`)
      .digest('base64');

    const headers = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': `v1,${signature}`,
    };

    const isValid = service.verifySignature(body, headers);
    expect(isValid).toBe(true);
  });

  it('rejects tampered payload signature', () => {
    const service = new ResendWebhookService(config);
    const headers = {
      'svix-id': 'msg_1',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,invalid_signature',
    };

    expect(service.verifySignature('{"type":"email.delivered"}', headers)).toBe(false);
  });

  it('updates delivery record on email.delivered event', async () => {
    const mockPrisma = {
      emailDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const service = new ResendWebhookService(config, mockPrisma as any);
    await service.handleEvent({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: 're_email_abc' },
    });

    expect(mockPrisma.emailDelivery.updateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 're_email_abc' },
      data: expect.objectContaining({
        status: 'DELIVERED',
        deliveredAt: expect.any(Date),
      }),
    });
  });
});

describe('Central Email Templates', () => {
  it('renders workspace invitation with Mie brand and expiration', () => {
    const email = workspaceInvitationEmail({
      inviterName: 'Sarah Connor',
      workspaceName: 'Skynet Research',
      acceptUrl: 'https://askmie.ai/invite/tok123',
      expiration: '7 days',
    });

    expect(email.subject).toBe("You've been invited to join Skynet Research");
    expect(email.text).toContain('Sarah Connor invited you to join Skynet Research on Mie.');
    expect(email.text).toContain('https://askmie.ai/invite/tok123');
    expect(email.text).toContain('expires on 7 days');
    expect(email.html).toContain('Accept invitation');
    expect(email.html).toContain('Skynet Research');
  });

  it('renders magic sign in with single-use and expiration disclaimers', () => {
    const email = magicSignInEmail({
      verifyUrl: 'https://askmie.ai/auth/magic-link/verify?token=tok123',
      expiresInMinutes: 15,
    });

    expect(email.subject).toBe('Sign in to Mie');
    expect(email.text).toContain('Click the button below to securely sign in.');
    expect(email.text).toContain('expires in 15 minutes.');
    expect(email.html).toContain('Sign in to Mie');
  });

  it('renders password reset with generic security notice', () => {
    const email = passwordResetEmail({
      resetUrl: 'https://askmie.ai/reset-password?token=tok123',
      expiresInMinutes: 30,
    });

    expect(email.subject).toBe('Reset your Mie password');
    expect(email.text).toContain('We received a request to reset your password.');
    expect(email.text).toContain('expires in 30 minutes.');
    expect(email.html).toContain('Reset password');
  });

  it('renders email verification', () => {
    const email = emailVerificationEmail({
      verifyUrl: 'https://askmie.ai/verify-email?token=vtok123',
    });

    expect(email.subject).toBe('Verify your email');
    expect(email.text).toContain('Please verify your email address to finish setting up your Mie account.');
    expect(email.html).toContain('Verify email');
  });

  it('renders welcome email', () => {
    const email = welcomeEmail({
      name: 'John Doe',
      loginUrl: 'https://askmie.ai/login',
    });

    expect(email.subject).toBe('Welcome to Mie!');
    expect(email.text).toContain('Welcome to Mie, John Doe!');
    expect(email.html).toContain('Open Mie');
  });

  it('renders password changed alert', () => {
    const email = passwordChangedEmail();
    expect(email.subject).toBe('Your Mie password has been changed');
    expect(email.text).toContain('This is a confirmation that your password for Mie was changed');
  });

  it('renders security alert with device info', () => {
    const email = securityAlertEmail({
      alertTitle: 'New sign-in from unusual location',
      alertDetails: 'We detected a sign-in from an unrecognized device.',
      deviceOrLocation: 'Chrome on macOS - San Francisco, USA',
    });

    expect(email.subject).toBe('Security Alert: New sign-in from unusual location - Mie');
    expect(email.text).toContain('Chrome on macOS - San Francisco, USA');
  });
});

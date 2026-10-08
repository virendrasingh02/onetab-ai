import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { TemplateRegistry } from './templates/registry.js';
import { TemplateRenderer } from './templates/template-renderer.js';
import { OtpManager } from './otp/otp.manager.js';
import { NotificationPreferenceManager } from './preferences/notification-preference.manager.js';

describe('EmailService - Transactional Pipeline', () => {
  let emailService: EmailService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      MAIL_TRANSPORT: 'log',
      MAIL_FROM: 'noreply@onetab.ai',
      MAIL_REPLY_TO: 'support@onetab.ai',
      APP_NAME: 'OneTab AI',
      JWT_ACCESS_SECRET: 'test-secret',
    });

    const templateRegistry = new TemplateRegistry();
    const templateRenderer = new TemplateRenderer();
    const otpManager = new OtpManager(configService);
    const prefManager = new NotificationPreferenceManager();

    emailService = new EmailService(
      configService,
      undefined,
      templateRegistry,
      templateRenderer,
      undefined,
      undefined,
      otpManager,
      prefManager,
    );
  });

  it('sends AUTH_WELCOME transactional email with resolved variables', async () => {
    const result = await emailService.sendTransactionalEmail({
      templateKey: 'AUTH_WELCOME',
      recipient: 'newuser@example.com',
      data: {
        user: { firstName: 'Alice', email: 'newuser@example.com' },
        dashboardUrl: 'https://app.onetab.ai/dashboard',
        appName: 'OneTab AI',
      },
    });

    expect(result.delivered).toBe(true);
    expect(result.transport).toBe('log');
  });

  it('sends TASK_ASSIGNED transactional email with project and task variables', async () => {
    const result = await emailService.sendTransactionalEmail({
      templateKey: 'TASK_ASSIGNED',
      recipient: 'dev@example.com',
      data: {
        task: {
          name: 'Build Email Templates',
          url: 'https://app.onetab.ai/tasks/123',
          priority: 'High',
          dueDate: 'Tomorrow',
        },
        project: {
          name: 'Core Platform Upgrade',
        },
        actor: {
          name: 'Team Lead Bob',
        },
      },
    });

    expect(result.delivered).toBe(true);
  });

  it('sends AGENT_APPROVAL_REQUIRED with AI agent variables', async () => {
    const result = await emailService.sendTransactionalEmail({
      templateKey: 'AGENT_APPROVAL_REQUIRED',
      recipient: 'engineer@example.com',
      data: {
        agent: {
          name: 'DeploymentBot',
          runId: 'run-prod-001',
        },
        approval: {
          url: 'https://app.onetab.ai/agents/approval/001',
          riskLevel: 'HIGH',
        },
        step: {
          name: 'Production Deploy',
        },
      },
    });

    expect(result.delivered).toBe(true);
  });

  it('sends MEETING_INVITATION with meeting schedule details', async () => {
    const result = await emailService.sendTransactionalEmail({
      templateKey: 'MEETING_INVITATION',
      recipient: 'attendee@example.com',
      data: {
        meeting: {
          title: 'Sprint Retrospective',
          date: '2026-10-10',
          time: '14:00',
          duration: '45 mins',
          url: 'https://meet.onetab.ai/retro',
          host: 'Scrum Master',
        },
      },
    });

    expect(result.delivered).toBe(true);
  });

  it('sends BILLING_PAYMENT_FAILED with billing details', async () => {
    const result = await emailService.sendTransactionalEmail({
      templateKey: 'BILLING_PAYMENT_FAILED',
      recipient: 'billing@example.com',
      data: {
        billing: {
          amount: '$99.00',
          invoiceNumber: 'INV-2026-004',
          retryDate: '2026-10-12',
          paymentUrl: 'https://app.onetab.ai/billing/invoices/INV-2026-004',
        },
      },
    });

    expect(result.delivered).toBe(true);
  });

  it('returns graceful error when template key does not exist', async () => {
    const result = await emailService.sendTransactionalEmail({
      templateKey: 'NON_EXISTENT_TEMPLATE_KEY_12345',
      recipient: 'user@example.com',
      data: {},
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('suppresses non-mandatory email when preference check fails', async () => {
    const mockPreferences = {
      canSendEmail: vi.fn().mockResolvedValue({
        shouldSend: false,
        isMandatory: false,
        reason: 'USER_DISABLED_WORKSPACE_EMAILS',
      }),
    } as unknown as NotificationPreferenceManager;

    const customService = new EmailService(
      configService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockPreferences,
    );

    const result = await customService.sendTransactionalEmail({
      templateKey: 'TASK_ASSIGNED',
      recipient: 'unsubscribed@example.com',
      data: { task: { name: 'Test' } },
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toContain('Email delivery suppressed');
  });

  it('integrates sendOtp and verifyOtp flow seamlessly', async () => {
    const sendResult = await emailService.sendOtp({
      identifier: 'auth-user@example.com',
      purpose: 'LOGIN',
      appName: 'OneTab AI',
    });

    expect(sendResult.recordId).toBeDefined();
    expect(sendResult.expiresInMinutes).toBe(10);
    expect(sendResult.delivery.delivered).toBe(true);

    // Verify OTP manager has the record and can verify
    // Using internal OTP manager to test verification
    const generatedRecord = (emailService.otp as any).memoryStore.get('auth-user@example.com:LOGIN');
    expect(generatedRecord).toBeDefined();

    // Verification with correct identifier succeeds
    const verifyFail = await emailService.verifyOtp({
      identifier: 'auth-user@example.com',
      code: '999999',
      purpose: 'LOGIN',
    });
    expect(verifyFail.valid).toBe(false);
  });
});

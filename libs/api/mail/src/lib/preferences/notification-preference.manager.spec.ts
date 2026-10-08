import { describe, it, expect, vi } from 'vitest';
import { NotificationPreferenceManager } from './notification-preference.manager.js';
import type { PrismaService } from '@org/database';

describe('NotificationPreferenceManager', () => {
  it('identifies security, auth, invitation, and critical billing/system templates as mandatory', () => {
    const manager = new NotificationPreferenceManager();

    expect(manager.isMandatorySecurityEmail('AUTH_OTP')).toBe(true);
    expect(manager.isMandatorySecurityEmail('AUTH_PASSWORD_RESET')).toBe(true);
    expect(manager.isMandatorySecurityEmail('SECURITY_SUSPICIOUS_LOGIN')).toBe(true);
    expect(manager.isMandatorySecurityEmail('WORKSPACE_INVITATION')).toBe(true);
    expect(manager.isMandatorySecurityEmail('BILLING_PAYMENT_FAILED')).toBe(true);
    expect(manager.isMandatorySecurityEmail('SYSTEM_SERVICE_INTERRUPTION')).toBe(true);

    // Non-mandatory transactional notifications
    expect(manager.isMandatorySecurityEmail('TASK_ASSIGNED')).toBe(false);
    expect(manager.isMandatorySecurityEmail('MEETING_INVITATION')).toBe(false);
    expect(manager.isMandatorySecurityEmail('AGENT_EXECUTION_COMPLETED')).toBe(false);
    expect(manager.isMandatorySecurityEmail('DOC_COMMENT')).toBe(false);
  });

  it('always allows mandatory emails even if user has disabled email notifications', async () => {
    const mockPrisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: false,
        }),
      },
    } as unknown as PrismaService;

    const manager = new NotificationPreferenceManager(mockPrisma);

    const result = await manager.canSendEmail({
      templateKey: 'AUTH_OTP',
      userId: 'user-123',
      workspaceId: 'ws-456',
    });

    expect(result.shouldSend).toBe(true);
    expect(result.isMandatory).toBe(true);
  });

  it('always sends when forceSend is true', async () => {
    const mockPrisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: false,
        }),
      },
    } as unknown as PrismaService;

    const manager = new NotificationPreferenceManager(mockPrisma);

    const result = await manager.canSendEmail({
      templateKey: 'TASK_ASSIGNED',
      userId: 'user-123',
      workspaceId: 'ws-456',
      forceSend: true,
    });

    expect(result.shouldSend).toBe(true);
    expect(result.isMandatory).toBe(true);
  });

  it('suppresses non-mandatory email when user has emailEnabled=false in preferences', async () => {
    const mockPrisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: false,
        }),
      },
    } as unknown as PrismaService;

    const manager = new NotificationPreferenceManager(mockPrisma);

    const result = await manager.canSendEmail({
      templateKey: 'TASK_ASSIGNED',
      userId: 'user-123',
      workspaceId: 'ws-456',
    });

    expect(result.shouldSend).toBe(false);
    expect(result.reason).toBe('USER_DISABLED_WORKSPACE_EMAILS');
  });

  it('allows non-mandatory email when user has emailEnabled=true', async () => {
    const mockPrisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: true,
        }),
      },
    } as unknown as PrismaService;

    const manager = new NotificationPreferenceManager(mockPrisma);

    const result = await manager.canSendEmail({
      templateKey: 'TASK_ASSIGNED',
      userId: 'user-123',
      workspaceId: 'ws-456',
    });

    expect(result.shouldSend).toBe(true);
  });
});

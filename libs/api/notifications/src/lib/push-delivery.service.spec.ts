import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isExpoPushToken,
  isWithinQuietHours,
  PushDeliveryService,
} from './push-delivery.service.js';

describe('isExpoPushToken', () => {
  it('accepts both Expo token spellings and rejects web push endpoints', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('https://fcm.googleapis.com/fcm/send/xyz')).toBe(
      false,
    );
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
  });
});

describe('isWithinQuietHours', () => {
  const at = (iso: string) => new Date(iso);

  it('handles a same-day window in the user time zone', () => {
    // 13:30 UTC is 19:00 in Kolkata (UTC+5:30).
    expect(
      isWithinQuietHours(
        at('2026-10-19T13:30:00Z'),
        'Asia/Kolkata',
        '18:00',
        '20:00',
      ),
    ).toBe(true);
    expect(
      isWithinQuietHours(at('2026-10-19T13:30:00Z'), 'UTC', '18:00', '20:00'),
    ).toBe(false);
  });

  it('handles a window that wraps midnight', () => {
    expect(
      isWithinQuietHours(at('2026-10-19T23:30:00Z'), 'UTC', '22:00', '07:00'),
    ).toBe(true);
    expect(
      isWithinQuietHours(at('2026-10-19T06:59:00Z'), 'UTC', '22:00', '07:00'),
    ).toBe(true);
    expect(
      isWithinQuietHours(at('2026-10-19T07:00:00Z'), 'UTC', '22:00', '07:00'),
    ).toBe(false);
  });

  it('never suppresses on a missing or malformed window or zone', () => {
    const now = at('2026-10-19T23:30:00Z');
    expect(isWithinQuietHours(now, 'UTC', null, '07:00')).toBe(false);
    expect(isWithinQuietHours(now, 'UTC', '25:00', '07:00')).toBe(false);
    expect(isWithinQuietHours(now, 'Not/AZone', '22:00', '07:00')).toBe(false);
  });
});

describe('PushDeliveryService', () => {
  let prisma: any;
  let config: { get: ReturnType<typeof vi.fn> };
  let service: PushDeliveryService;
  let fetchMock: ReturnType<typeof vi.fn>;

  const event = {
    recipientId: 'u_1',
    workspaceId: 'ws_1',
    unreadCount: 3,
    notification: {
      id: 'n_1',
      title: 'Ana assigned you a task',
      body: 'Ship the release',
      deepLink: 'tasks/t_1',
      kind: 'TASK_ASSIGNED',
    },
  };

  beforeEach(() => {
    prisma = {
      pushRegistration: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r_phone', pushKey: 'ExponentPushToken[phone]' },
          { id: 'r_gone', pushKey: 'ExponentPushToken[gone]' },
          { id: 'r_web', pushKey: 'https://push.example/endpoint' },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      notificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
      workspace: { findUnique: vi.fn().mockResolvedValue({ slug: 'acme' }) },
    };
    config = { get: vi.fn().mockReturnValue(undefined) };
    service = new PushDeliveryService(prisma, config as any);
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'ok', id: 'ticket_1' },
          { status: 'error', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only to Expo tokens with the deep link and workspace slug', async () => {
    const delivered = await service.deliver(
      event,
      new Date('2026-10-19T12:00:00Z'),
    );

    expect(delivered).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      to: 'ExponentPushToken[phone]',
      title: 'Ana assigned you a task',
      badge: 3,
      data: {
        deepLink: 'tasks/t_1',
        workspaceSlug: 'acme',
        notificationId: 'n_1',
      },
    });
  });

  it('revokes registrations Expo reports as no longer registered', async () => {
    await service.deliver(event);
    expect(prisma.pushRegistration.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['r_gone'] } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('respects the workspace push toggle', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      pushEnabled: false,
    });
    expect(await service.deliver(event)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays silent during quiet hours', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    });
    expect(await service.deliver(event, new Date('2026-10-19T23:00:00Z'))).toBe(
      0,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when the user has no mobile devices', async () => {
    prisma.pushRegistration.findMany.mockResolvedValue([
      { id: 'r_web', pushKey: 'https://push.example/endpoint' },
    ]);
    expect(await service.deliver(event)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows transport failures in the event handler', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(service.onNotificationCreated(event)).resolves.toBeUndefined();
  });

  it('can be disabled by configuration', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'PUSH_DELIVERY_DISABLED' ? 'true' : undefined,
    );
    expect(await service.deliver(event)).toBe(0);
    expect(prisma.pushRegistration.findMany).not.toHaveBeenCalled();
  });
});

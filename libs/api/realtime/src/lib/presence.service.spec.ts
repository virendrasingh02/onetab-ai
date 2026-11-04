import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { PresenceService } from './presence.service.js';

describe('PresenceService (backend)', () => {
  let presenceService: PresenceService;
  let mockPrisma: any;
  let mockEvents: any;
  let mockCache: any;

  const statuses = () =>
    mockEvents.emit.mock.calls
      .filter(([name]: [string]) => name === AppEvent.PresenceUpdated)
      .map(([, e]: [string, any]) => e.presence.status);

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-04T10:00:00Z') });

    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          presence: 'OFFLINE',
          presenceManualAway: false,
          statusText: null,
          statusEmoji: null,
          lastSeenAt: new Date(),
        }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      workspaceMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { workspaceId: 'ws-1' },
            { workspaceId: 'ws-2' },
          ]),
      },
    };

    mockEvents = { emit: vi.fn() };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(true),
    };

    presenceService = new PresenceService(
      mockPrisma as any,
      mockCache as any,
      mockEvents as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records connection, sets presence to ONLINE and emits event', async () => {
    const presence = await presenceService.recordConnection(
      'client-1',
      'user-1',
      'ws-1',
    );

    expect(presence.status).toBe('online');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ presence: 'ONLINE' }),
      }),
    );
    expect(statuses()).toEqual(['online']);
  });

  it('announces presence to every workspace the user shares', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');

    const [, event] = mockEvents.emit.mock.calls[0];
    expect(event.targetWorkspaces.sort()).toEqual(['ws-1', 'ws-2']);
  });

  it('holds the status through a reload instead of flashing offline', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');
    mockEvents.emit.mockClear();

    await presenceService.removeConnection('client-1');
    await vi.advanceTimersByTimeAsync(2_000);
    await presenceService.reapStalePresence();
    await presenceService.recordConnection('client-2', 'user-1', 'ws-1');

    expect(statuses()).toEqual([]);
  });

  it('goes OFFLINE shortly after the last client disconnects', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');
    mockEvents.emit.mockClear();

    await presenceService.removeConnection('client-1');
    await vi.advanceTimersByTimeAsync(11_000);
    await presenceService.reapStalePresence();

    expect(mockPrisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ presence: 'OFFLINE' }),
      }),
    );
    expect(statuses()).toEqual(['offline']);
  });

  it('goes offline when heartbeats stop even though the stream looks open', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');
    await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'away',
      undefined,
      undefined,
      'tab-a',
    );
    mockEvents.emit.mockClear();

    await vi.advanceTimersByTimeAsync(91_000);
    await presenceService.reapStalePresence();

    expect(statuses()).toEqual(['offline']);
  });

  it('broadcasts when a reconnect brings an away user back online', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');
    await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'away',
      undefined,
      undefined,
      'tab-a',
    );
    mockEvents.emit.mockClear();

    await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'online',
      undefined,
      undefined,
      'tab-b',
    );

    expect(statuses()).toEqual(['online']);
  });

  it('records heartbeat and handles status updates', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');
    mockEvents.emit.mockClear();

    const result = await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'away',
      'In a meeting',
      '📅',
    );

    expect(result.status).toBe('away');
    expect(result.statusText).toBe('In a meeting');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ presence: 'AWAY' }),
      }),
    );
    expect(statuses()).toEqual(['away']);
  });

  it('stays online while any device is active, however idle the others are', async () => {
    await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'online',
      undefined,
      undefined,
      'tab-a',
    );
    mockEvents.emit.mockClear();

    for (let beat = 0; beat < 3; beat++) {
      await presenceService.recordHeartbeat(
        'user-1',
        'ws-1',
        'away',
        undefined,
        undefined,
        'tab-b',
      );
      await presenceService.recordHeartbeat(
        'user-1',
        'ws-1',
        'online',
        undefined,
        undefined,
        'tab-a',
      );
    }

    expect(statuses()).toEqual([]);
  });

  it('keeps a pinned away across an API restart', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      presence: 'AWAY',
      presenceManualAway: true,
      statusText: null,
      statusEmoji: null,
      lastSeenAt: new Date(),
    });

    const result = await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'online',
      undefined,
      undefined,
      'tab-a',
    );

    expect(result.status).toBe('away');
    expect(result.manualAway).toBe(true);
  });

  it('loads a user once when a heartbeat races the stream', async () => {
    await Promise.all([
      presenceService.recordConnection('client-1', 'user-1', 'ws-1'),
      presenceService.recordHeartbeat(
        'user-1',
        'ws-1',
        'online',
        undefined,
        undefined,
        'tab-a',
      ),
    ]);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('shows a status set outside the heartbeat path', async () => {
    await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'online',
      undefined,
      undefined,
      'tab-a',
    );
    mockEvents.emit.mockClear();

    await presenceService.onUserStatusChanged({
      userId: 'user-1',
      workspaceIds: ['ws-1'],
      statusText: 'Focusing',
      statusEmoji: '🎧',
      presence: 'BUSY',
      source: 'manual',
    } as any);
    const during = await presenceService.recordHeartbeat(
      'user-1',
      'ws-1',
      'online',
      undefined,
      undefined,
      'tab-a',
    );

    expect(during.status).toBe('busy');
    expect(during.statusText).toBe('Focusing');
    expect(statuses()).toContain('busy');

    await presenceService.onUserStatusChanged({
      userId: 'user-1',
      workspaceIds: ['ws-1'],
      statusText: null,
      statusEmoji: null,
      presence: 'ONLINE',
      source: 'manual',
    } as any);

    const after = await presenceService.getUserPresence('user-1', 'ws-1');
    expect(after.status).toBe('online');
  });

  it('reports nobody-live members offline, whatever the DB column says', async () => {
    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      {
        userId: 'ghost',
        user: {
          presence: 'ONLINE',
          lastSeenAt: new Date(),
          statusText: null,
          statusEmoji: null,
        },
      },
    ]);

    const [ghost] = await presenceService.getWorkspacePresence('ws-1');

    expect(ghost.status).toBe('offline');
  });

  it('clears DB rows a crash left online, but not live users', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');

    await presenceService.sweepGhostPresence();

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          presence: { not: 'OFFLINE' },
          id: { notIn: ['user-1'] },
        }),
        data: { presence: 'OFFLINE' },
      }),
    );
  });
});

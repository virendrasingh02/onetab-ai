import { EventEmitter2 } from '@nestjs/event-emitter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PresenceService } from './presence.service.js';

describe('PresenceService (backend)', () => {
  let presenceService: PresenceService;
  let mockPrisma: any;
  let mockEvents: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          presence: 'OFFLINE',
          statusText: null,
          statusEmoji: null,
          lastSeenAt: new Date(),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([{ workspaceId: 'ws-1' }]),
      },
    };

    mockEvents = {
      emit: vi.fn(),
    };

    presenceService = new PresenceService(mockPrisma as any, mockEvents as any);
  });

  it('records connection, sets presence to ONLINE and emits event', async () => {
    const presence = await presenceService.recordConnection('client-1', 'user-1', 'ws-1');

    expect(presence.status).toBe('online');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ presence: 'ONLINE' }),
      }),
    );
    expect(mockEvents.emit).toHaveBeenCalledTimes(1);
  });

  it('removes connection and sets presence to OFFLINE when last client disconnects', async () => {
    await presenceService.recordConnection('client-1', 'user-1', 'ws-1');
    mockEvents.emit.mockClear();

    await presenceService.removeConnection('client-1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ presence: 'OFFLINE' }),
      }),
    );
    expect(mockEvents.emit).toHaveBeenCalledTimes(1);
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
    expect(mockEvents.emit).toHaveBeenCalledTimes(1);
  });
});

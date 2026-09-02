import { describe, expect, it } from 'vitest';
import { PresenceService } from './presence-service.js';
import { RealtimeEventBus } from './realtime-event-bus.js';
import { RealtimeEventType } from './types.js';

describe('PresenceService (client)', () => {
  it('updates local cache on presence.updated event', () => {
    const bus = new RealtimeEventBus();
    const service = new PresenceService({
      bus,
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    expect(service.isOnline('user-2')).toBe(false);

    bus.emit({
      id: 'presence-1',
      type: RealtimeEventType.PresenceUpdated,
      timestamp: new Date().toISOString(),
      payload: {
        userId: 'user-2',
        status: 'online',
        workspaceId: 'ws-1',
      },
    });

    expect(service.isOnline('user-2')).toBe(true);
    expect(service.getPresence('user-2').status).toBe('online');

    bus.emit({
      id: 'presence-2',
      type: RealtimeEventType.PresenceUpdated,
      timestamp: new Date().toISOString(),
      payload: {
        userId: 'user-2',
        status: 'away',
        workspaceId: 'ws-1',
      },
    });

    expect(service.isOnline('user-2')).toBe(false);
    expect(service.getPresence('user-2').status).toBe('away');

    service.dispose();
  });
});

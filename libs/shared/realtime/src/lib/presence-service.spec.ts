import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '@org/api-client';
import { PresenceService } from './presence-service.js';
import { RealtimeEventBus } from './realtime-event-bus.js';
import { RealtimeEventType } from './types.js';

describe('PresenceService (client)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const snapshot = (status: 'online' | 'away') => ({
    data: { presence: [{ userId: 'user-2', status }] },
  });

  it('loads the roster for the workspace it starts in', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue(snapshot('away'));
    const service = new PresenceService({
      bus: new RealtimeEventBus(),
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    await vi.waitFor(() =>
      expect(service.getPresence('user-2').status).toBe('away'),
    );
    expect(get).toHaveBeenCalledWith('/workspaces/ws-1/presence');

    service.dispose();
  });

  it('stops showing people live once the connection is really gone', async () => {
    vi.useFakeTimers();
    vi.spyOn(http, 'get').mockResolvedValue(snapshot('online'));
    const service = new PresenceService({
      bus: new RealtimeEventBus(),
      userId: 'user-1',
      workspaceId: 'ws-1',
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(service.getPresence('user-2').status).toBe('online');

    service.setConnected(false);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(service.getPresence('user-2').status).toBe('online');

    await vi.advanceTimersByTimeAsync(6_000);
    expect(service.getPresence('user-2').status).toBe('offline');
    expect(service.getAllPresence()['user-1']?.status).toBe('offline');

    service.dispose();
  });

  it('ignores a short blip', async () => {
    vi.useFakeTimers();
    vi.spyOn(http, 'get').mockResolvedValue(snapshot('online'));
    const service = new PresenceService({
      bus: new RealtimeEventBus(),
      userId: 'user-1',
      workspaceId: 'ws-1',
    });
    await vi.advanceTimersByTimeAsync(0);

    service.setConnected(false);
    await vi.advanceTimersByTimeAsync(3_000);
    service.setConnected(true);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(service.getPresence('user-2').status).toBe('online');

    service.dispose();
  });

  it('reloads the roster when the connection returns', async () => {
    vi.useFakeTimers();
    const get = vi.spyOn(http, 'get').mockResolvedValue(snapshot('online'));
    const service = new PresenceService({
      bus: new RealtimeEventBus(),
      userId: 'user-1',
      workspaceId: 'ws-1',
    });
    await vi.advanceTimersByTimeAsync(0);
    service.setConnected(false);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(service.getPresence('user-2').status).toBe('offline');

    get.mockResolvedValue(snapshot('away'));
    service.setConnected(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(service.getPresence('user-2').status).toBe('away');

    service.dispose();
  });

  it('clears a teammate status when the server sends null', () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: { presence: [] } });
    const bus = new RealtimeEventBus();
    const service = new PresenceService({ bus, userId: 'user-1' });
    const send = (id: string, statusText: string | null) =>
      bus.emit({
        id,
        type: RealtimeEventType.PresenceUpdated,
        timestamp: new Date().toISOString(),
        payload: { userId: 'user-2', status: 'online', statusText },
      });

    send('a', 'Lunch');
    send('b', null);

    expect(service.getPresence('user-2').statusText).toBeNull();

    service.dispose();
  });

  it('updates local cache on presence.updated event', () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: { presence: [] } });
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

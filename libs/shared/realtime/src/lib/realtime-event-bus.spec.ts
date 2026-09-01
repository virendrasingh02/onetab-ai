import { describe, expect, it, vi } from 'vitest';
import { RealtimeEventBus } from './realtime-event-bus.js';
import { RealtimeEventType } from './types.js';

describe('RealtimeEventBus', () => {
  it('dispatches events to registered listeners', () => {
    const bus = new RealtimeEventBus();
    const handler = vi.fn();

    const unsub = bus.on(RealtimeEventType.TaskCreated, handler);

    bus.emit({
      id: 'evt-1',
      type: RealtimeEventType.TaskCreated,
      timestamp: new Date().toISOString(),
      payload: { taskId: 'task-1', title: 'Test Task' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt-1',
        type: RealtimeEventType.TaskCreated,
        payload: { taskId: 'task-1', title: 'Test Task' },
      }),
    );

    unsub();
    bus.emit({
      id: 'evt-2',
      type: RealtimeEventType.TaskCreated,
      timestamp: new Date().toISOString(),
      payload: { taskId: 'task-2', title: 'Test Task 2' },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('deduplicates events with the same id', () => {
    const bus = new RealtimeEventBus();
    const handler = vi.fn();

    bus.on(RealtimeEventType.PresenceUpdated, handler);

    const event = {
      id: 'evt-dup-1',
      type: RealtimeEventType.PresenceUpdated,
      timestamp: new Date().toISOString(),
      payload: { userId: 'u1', status: 'online' as const },
    };

    const first = bus.emit(event);
    const second = bus.emit(event);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles wildcard onAny listeners and isolates errors', () => {
    const bus = new RealtimeEventBus();
    const errorThrower = vi.fn().mockImplementation(() => {
      throw new Error('Listener error');
    });
    const goodListener = vi.fn();

    bus.on(RealtimeEventType.NotificationCreated, errorThrower);
    bus.onAny(goodListener);

    bus.emit({
      id: 'evt-3',
      type: RealtimeEventType.NotificationCreated,
      timestamp: new Date().toISOString(),
      payload: { unreadCount: 5 },
    });

    expect(errorThrower).toHaveBeenCalledTimes(1);
    expect(goodListener).toHaveBeenCalledTimes(1);
  });
});

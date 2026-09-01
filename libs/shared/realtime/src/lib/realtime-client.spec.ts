import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from './realtime-client.js';
import { RealtimeEventBus } from './realtime-event-bus.js';
import { RealtimeEventType } from './types.js';

describe('RealtimeClient', () => {
  let mockEventSourceInstances: any[] = [];

  beforeEach(() => {
    mockEventSourceInstances = [];

    // Mock EventSource
    (globalThis as any).EventSource = class MockEventSource {
      url: string;
      onopen: (() => void) | null = null;
      onmessage: ((event: any) => void) | null = null;
      onerror: ((error: any) => void) | null = null;
      listeners = new Map<string, Function>();

      constructor(url: string) {
        this.url = url;
        mockEventSourceInstances.push(this);
      }

      addEventListener(type: string, handler: Function) {
        this.listeners.set(type, handler);
      }

      close() {
        // closed
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects when token is present and updates state', () => {
    const bus = new RealtimeEventBus();
    const client = new RealtimeClient({
      bus,
      getToken: () => 'valid-jwt-token',
      workspaceId: 'ws-123',
      baseUrl: 'http://localhost:3000/api/v1',
      autoConnect: false,
    });

    expect(client.getState()).toBe('disconnected');

    client.connect();

    expect(mockEventSourceInstances.length).toBe(1);
    const es = mockEventSourceInstances[0];
    expect(es.url).toContain('/realtime/stream?token=valid-jwt-token&workspaceId=ws-123');

    // Simulate open
    es.onopen();
    expect(client.getState()).toBe('connected');

    client.disconnect();
    expect(client.getState()).toBe('disconnected');
  });

  it('receives incoming events and routes to event bus', () => {
    const bus = new RealtimeEventBus();
    const received: any[] = [];
    bus.on(RealtimeEventType.TaskUpdated, (e) => received.push(e));

    const client = new RealtimeClient({
      bus,
      getToken: () => 'token',
      baseUrl: 'http://localhost:3000/api/v1',
      autoConnect: true,
    });

    const es = mockEventSourceInstances[0];
    es.onopen();

    const sampleEvent = {
      id: 'task-upd-1',
      type: RealtimeEventType.TaskUpdated,
      timestamp: new Date().toISOString(),
      payload: { taskId: 't1', title: 'Updated' },
    };

    es.onmessage({ data: JSON.stringify(sampleEvent) });

    expect(received.length).toBe(1);
    expect(received[0].payload.taskId).toBe('t1');

    client.dispose();
  });
});

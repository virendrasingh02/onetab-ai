import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@org/api-client', () => ({
  getAccessToken: () => null,
  http: { post: vi.fn() },
}));

import { http } from '@org/api-client';
import { RealtimeClient } from './realtime-client.js';
import { RealtimeEventBus } from './realtime-event-bus.js';
import { RealtimeEventType } from './types.js';

/** Lets the async ticket fetch inside `connect()` settle before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('RealtimeClient', () => {
  let mockEventSourceInstances: any[] = [];

  beforeEach(() => {
    mockEventSourceInstances = [];
    vi.mocked(http.post).mockResolvedValue({ data: { ticket: 'tkt-1' } } as any);

    // Mock EventSource
    (globalThis as any).EventSource = class MockEventSource {
      url: string;
      onopen: (() => void) | null = null;
      onmessage: ((event: any) => void) | null = null;
      onerror: ((error: any) => void) | null = null;
      listeners = new Map<string, (event: unknown) => void>();

      constructor(url: string) {
        this.url = url;
        mockEventSourceInstances.push(this);
      }

      addEventListener(type: string, handler: (event: unknown) => void) {
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

  it('trades the token for a stream ticket and connects', async () => {
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
    expect(client.getState()).toBe('connecting');
    await flush();

    expect(mockEventSourceInstances.length).toBe(1);
    const es = mockEventSourceInstances[0];
    expect(es.url).toContain('/realtime/stream?ticket=tkt-1&workspaceId=ws-123');
    // The raw access token must never appear in the stream URL.
    expect(es.url).not.toContain('valid-jwt-token');

    es.onopen();
    expect(client.getState()).toBe('connected');

    client.disconnect();
    expect(client.getState()).toBe('disconnected');
  });

  it('falls back to the token in the URL when the ticket endpoint fails', async () => {
    vi.mocked(http.post).mockRejectedValueOnce(new Error('offline'));

    const bus = new RealtimeEventBus();
    const client = new RealtimeClient({
      bus,
      getToken: () => 'valid-jwt-token',
      baseUrl: 'http://localhost:3000/api/v1',
      autoConnect: false,
    });

    client.connect();
    await flush();

    const es = mockEventSourceInstances[0];
    expect(es.url).toContain('token=valid-jwt-token');
    client.dispose();
  });

  it('receives incoming events and routes to event bus', async () => {
    const bus = new RealtimeEventBus();
    const received: any[] = [];
    bus.on(RealtimeEventType.TaskUpdated, (e) => received.push(e));

    const client = new RealtimeClient({
      bus,
      getToken: () => 'token',
      baseUrl: 'http://localhost:3000/api/v1',
      autoConnect: true,
    });

    await flush();
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

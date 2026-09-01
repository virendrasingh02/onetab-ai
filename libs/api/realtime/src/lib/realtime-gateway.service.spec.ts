import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { RealtimeGatewayService } from './realtime-gateway.service.js';

describe('RealtimeGatewayService', () => {
  let gateway: RealtimeGatewayService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'user-1' },
          { userId: 'user-2' },
        ]),
      },
    };
    gateway = new RealtimeGatewayService(mockPrisma as any);
  });

  it('registers and unregisters clients', () => {
    const subject = new Subject<any>();
    gateway.registerClient('c1', 'user-1', 'ws-1', subject);

    expect(gateway.getConnectionCount()).toBe(1);

    gateway.unregisterClient('c1');
    expect(gateway.getConnectionCount()).toBe(0);
  });

  it('broadcasts events to authorized workspace members only', async () => {
    const s1 = new Subject<any>();
    const s2 = new Subject<any>();
    const received1: any[] = [];
    const received2: any[] = [];

    s1.subscribe((e) => received1.push(e));
    s2.subscribe((e) => received2.push(e));

    gateway.registerClient('c1', 'user-1', 'ws-1', s1);
    gateway.registerClient('c2', 'user-2', 'ws-1', s2);

    await gateway.broadcastToWorkspace('ws-1', {
      type: 'task.created',
      payload: { taskId: 't-1' },
    });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
    expect(JSON.parse(received1[0].data).payload.taskId).toBe('t-1');
  });
});

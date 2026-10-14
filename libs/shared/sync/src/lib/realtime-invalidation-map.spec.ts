import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRealtimeEvent } from './realtime-invalidation-map.js';

const WS = 'ws_1';

function ctx() {
  const qc = new QueryClient();
  const invalidate = vi
    .spyOn(qc, 'invalidateQueries')
    .mockImplementation(() => undefined as never);
  return { qc, invalidate };
}

function keys(spy: ReturnType<typeof vi.fn>): unknown[][] {
  return spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
}

function evt(type: string, payload: unknown, workspaceId: string | null = WS) {
  return {
    id: `e-${Math.random()}`,
    type,
    timestamp: new Date().toISOString(),
    workspaceId,
    payload,
  };
}

describe('applyRealtimeEvent', () => {
  let c: ReturnType<typeof ctx>;
  beforeEach(() => {
    c = ctx();
  });

  it('refreshes every agent cache family, and that agent’s detail, on agent.updated', () => {
    vi.useFakeTimers();
    const applied = applyRealtimeEvent(
      evt('agent.updated', { workspaceId: WS, agentId: 'a1', kind: 'entity', action: 'updated' }),
      { queryClient: c.qc, workspaceId: WS },
    );
    expect(applied).toBeGreaterThan(0);
    vi.advanceTimersByTime(200);
    const k = keys(c.invalidate);
    expect(k).toContainEqual(['agents', WS]);
    expect(k).toContainEqual(['agent-studio', WS]);
    expect(k).toContainEqual(['studio-agents', WS]);
    expect(k).toContainEqual(['agent-detail', WS, 'a1']);
    expect(k).toContainEqual(['agent-versions', WS, 'a1']);
    expect(k).toContainEqual(['ai-entities', WS]);
    expect(k).toContainEqual(['coworkers', WS]);
    vi.useRealTimers();
  });

  it('coalesces a burst of agent events into one refresh', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      applyRealtimeEvent(
        evt('agent.updated', { workspaceId: WS, agentId: 'a2', kind: 'entity', action: 'updated' }),
        { queryClient: c.qc, workspaceId: WS },
      );
    }
    vi.advanceTimersByTime(200);
    const agentLists = keys(c.invalidate).filter((k) => k.length === 2 && k[0] === 'agents');
    expect(agentLists).toHaveLength(1); // one sweep for the whole burst, not 3x
    vi.useRealTimers();
  });

  it('drops an event whose workspace is not the active one', () => {
    const applied = applyRealtimeEvent(
      evt('channel.created', { workspaceId: 'ws_other' }, 'ws_other'),
      { queryClient: c.qc, workspaceId: WS },
    );
    expect(applied).toBe(0);
    expect(c.invalidate).not.toHaveBeenCalled();
  });

  it('drops an event when a payload workspace mismatches even if top-level is absent', () => {
    const applied = applyRealtimeEvent(
      evt('notification.created', {
        workspaceId: 'ws_other',
        notification: { kind: 'MENTION' },
      }, null),
      { queryClient: c.qc, workspaceId: WS },
    );
    expect(applied).toBe(0);
  });

  it('notification.created invalidates the four notification keys', () => {
    applyRealtimeEvent(
      evt('notification.created', {
        workspaceId: WS,
        notification: { kind: 'TASK_ASSIGNED' },
      }, null),
      { queryClient: c.qc, workspaceId: WS },
    );
    const flat = keys(c.invalidate).map((k) => JSON.stringify(k));
    expect(flat).toEqual(
      expect.arrayContaining([
        JSON.stringify(['notifications', WS, 'unread-count']),
        JSON.stringify(['notifications', WS, 'feed']),
        JSON.stringify(['notifications', WS, 'list', 'all']),
        JSON.stringify(['notifications', WS, 'list', 'unread']),
      ]),
    );
  });

  it('CHANNEL_ACCESS_EXPIRED additionally nudges the channel list', () => {
    applyRealtimeEvent(
      evt('notification.created', {
        workspaceId: WS,
        notification: { kind: 'CHANNEL_ACCESS_EXPIRED' },
      }, null),
      { queryClient: c.qc, workspaceId: WS },
    );
    expect(keys(c.invalidate).map((k) => JSON.stringify(k))).toContain(
      JSON.stringify(['channels', WS]),
    );
  });

  it('task.updated invalidates the task detail and the board', () => {
    applyRealtimeEvent(evt('task.updated', { workspaceId: WS, taskId: 't1' }), {
      queryClient: c.qc,
      workspaceId: WS,
    });
    const flat = keys(c.invalidate).map((k) => JSON.stringify(k));
    expect(flat).toContain(JSON.stringify(['work-tools', WS, 'tasks']));
    expect(
      flat.some((k) => k.includes('"detail"') && k.includes('"t1"')),
    ).toBe(true);
  });

  it('channel.* events invalidate the channel list', () => {
    for (const t of ['channel.created', 'channel.updated', 'channel.deleted']) {
      const local = ctx();
      applyRealtimeEvent(evt(t, { workspaceId: WS }), {
        queryClient: local.qc,
        workspaceId: WS,
      });
      expect(keys(local.invalidate).map((k) => JSON.stringify(k))).toContain(
        JSON.stringify(['channels', WS]),
      );
    }
  });

  it('an unknown event type is a no-op', () => {
    const applied = applyRealtimeEvent(evt('something.weird', {}), {
      queryClient: c.qc,
      workspaceId: WS,
    });
    expect(applied).toBe(0);
    expect(c.invalidate).not.toHaveBeenCalled();
  });

  it('returns 0 when there is no active workspace', () => {
    expect(
      applyRealtimeEvent(evt('channel.created', {}), {
        queryClient: c.qc,
        workspaceId: '',
      }),
    ).toBe(0);
  });
});

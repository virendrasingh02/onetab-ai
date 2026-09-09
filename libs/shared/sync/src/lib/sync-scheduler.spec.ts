import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncScheduler } from './sync-scheduler.js';
import { CADENCE_BASE_MS } from './sync-resource.js';

/** A scheduler wired to a controllable clock and a spied query client. */
function makeScheduler() {
  let now = 0;
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, 'invalidateQueries').mockImplementation(
    () => undefined as never,
  );
  const scheduler = new SyncScheduler(qc, () => now);
  return {
    scheduler,
    invalidate,
    advance: (ms: number) => {
      now += ms;
    },
    tick: () => (scheduler as unknown as { tick: () => void }).tick(),
  };
}

const WS = 'ws_1';

const baseResource = {
  id: 'r1',
  workspaceId: WS,
  resourceType: 'test',
  queryKey: ['test', WS, 'thing'],
  cadence: 'high' as const,
};

describe('SyncScheduler', () => {
  let ctx: ReturnType<typeof makeScheduler>;

  beforeEach(() => {
    ctx = makeScheduler();
    ctx.scheduler.updateConditions({
      online: true,
      visible: true,
      realtimeConnected: false,
      activeWorkspaceId: WS,
      isLeader: true,
    });
  });

  it('invalidates a due resource for the active workspace and calls onInvalidate', () => {
    const fan = vi.fn();
    ctx.scheduler.onInvalidate = fan;
    ctx.scheduler.register(baseResource);

    ctx.tick(); // not due yet (registered at now=0, interval 30s)
    expect(ctx.invalidate).not.toHaveBeenCalled();

    ctx.advance(CADENCE_BASE_MS.high + 1);
    ctx.tick();
    expect(ctx.invalidate).toHaveBeenCalledWith({
      queryKey: ['test', WS, 'thing'],
    });
    expect(fan).toHaveBeenCalledWith(['test', WS, 'thing'], WS);
  });

  it('never fires for a resource outside the active workspace', () => {
    ctx.scheduler.register({ ...baseResource, workspaceId: 'ws_other' });
    ctx.advance(CADENCE_BASE_MS.high * 10);
    ctx.tick();
    expect(ctx.invalidate).not.toHaveBeenCalled();
  });

  it('suspends all polling while offline', () => {
    ctx.scheduler.register(baseResource);
    ctx.scheduler.updateConditions({ online: false });
    ctx.advance(CADENCE_BASE_MS.high * 10);
    ctx.tick();
    expect(ctx.invalidate).not.toHaveBeenCalled();
  });

  it('only the leader tab polls', () => {
    ctx.scheduler.register(baseResource);
    ctx.scheduler.updateConditions({ isLeader: false });
    ctx.advance(CADENCE_BASE_MS.high * 10);
    ctx.tick();
    expect(ctx.invalidate).not.toHaveBeenCalled();
  });

  it('suppresses a realtime-backed resource entirely while the socket is up', () => {
    ctx.scheduler.register({
      ...baseResource,
      realtimeEvents: ['notification.created'],
    });
    ctx.scheduler.updateConditions({ realtimeConnected: true });
    ctx.advance(CADENCE_BASE_MS.low * 10);
    ctx.tick();
    expect(ctx.invalidate).not.toHaveBeenCalled();

    // Socket drops → it falls back to the low cadence.
    ctx.scheduler.updateConditions({ realtimeConnected: false });
    ctx.advance(CADENCE_BASE_MS.low + 1);
    ctx.tick();
    expect(ctx.invalidate).toHaveBeenCalledTimes(1);
  });

  it('pauses low-cadence resources while the tab is hidden and stretches high ones', () => {
    ctx.scheduler.register({ ...baseResource, id: 'low', cadence: 'low' });
    ctx.scheduler.register({ ...baseResource, id: 'high', cadence: 'high' });
    ctx.scheduler.updateConditions({ visible: false });

    ctx.advance(CADENCE_BASE_MS.high + 1); // enough for a visible high poll
    ctx.tick();
    expect(ctx.invalidate).not.toHaveBeenCalled(); // hidden ⇒ high is ×6

    ctx.advance(CADENCE_BASE_MS.high * 6);
    ctx.tick();
    // Only the high resource — low is fully paused while hidden.
    expect(ctx.invalidate).toHaveBeenCalledTimes(1);
  });

  it('refreshNow forces the matching priorities for the active workspace', () => {
    ctx.scheduler.register({ ...baseResource, id: 'a', priority: 'active' });
    ctx.scheduler.register({ ...baseResource, id: 'b', priority: 'low' });
    const count = ctx.scheduler.refreshNow(['active']);
    expect(count).toBe(1);
    expect(ctx.invalidate).toHaveBeenCalledTimes(1);
  });

  it('unregister removes a resource from the schedule', () => {
    ctx.scheduler.register(baseResource);
    ctx.scheduler.unregister('r1');
    ctx.advance(CADENCE_BASE_MS.high * 10);
    ctx.tick();
    expect(ctx.invalidate).not.toHaveBeenCalled();
  });
});

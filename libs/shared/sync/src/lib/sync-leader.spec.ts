import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncLeader } from './sync-leader.js';

const noop = () => undefined;

function setLocks(value: unknown) {
  Object.defineProperty(navigator, 'locks', { value, configurable: true });
}

describe('SyncLeader', () => {
  afterEach(() => setLocks(undefined));

  it('acts as leader immediately when Web Locks is unavailable', () => {
    setLocks(undefined);
    const onBecomeLeader = vi.fn();
    const leader = new SyncLeader({
      onBecomeLeader,
      onResignLeader: noop,
      onBroadcast: noop,
    });
    leader.start();
    expect(leader.isLeader).toBe(true);
    expect(onBecomeLeader).toHaveBeenCalledTimes(1);
    leader.dispose();
  });

  it('becomes leader once the lock callback runs, and resigns on dispose', async () => {
    // Emulate the Web Locks contract: request(name, opts, cb) holds the lock
    // for as long as cb's returned promise is pending.
    const request = vi.fn(
      (_name: string, _opts: unknown, cb: () => Promise<void> | undefined) =>
        Promise.resolve(cb()),
    );
    setLocks({ request });

    const onBecomeLeader = vi.fn();
    const onResignLeader = vi.fn();
    const leader = new SyncLeader({
      onBecomeLeader,
      onResignLeader,
      onBroadcast: noop,
    });
    leader.start();
    await Promise.resolve();

    expect(request).toHaveBeenCalledWith(
      'onetab-sync-leader',
      { mode: 'exclusive' },
      expect.any(Function),
    );
    expect(leader.isLeader).toBe(true);
    expect(onBecomeLeader).toHaveBeenCalledTimes(1);

    leader.dispose();
    expect(leader.isLeader).toBe(false);
    expect(onResignLeader).toHaveBeenCalledTimes(1);
  });

  it('a follower applies a leader broadcast; the leader ignores its own echo', async () => {
    if (typeof BroadcastChannel === 'undefined') return;
    setLocks(undefined);

    const followerReceived: unknown[] = [];
    const follower = new SyncLeader({
      onBecomeLeader: noop,
      onResignLeader: noop,
      onBroadcast: (m) => followerReceived.push(m),
    });
    follower.start();
    // No Web Locks ⇒ follower also thinks it is leader; force it to follower so
    // it processes inbound messages (this is the real multi-tab case where one
    // tab holds the lock).
    (follower as unknown as { isLeaderFlag: boolean }).isLeaderFlag = false;

    const leaderReceived: unknown[] = [];
    const leader = new SyncLeader({
      onBecomeLeader: noop,
      onResignLeader: noop,
      onBroadcast: (m) => leaderReceived.push(m),
    });
    leader.start();

    leader.publish({ kind: 'invalidate', workspaceId: 'ws_1', keys: [['a']] });
    await new Promise((r) => setTimeout(r, 10));

    expect(followerReceived).toHaveLength(1);
    expect(leaderReceived).toHaveLength(0);

    leader.dispose();
    follower.dispose();
  });
});

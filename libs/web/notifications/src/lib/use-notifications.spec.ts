import { beforeEach, describe, expect, it } from 'vitest';
import { mergeActivityIndicators } from './use-notifications.js';

describe('mergeActivityIndicators', () => {
  it('returns a no-activity indicator when both sources are empty', () => {
    expect(mergeActivityIndicators(undefined, undefined)).toEqual({
      level: 'none',
      count: 0,
      mentionCount: 0,
    });
    expect(
      mergeActivityIndicators(
        { level: 'none', count: 0, mentionCount: 0 },
        { unreadCount: 0, mentionCount: 0 },
      ),
    ).toEqual({ level: 'none', count: 0, mentionCount: 0 });
  });

  it('passes the feed indicator through untouched when there is no live count', () => {
    const feed = { level: 'activity' as const, count: 3, mentionCount: 0 };
    expect(mergeActivityIndicators(feed, undefined)).toBe(feed);
  });

  it('takes the larger count from either source', () => {
    expect(
      mergeActivityIndicators(
        { level: 'activity', count: 2, mentionCount: 0 },
        { unreadCount: 5, mentionCount: 0 },
      ),
    ).toEqual({ level: 'activity', count: 5, mentionCount: 0 });

    expect(
      mergeActivityIndicators(
        { level: 'activity', count: 8, mentionCount: 0 },
        { unreadCount: 1, mentionCount: 0 },
      ),
    ).toEqual({ level: 'activity', count: 8, mentionCount: 0 });
  });

  it('escalates to a mention when either source has one', () => {
    expect(
      mergeActivityIndicators(undefined, { unreadCount: 4, mentionCount: 1 }),
    ).toEqual({ level: 'mention', count: 4, mentionCount: 1 });

    expect(
      mergeActivityIndicators(
        { level: 'mention', count: 1, mentionCount: 1 },
        { unreadCount: 2, mentionCount: 0 },
      ),
    ).toEqual({ level: 'mention', count: 2, mentionCount: 1 });
  });

  it('lights up from the live count alone when the feed knows nothing', () => {
    expect(
      mergeActivityIndicators(undefined, { unreadCount: 2, mentionCount: 0 }),
    ).toEqual({ level: 'activity', count: 2, mentionCount: 0 });
  });

  it('clamps negative live counts to zero', () => {
    expect(
      mergeActivityIndicators(undefined, { unreadCount: -3, mentionCount: -1 }),
    ).toEqual({ level: 'none', count: 0, mentionCount: 0 });
  });
});

describe('manual unread flags', () => {
  const ws = 'ws-flags';

  beforeEach(() => window.localStorage.clear());

  it('lights a channel marked unread even after the Inbox was cleared, until it is opened', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const mod = await import('./use-notifications.js');
    // The workspace marker is recent — the case where backdating failed.
    window.localStorage.setItem(`onetab:notifications:seen:${ws}`, new Date().toISOString());

    const { result } = renderHook(() => ({
      activity: mod.useChannelActivity(ws, []),
      markUnread: mod.useMarkChannelUnread(ws),
      markSeen: mod.useMarkChannelSeen(ws),
    }));
    expect(result.current.activity['chan-1']).toBeUndefined();

    act(() => result.current.markUnread('chan-1'));
    expect(result.current.activity['chan-1']).toEqual({
      level: 'activity',
      count: 1,
      mentionCount: 0,
    });

    act(() => result.current.markSeen('chan-1'));
    expect(result.current.activity['chan-1']).toBeUndefined();
  });

  it('flags and clears a DM peer independently of channels', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const mod = await import('./use-notifications.js');
    const { result } = renderHook(() => ({
      dms: mod.useDirectMessageActivity(ws, undefined),
      channels: mod.useChannelActivity(ws, undefined),
      markUnread: mod.useMarkDirectMessageUnread(ws),
      markSeen: mod.useMarkDirectMessageSeen(ws),
      flagged: mod.useIsFlaggedUnread(ws, 'dm:user-9'),
    }));

    act(() => result.current.markUnread('user-9'));
    expect(result.current.dms['user-9']?.level).toBe('activity');
    expect(result.current.flagged).toBe(true);
    expect(Object.keys(result.current.channels)).toEqual([]);

    act(() => result.current.markSeen('user-9'));
    expect(result.current.dms['user-9']).toBeUndefined();
    expect(result.current.flagged).toBe(false);
  });
});

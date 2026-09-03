import { describe, expect, it } from 'vitest';
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

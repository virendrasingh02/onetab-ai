import { mergeDirectMessageActivity } from './merge-dm-activity.js';

describe('mergeDirectMessageActivity', () => {
  it('returns the feed untouched when no live counts are known', () => {
    const feed = { alice: { level: 'activity' as const, count: 1, mentionCount: 0 } };
    expect(mergeDirectMessageActivity(feed, undefined)).toBe(feed);
  });

  it('lights a row from a live count the feed has not seen yet', () => {
    const merged = mergeDirectMessageActivity(
      {},
      { bob: { unreadCount: 3, mentionCount: 0 } },
    );
    expect(merged['bob']).toEqual({ level: 'activity', count: 3, mentionCount: 0 });
  });

  it('escalates to a mention and keeps the larger count', () => {
    const merged = mergeDirectMessageActivity(
      { carol: { level: 'activity', count: 5, mentionCount: 0 } },
      { carol: { unreadCount: 2, mentionCount: 1 } },
    );
    expect(merged['carol']).toEqual({ level: 'mention', count: 5, mentionCount: 1 });
  });

  it('leaves a read conversation dark', () => {
    const merged = mergeDirectMessageActivity(
      {},
      { dave: { unreadCount: 0, mentionCount: 0 } },
    );
    expect(merged['dave']?.level ?? 'none').toBe('none');
  });
});

import type { QueryKey } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidationBatcher } from './realtime-invalidation-batcher.js';

describe('InvalidationBatcher', () => {
  let flushed: (readonly QueryKey[])[];
  let batcher: InvalidationBatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    flushed = [];
    batcher = new InvalidationBatcher((keys) => flushed.push(keys), 200, 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes a single key when the window ends, not before', () => {
    batcher.add(['a']);
    vi.advanceTimersByTime(199);
    expect(flushed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(flushed).toEqual([[['a']]]);
  });

  it('merges identical keys from a burst', () => {
    for (let i = 0; i < 25; i++) batcher.add(['a', { x: 1 }]);
    vi.advanceTimersByTime(200);
    expect(flushed).toEqual([[['a', { x: 1 }]]]);
  });

  it('keeps unrelated keys apart', () => {
    batcher.add(['a', 'x']);
    batcher.add(['a', 'y']);
    vi.advanceTimersByTime(200);
    expect(flushed).toEqual([
      [
        ['a', 'x'],
        ['a', 'y'],
      ],
    ]);
  });

  it('drops a key that a pending broader key already covers', () => {
    batcher.add(['a']);
    batcher.add(['a', 'b']);
    vi.advanceTimersByTime(200);
    expect(flushed).toEqual([[['a']]]);
  });

  it('replaces narrower pending keys when a broader key arrives', () => {
    batcher.add(['a', 'b']);
    batcher.add(['a', 'c', 'd']);
    batcher.add(['z']);
    batcher.add(['a']);
    vi.advanceTimersByTime(200);
    expect(flushed).toEqual([[['z'], ['a']]]);
  });

  it('restarts the window on every event', () => {
    batcher.add(['a']);
    vi.advanceTimersByTime(150);
    batcher.add(['b']);
    vi.advanceTimersByTime(150);
    expect(flushed).toEqual([]);
    vi.advanceTimersByTime(50);
    expect(flushed).toEqual([[['a'], ['b']]]);
  });

  it('still flushes at the cap when the stream never goes quiet', () => {
    for (let elapsed = 0; elapsed < 1000; elapsed += 100) {
      batcher.add(['a']);
      vi.advanceTimersByTime(100);
    }
    expect(flushed).toEqual([[['a']]]);
  });

  it('starts a fresh window after a flush', () => {
    batcher.add(['a']);
    vi.advanceTimersByTime(200);
    batcher.add(['a']);
    vi.advanceTimersByTime(200);
    expect(flushed).toEqual([[['a']], [['a']]]);
  });

  it('clear forgets pending keys', () => {
    batcher.add(['a']);
    batcher.clear();
    vi.advanceTimersByTime(2000);
    expect(flushed).toEqual([]);
    expect(batcher.size).toBe(0);
  });
});

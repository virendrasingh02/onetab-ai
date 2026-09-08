import { describe, it, expect } from 'vitest';
import {
  huddleConnectionReducer,
  isHuddleConnecting,
  type HuddleConnectionState,
} from './huddle.js';

const run = (
  start: HuddleConnectionState,
  events: Parameters<typeof huddleConnectionReducer>[1][],
) => events.reduce(huddleConnectionReducer, start);

describe('huddleConnectionReducer', () => {
  it('happy path: join → connecting → connected', () => {
    expect(run('idle', ['join', 'media_ready'])).toBe('connected');
  });

  it('network drop → interrupted → reconnecting → connected', () => {
    expect(
      run('connected', ['network_lost', 'network_back', 'media_ready']),
    ).toBe('connected');
  });

  it('never gets stuck — reconnect exhaustion surfaces failed, retry recovers', () => {
    expect(
      run('connected', ['network_lost', 'retry', 'reconnect_failed']),
    ).toBe('failed');
    expect(run('failed', ['retry', 'media_ready'])).toBe('connected');
  });

  it('leave always returns to idle', () => {
    for (const s of [
      'connecting',
      'connected',
      'interrupted',
      'reconnecting',
      'failed',
    ] as HuddleConnectionState[]) {
      expect(huddleConnectionReducer(s, 'leave')).toBe('idle');
    }
  });

  it('a second network loss while reconnecting bounces back to interrupted', () => {
    expect(run('reconnecting', ['network_lost'])).toBe('interrupted');
  });

  it('isHuddleConnecting', () => {
    expect(isHuddleConnecting('connecting')).toBe(true);
    expect(isHuddleConnecting('reconnecting')).toBe(true);
    expect(isHuddleConnecting('connected')).toBe(false);
    expect(isHuddleConnecting('failed')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_SOUND_EVENT_LABELS,
  NOTIFICATION_SOUND_PROFILE_OPTIONS,
  notificationAudio,
} from './notification-audio.js';

describe('notificationAudio', () => {
  it('exposes a label for every cue and three profiles', () => {
    expect(Object.keys(NOTIFICATION_SOUND_EVENT_LABELS)).toEqual([
      'message',
      'dm',
      'mention',
      'priority',
      'call',
      'success',
    ]);
    expect(NOTIFICATION_SOUND_PROFILE_OPTIONS.map((o) => o.id)).toEqual([
      'calm',
      'warm',
      'crisp',
    ]);
  });

  it('degrades gracefully with no Web Audio available (jsdom)', () => {
    // jsdom provides no AudioContext — every call must no-op, never throw.
    expect(notificationAudio.isUnlocked).toBe(false);
    expect(() => notificationAudio.setMasterVolume(0.5)).not.toThrow();
    expect(notificationAudio.play('message', { profile: 'calm' })).toBe(false);
    expect(notificationAudio.play('unknown' as 'message')).toBe(false);
  });

  it('unlock resolves false rather than rejecting when unavailable', async () => {
    await expect(notificationAudio.unlock()).resolves.toBe(false);
  });
});

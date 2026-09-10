import { DEFAULT_NOTIFICATION_SOUND_PREFERENCES } from '@org/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationSoundService,
  type NotificationSoundEngine,
} from './notification-sound.js';

interface PlayCall {
  event: string;
  profile?: string;
  volume?: number;
}

class FakeEngine implements NotificationSoundEngine {
  calls: PlayCall[] = [];
  masterVolume = 0;
  isUnlocked = true;

  play(event: string, options: { profile?: string; volume?: number }): boolean {
    this.calls.push({ event, ...options });
    return true;
  }
  async unlock(): Promise<boolean> {
    return true;
  }
  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
  }
}

const prefs = (
  overrides: Partial<typeof DEFAULT_NOTIFICATION_SOUND_PREFERENCES> = {},
) => ({
  ...DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
  ...overrides,
  events: {
    ...DEFAULT_NOTIFICATION_SOUND_PREFERENCES.events,
    ...(overrides.events ?? {}),
  },
});

describe('NotificationSoundService', () => {
  let engine: FakeEngine;
  let service: NotificationSoundService;
  let clock: number;

  const tick = (ms: number) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    clock = 10_000;
    engine = new FakeEngine();
    service = new NotificationSoundService(engine, () => clock);
    service.configure(prefs());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('plays the matching cue for a new message after the group window', () => {
    service.play('message', { dedupeKey: 'm1' });
    expect(engine.calls).toHaveLength(0); // debounced

    tick(500);
    expect(engine.calls).toEqual([
      { event: 'message', profile: 'calm', volume: 0.5 },
    ]);
  });

  it('plays dm and mention cues', () => {
    service.play('dm', { dedupeKey: 'd1' });
    tick(500);
    service.play('mention', { dedupeKey: 'x1' });
    tick(500);
    expect(engine.calls.map((c) => c.event)).toEqual(['dm', 'mention']);
  });

  it('collapses a burst into a single, highest-priority cue', () => {
    service.play('message', { dedupeKey: 'a' });
    service.play('message', { dedupeKey: 'b' });
    service.play('dm', { dedupeKey: 'c' });
    service.play('message', { dedupeKey: 'd' });
    service.play('mention', { dedupeKey: 'e' });

    tick(500);
    expect(engine.calls).toHaveLength(1);
    expect(engine.calls[0].event).toBe('mention'); // highest priority in the burst
  });

  it('de-duplicates the same key inside the window', () => {
    service.play('message', { dedupeKey: 'same' });
    tick(500);
    service.play('message', { dedupeKey: 'same' });
    tick(500);
    expect(engine.calls).toHaveLength(1);
  });

  it('keeps a minimum gap between two cues', () => {
    service.play('message', { dedupeKey: '1' });
    tick(500); // first plays
    expect(engine.calls).toHaveLength(1);

    service.play('mention', { dedupeKey: '2' });
    tick(100); // within the minimum gap
    expect(engine.calls).toHaveLength(1);

    tick(400); // gap cleared
    expect(engine.calls).toHaveLength(2);
  });

  it('plays call cues immediately, bypassing the group window', () => {
    service.play('call', { dedupeKey: 'ring' });
    expect(engine.calls).toEqual([
      { event: 'call', profile: 'calm', volume: 0.5 },
    ]);
  });

  it('plays nothing when sounds are disabled', () => {
    service.configure(prefs({ enabled: false }));
    service.play('message', { dedupeKey: 'm' });
    tick(1000);
    expect(engine.calls).toHaveLength(0);
  });

  it('plays nothing at zero volume', () => {
    service.configure(prefs({ volume: 0 }));
    service.play('mention', { dedupeKey: 'm' });
    tick(1000);
    expect(engine.calls).toHaveLength(0);
  });

  it('respects a per-event opt-out', () => {
    service.configure(prefs({ events: { message: false } }));
    service.play('message', { dedupeKey: 'm' });
    service.play('dm', { dedupeKey: 'd' });
    tick(1000);
    expect(engine.calls.map((c) => c.event)).toEqual(['dm']);
  });

  it('suppresses message/dm cues for the conversation on screen', () => {
    service.play('message', { dedupeKey: 'm', isViewingConversation: true });
    service.play('dm', { dedupeKey: 'd', isViewingConversation: true });
    tick(1000);
    expect(engine.calls).toHaveLength(0);
  });

  it('still plays a mention for the conversation on screen unless onlyWhenUnfocused', () => {
    service.play('mention', { dedupeKey: 'm1', isViewingConversation: true });
    tick(500);
    expect(engine.calls.map((c) => c.event)).toEqual(['mention']);

    service.configure(prefs({ onlyWhenUnfocused: true }));
    service.play('mention', { dedupeKey: 'm2', isViewingConversation: true });
    tick(500);
    expect(engine.calls).toHaveLength(1); // no second cue
  });

  it('pushes master volume to the engine on configure', () => {
    service.configure(prefs({ volume: 0.8 }));
    expect(engine.masterVolume).toBe(0.8);
    service.configure(prefs({ enabled: false, volume: 0.8 }));
    expect(engine.masterVolume).toBe(0);
  });

  it('under reduced distraction, drops ambient cues and eases volume', () => {
    service.configure(prefs(), { reduceDistraction: true });

    service.play('message', { dedupeKey: 'm' });
    service.play('success', { dedupeKey: 's' });
    tick(1000);
    expect(engine.calls).toHaveLength(0);

    service.play('mention', { dedupeKey: 'x' });
    tick(500);
    expect(engine.calls).toEqual([
      { event: 'mention', profile: 'calm', volume: 0.3 },
    ]);
  });

  it('preview ignores the per-event opt-out and the group window', () => {
    service.configure(prefs({ events: { call: false } }));
    service.preview('call');
    expect(engine.calls.map((c) => c.event)).toEqual(['call']);
  });

  it('never throws when the engine is broken', () => {
    const broken = new NotificationSoundService(
      {
        play: () => {
          throw new Error('no audio');
        },
        unlock: async () => {
          throw new Error('no audio');
        },
        setMasterVolume: () => {
          throw new Error('no audio');
        },
        get isUnlocked(): boolean {
          throw new Error('no audio');
        },
      } as NotificationSoundEngine,
      () => clock,
    );
    expect(() => broken.configure(prefs())).not.toThrow();
    expect(() => broken.play('call', { dedupeKey: 'c' })).not.toThrow();
    expect(() => broken.preview('message')).not.toThrow();
    expect(broken.isUnlocked).toBe(false);
  });
});

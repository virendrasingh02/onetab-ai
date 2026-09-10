/**
 * Web Audio synthesiser for calm notification cues.
 *
 * Sibling of `focus-audio.ts` (which does continuous ambient soundscapes); this
 * one does short, one-shot notification tones. No MP3 / network assets: every
 * sound is a handful of gently enveloped oscillators through a shared low-pass,
 * so nothing is downloaded and the `AudioContext` is created lazily on first
 * use. Everything is deliberately soft, short (< ~700 ms) and warm — no sharp
 * transients, no long musical phrases, nothing that fatigues over a work day.
 *
 * The engine only *makes sound*. Whether a sound should play at all (user
 * preferences, focus, muting, debouncing, de-duplication) is decided upstream in
 * `@org/notifications`.
 */

import type {
  NotificationSoundEvent,
  NotificationSoundProfile,
} from '@org/types';

export type { NotificationSoundEvent, NotificationSoundProfile } from '@org/types';

export interface NotificationSoundProfileOption {
  id: NotificationSoundProfile;
  name: string;
  description: string;
}

export const NOTIFICATION_SOUND_PROFILE_OPTIONS: NotificationSoundProfileOption[] =
  [
    {
      id: 'calm',
      name: 'Calm',
      description: 'Soft mellow sine tones — the gentlest option',
    },
    {
      id: 'warm',
      name: 'Warm',
      description: 'Rounded low tones with a little more body',
    },
    {
      id: 'crisp',
      name: 'Crisp',
      description: 'Clean and clear, still quiet and short',
    },
  ];

export const NOTIFICATION_SOUND_EVENT_LABELS: Record<
  NotificationSoundEvent,
  string
> = {
  message: 'New message',
  dm: 'Direct message',
  mention: 'Mention',
  priority: 'Important / priority',
  call: 'Incoming call',
  success: 'Success / confirmation',
};

interface PlayOptions {
  profile?: NotificationSoundProfile;
  /** 0..1. Multiplied by the engine's own gentle ceiling. */
  volume?: number;
}

/** One enveloped oscillator within a cue. */
interface Partial_ {
  /** Hz. */
  freq: number;
  /** Seconds after cue start. */
  at: number;
  /** Seconds. */
  dur: number;
  /** Relative amplitude, 0..1 (pre master/volume scaling). */
  gain: number;
  type: OscillatorType;
}

type ProfileShape = {
  /** Master timbre filter cutoff, Hz. */
  cutoff: number;
  /** Multiplies every partial's duration. */
  lengthScale: number;
  /** Multiplies every partial's gain. */
  gainScale: number;
  /** Overrides each partial's waveform when set. */
  waveform?: OscillatorType;
  /** Transposes every partial, in semitone-ish ratio steps. `1` = no change. */
  detune: number;
};

const PROFILE_SHAPES: Record<NotificationSoundProfile, ProfileShape> = {
  calm: { cutoff: 4200, lengthScale: 1.15, gainScale: 0.9, waveform: 'sine', detune: 1 },
  warm: { cutoff: 3200, lengthScale: 1.0, gainScale: 1.0, detune: 0.944 /* ~-1 whole tone */ },
  crisp: { cutoff: 6000, lengthScale: 0.82, gainScale: 0.85, waveform: 'sine', detune: 1.06 },
};

// Note frequencies used across the cues (equal temperament, A4 = 440).
const A4 = 440;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const D5 = 587.33;
const F5 = 698.46;

/**
 * The score for each cue. Kept intentionally minimal — at most three partials,
 * short durations, low gains. Higher-salience cues get an extra note or a
 * slightly wider interval, never more volume or a harsher waveform.
 */
const CUES: Record<NotificationSoundEvent, Partial_[]> = {
  // Single soft mid note. The quietest cue.
  message: [{ freq: E5, at: 0, dur: 0.26, gain: 0.5, type: 'sine' }],

  // Gentle rising perfect fifth — a touch more present than a channel message.
  dm: [
    { freq: C5, at: 0, dur: 0.24, gain: 0.55, type: 'sine' },
    { freq: G5, at: 0.11, dur: 0.3, gain: 0.5, type: 'sine' },
  ],

  // Rising major third then fifth — recognisably "someone named you", still calm.
  mention: [
    { freq: C5, at: 0, dur: 0.22, gain: 0.55, type: 'sine' },
    { freq: E5, at: 0.1, dur: 0.24, gain: 0.52, type: 'sine' },
    { freq: G5, at: 0.2, dur: 0.34, gain: 0.5, type: 'sine' },
  ],

  // Two-note "settle" (down a step, back up) — warm, slightly fuller, marks
  // something that wants attention without an alarm.
  priority: [
    { freq: F5, at: 0, dur: 0.26, gain: 0.6, type: 'triangle' },
    { freq: A4, at: 0.13, dur: 0.22, gain: 0.5, type: 'sine' },
    { freq: F5, at: 0.26, dur: 0.4, gain: 0.55, type: 'sine' },
  ],

  // Soft ascending triad, the most distinguishable cue but still rounded and
  // brief. Not a ring loop — one warm phrase.
  call: [
    { freq: C5, at: 0, dur: 0.3, gain: 0.6, type: 'sine' },
    { freq: E5, at: 0.16, dur: 0.32, gain: 0.58, type: 'sine' },
    { freq: A5, at: 0.34, dur: 0.5, gain: 0.55, type: 'sine' },
  ],

  // Light rising third→fifth, brighter feel for a positive confirmation.
  success: [
    { freq: D5, at: 0, dur: 0.2, gain: 0.5, type: 'sine' },
    { freq: G5, at: 0.09, dur: 0.28, gain: 0.48, type: 'sine' },
  ],
};

/** Absolute ceiling: even at volume 1 the loudest partial peaks here. */
const OUTPUT_CEILING = 0.16;

class NotificationAudioEngine {
  private ctx: AudioContext | null = null;
  private bus: { filter: BiquadFilterNode; master: GainNode } | null = null;
  private masterVolume = 0.5;
  /** Guards against a broken environment: once creation throws, stop retrying. */
  private unavailable = false;

  get isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.min(1, Math.max(0, volume));
    if (this.bus && this.ctx) {
      this.bus.master.gain.setTargetAtTime(
        this.masterVolume,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  /**
   * Bring the audio context to `running`. Browsers only allow this from inside a
   * user gesture, so callers wire it to the first `pointerdown` / `keydown`.
   * Safe to call repeatedly. Never throws.
   */
  async unlock(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return false;
      if (ctx.state === 'suspended') await ctx.resume();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Play one notification cue. Returns `false` if nothing was scheduled (engine
   * unavailable, context not yet unlocked, unknown event). Never throws.
   */
  play(event: NotificationSoundEvent, options: PlayOptions = {}): boolean {
    try {
      const partials = CUES[event];
      if (!partials) return false;

      const ctx = this.ensureContext();
      if (!ctx || !this.bus) return false;

      // A suspended context means we have never had a user gesture. Try to
      // resume opportunistically, but do not block on it — if it is still
      // suspended the scheduled nodes simply produce nothing, which is the
      // desired graceful degradation.
      if (ctx.state === 'suspended') void ctx.resume();

      const shape = PROFILE_SHAPES[options.profile ?? 'calm'];
      const volume = Math.min(1, Math.max(0, options.volume ?? 1));
      if (volume <= 0) return false;

      this.bus.filter.frequency.setTargetAtTime(
        shape.cutoff,
        ctx.currentTime,
        0.01,
      );

      const start = ctx.currentTime + 0.02;
      const level = OUTPUT_CEILING * volume * shape.gainScale;

      for (const p of partials) {
        const osc = ctx.createOscillator();
        osc.type = shape.waveform ?? p.type;
        osc.frequency.value = p.freq * shape.detune;

        const env = ctx.createGain();
        const t0 = start + p.at;
        const dur = p.dur * shape.lengthScale;
        const peak = Math.max(0.0001, level * p.gain);

        // Fast-but-not-clicky attack, long gentle exponential release.
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(env);
        env.connect(this.bus.filter);

        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
        osc.onended = () => {
          try {
            osc.disconnect();
            env.disconnect();
          } catch {
            /* already torn down */
          }
        };
      }

      return true;
    } catch {
      return false;
    }
  }

  /** Release the audio context. Called on teardown of the last consumer. */
  dispose(): void {
    try {
      this.bus?.master.disconnect();
      this.bus?.filter.disconnect();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.bus = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.unavailable || typeof window === 'undefined') return null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        this.unavailable = true;
        return null;
      }

      const ctx = new AudioCtx();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = PROFILE_SHAPES.calm.cutoff;
      filter.Q.value = 0.4;

      const master = ctx.createGain();
      master.gain.value = this.masterVolume;

      filter.connect(master);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.bus = { filter, master };
      return ctx;
    } catch {
      this.unavailable = true;
      return null;
    }
  }
}

/** Process-wide singleton. One `AudioContext` for the whole app. */
export const notificationAudio = new NotificationAudioEngine();

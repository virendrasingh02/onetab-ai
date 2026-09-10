import {
  NOTIFICATION_SOUND_PRIORITY,
  type NotificationSoundEvent,
  type NotificationSoundPreferences,
} from '@org/types';
import { notificationAudio } from '@org/ui';

/**
 * Central notification-sound orchestrator.
 *
 * The `@org/ui` `notificationAudio` engine only knows how to *make* a tone. This
 * service owns every decision about whether a tone should be made at all:
 *
 *  - user preferences (master switch, volume, per-event opt-out, timbre)
 *  - "only when I'm not looking at it" / active-conversation suppression
 *  - reduced-distraction (prefers-reduced-motion) handling
 *  - de-duplication (the same logical event arriving twice — e.g. a mention over
 *    both the Matrix push rule and the server `notification.created`)
 *  - grouping/debouncing bursts into a single cue
 *  - a minimum gap between any two cues, so simultaneous events never stack
 *
 * It is a plain singleton (like `notificationService`) rather than a hook so it
 * can be called from non-React code paths. A small React layer
 * (`use-notification-sound.ts`) keeps its config in sync with the Redux store
 * and unlocks the audio context on the first user gesture.
 */

/** Events that should still play while the user is looking at the conversation. */
const ALWAYS_AUDIBLE: ReadonlySet<NotificationSoundEvent> = new Set([
  'call',
  'priority',
  'success',
]);

/** Non-essential cues, suppressed under prefers-reduced-motion. */
const NON_ESSENTIAL: ReadonlySet<NotificationSoundEvent> = new Set([
  'message',
  'success',
]);

/** Window over which a burst of events collapses to one cue. */
const GROUP_WINDOW_MS = 450;
/** Minimum spacing between two actually-played cues. */
const MIN_GAP_MS = 400;
/** A repeated `dedupeKey` inside this window is ignored. */
const DEDUPE_WINDOW_MS = 2500;

export interface PlaySoundContext {
  /**
   * The user is currently looking at the conversation this event belongs to
   * (window focused + that room on screen). Suppresses the low-salience cues.
   */
  isViewingConversation?: boolean;
  /**
   * Collapses repeats: the same key seen twice within {@link DEDUPE_WINDOW_MS}
   * only plays once. Use a stable id for the underlying thing (message event id,
   * notification id).
   */
  dedupeKey?: string;
  /**
   * Bypass the grouping window — for user-initiated previews and one-off
   * confirmation cues that should feel immediate. Still respects the master
   * gate and the minimum gap.
   */
  immediate?: boolean;
}

export interface NotificationSoundEngine {
  play(
    event: NotificationSoundEvent,
    options: { profile?: NotificationSoundPreferences['profile']; volume?: number },
  ): boolean;
  unlock(): Promise<boolean>;
  setMasterVolume(volume: number): void;
  readonly isUnlocked: boolean;
}

interface NotificationSoundConfig {
  prefs: NotificationSoundPreferences | null;
  /** OS/browser "reduce motion / distraction" preference. */
  reduceDistraction: boolean;
}

interface PendingCue {
  event: NotificationSoundEvent;
  context: PlaySoundContext;
}

export class NotificationSoundService {
  private config: NotificationSoundConfig = {
    prefs: null,
    reduceDistraction: false,
  };

  private pending: PendingCue | null = null;
  private groupTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPlayedAt = 0;
  private readonly recentKeys = new Map<string, number>();

  constructor(
    private readonly engine: NotificationSoundEngine = notificationAudio,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Keep the service's view of preferences current. Cheap; call on every change. */
  configure(
    prefs: NotificationSoundPreferences,
    options: { reduceDistraction?: boolean } = {},
  ): void {
    this.config = {
      prefs,
      reduceDistraction: options.reduceDistraction ?? this.config.reduceDistraction,
    };
    try {
      this.engine.setMasterVolume(prefs.enabled ? prefs.volume : 0);
    } catch {
      /* engine unavailable — playback will simply no-op */
    }
  }

  /** Wire to the first user gesture so the audio context is allowed to run. */
  async unlock(): Promise<boolean> {
    try {
      return await this.engine.unlock();
    } catch {
      return false;
    }
  }

  get isUnlocked(): boolean {
    try {
      return this.engine.isUnlocked;
    } catch {
      return false;
    }
  }

  /**
   * Request a notification sound. Subject to every gate above; the actual tone
   * (if any) is produced asynchronously after the grouping window.
   */
  play(event: NotificationSoundEvent, context: PlaySoundContext = {}): void {
    try {
      if (!this.shouldPlay(event, context)) return;

      if (context.dedupeKey) {
        this.recentKeys.set(context.dedupeKey, this.now());
        this.pruneKeys();
      }

      const incoming: PendingCue = { event, context };

      // Highest-priority cue in the window wins. A brand-new burst starts the
      // timer; a higher-priority event mid-window replaces the pending cue.
      if (
        !this.pending ||
        NOTIFICATION_SOUND_PRIORITY[event] >
          NOTIFICATION_SOUND_PRIORITY[this.pending.event]
      ) {
        this.pending = incoming;
      }

      const immediate =
        context.immediate || event === 'call' || event === 'priority';

      if (immediate) {
        this.flush();
        return;
      }

      if (!this.groupTimer) {
        this.groupTimer = setTimeout(() => {
          this.groupTimer = null;
          this.flush();
        }, GROUP_WINDOW_MS);
      }
    } catch (err) {
      this.debug('play() failed', err);
    }
  }

  /**
   * Play a cue right now for the user to audition it — bypasses the per-event
   * opt-out, de-dup and grouping (it is an explicit user action), but still
   * uses the configured timbre and volume. Falls back to sensible defaults if
   * `configure()` has not run yet.
   */
  preview(event: NotificationSoundEvent): void {
    try {
      const prefs = this.config.prefs;
      void this.unlock();
      this.engine.play(event, {
        profile: prefs?.profile ?? 'calm',
        volume: prefs && prefs.enabled ? Math.max(prefs.volume, 0.2) : 0.5,
      });
    } catch (err) {
      this.debug('preview() failed', err);
    }
  }

  /** Test / teardown helper. */
  reset(): void {
    if (this.groupTimer) clearTimeout(this.groupTimer);
    this.groupTimer = null;
    this.pending = null;
    this.lastPlayedAt = 0;
    this.recentKeys.clear();
  }

  private shouldPlay(
    event: NotificationSoundEvent,
    context: PlaySoundContext,
  ): boolean {
    const { prefs, reduceDistraction } = this.config;

    // 1. Master gate.
    if (!prefs || !prefs.enabled || prefs.volume <= 0) return false;

    // 2. Per-event opt-out.
    if (prefs.events[event] === false) return false;

    // 3. Never play audio for a hidden tab — the OS notification is the
    //    background channel, and a suspended context would swallow it anyway.
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return false;
    }

    // 4. De-duplication.
    if (context.dedupeKey) {
      const seenAt = this.recentKeys.get(context.dedupeKey);
      if (seenAt !== undefined && this.now() - seenAt < DEDUPE_WINDOW_MS) {
        return false;
      }
    }

    // 5. Reduced-distraction: keep the cues that carry information a user would
    //    not otherwise notice, drop the ambient ones, and pull the rest back.
    if (reduceDistraction && NON_ESSENTIAL.has(event)) return false;

    // 6. Actively viewing the relevant conversation → suppress the low-salience
    //    cues (the message is right there on screen). Mentions are held back
    //    only if the user asked for "sounds only when I'm not looking".
    if (context.isViewingConversation && !ALWAYS_AUDIBLE.has(event)) {
      if (event === 'message' || event === 'dm') return false;
      if (event === 'mention' && prefs.onlyWhenUnfocused) return false;
    }

    return true;
  }

  private flush(): void {
    const cue = this.pending;
    if (!cue) return;

    const { prefs, reduceDistraction } = this.config;
    if (!prefs) {
      this.pending = null;
      return;
    }

    const elapsed = this.now() - this.lastPlayedAt;
    if (elapsed < MIN_GAP_MS) {
      // Too soon after the last cue — hold this one until the gap clears rather
      // than stacking two tones on top of each other.
      if (!this.groupTimer) {
        this.groupTimer = setTimeout(() => {
          this.groupTimer = null;
          this.flush();
        }, MIN_GAP_MS - elapsed);
      }
      return;
    }

    this.pending = null;
    this.lastPlayedAt = this.now();

    const volume = reduceDistraction
      ? prefs.volume * 0.6
      : prefs.volume;

    try {
      const played = this.engine.play(cue.event, {
        profile: prefs.profile,
        volume,
      });
      if (!played) this.debug('engine produced no sound for', cue.event);
    } catch (err) {
      this.debug('engine.play() failed', err);
    }
  }

  private pruneKeys(): void {
    if (this.recentKeys.size < 64) return;
    const cutoff = this.now() - DEDUPE_WINDOW_MS;
    for (const [key, at] of this.recentKeys) {
      if (at < cutoff) this.recentKeys.delete(key);
    }
  }

  /**
   * Development-only diagnostics. Audio failures are non-fatal by design, so
   * they are never surfaced to the user — but a developer chasing "why no
   * sound" needs a breadcrumb. Uses `console.warn` (the allowed channel) and
   * only in a dev build.
   */
  private debug(...args: unknown[]): void {
    if (import.meta.env?.DEV) console.warn('[notification-sound]', ...args);
  }
}

export const notificationSound = new NotificationSoundService();

import { useNotificationSoundPreferences } from '@org/common';
import type {
  NotificationSoundEvent,
  NotificationSoundPreferences,
} from '@org/types';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { notificationSound } from './notification-sound.js';

/**
 * Tracks the OS "reduce motion" preference. Sound is not motion, but it is the
 * closest signal a browser exposes for "this person wants fewer interruptions",
 * and the sound service uses it to hold back the ambient cues.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => undefined;
      }
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && !!window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    () => false,
  );
}

/**
 * Keeps the singleton {@link notificationSound} service configured from the
 * Redux preferences, and unlocks the audio context on the first real user
 * gesture (browsers refuse to start an `AudioContext` before one). Mount once,
 * high in the tree.
 */
export function useNotificationSoundSync(): void {
  const { sound } = useNotificationSoundPreferences();
  const reduceDistraction = usePrefersReducedMotion();

  useEffect(() => {
    notificationSound.configure(sound, { reduceDistraction });
  }, [sound, reduceDistraction]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (notificationSound.isUnlocked) return;

    let done = false;
    const unlock = () => {
      if (done) return;
      done = true;
      void notificationSound.unlock();
      remove();
    };
    const remove = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    return remove;
  }, []);
}

export interface NotificationSoundControls {
  sound: NotificationSoundPreferences;
  reduceDistractionActive: boolean;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setProfile: (profile: NotificationSoundPreferences['profile']) => void;
  setOnlyWhenUnfocused: (value: boolean) => void;
  setEventEnabled: (event: NotificationSoundEvent, enabled: boolean) => void;
  /** Audition a cue (bypasses the per-event opt-out and grouping). */
  preview: (event: NotificationSoundEvent) => void;
}

/**
 * The settings-panel façade: current values plus setters that both persist to
 * Redux and keep the audio service in step, so previews are always accurate.
 */
export function useNotificationSoundControls(): NotificationSoundControls {
  const { sound, updateNotificationSoundPreferences } =
    useNotificationSoundPreferences();
  const reduceDistractionActive = usePrefersReducedMotion();

  // Mirror straight away so a preview right after a change uses the new value
  // without waiting for the sync effect elsewhere.
  const syncedRef = useRef<NotificationSoundPreferences>(sound);
  syncedRef.current = sound;
  useEffect(() => {
    notificationSound.configure(sound, {
      reduceDistraction: reduceDistractionActive,
    });
  }, [sound, reduceDistractionActive]);

  const setEnabled = useCallback(
    (enabled: boolean) => updateNotificationSoundPreferences({ enabled }),
    [updateNotificationSoundPreferences],
  );
  const setVolume = useCallback(
    (volume: number) =>
      updateNotificationSoundPreferences({
        volume: Math.min(1, Math.max(0, volume)),
      }),
    [updateNotificationSoundPreferences],
  );
  const setProfile = useCallback(
    (profile: NotificationSoundPreferences['profile']) =>
      updateNotificationSoundPreferences({ profile }),
    [updateNotificationSoundPreferences],
  );
  const setOnlyWhenUnfocused = useCallback(
    (onlyWhenUnfocused: boolean) =>
      updateNotificationSoundPreferences({ onlyWhenUnfocused }),
    [updateNotificationSoundPreferences],
  );
  const setEventEnabled = useCallback(
    (event: NotificationSoundEvent, enabled: boolean) =>
      updateNotificationSoundPreferences({ events: { [event]: enabled } }),
    [updateNotificationSoundPreferences],
  );
  const preview = useCallback((event: NotificationSoundEvent) => {
    notificationSound.configure(syncedRef.current, {});
    notificationSound.preview(event);
  }, []);

  return useMemo(
    () => ({
      sound,
      reduceDistractionActive,
      setEnabled,
      setVolume,
      setProfile,
      setOnlyWhenUnfocused,
      setEventEnabled,
      preview,
    }),
    [
      sound,
      reduceDistractionActive,
      setEnabled,
      setVolume,
      setProfile,
      setOnlyWhenUnfocused,
      setEventEnabled,
      preview,
    ],
  );
}

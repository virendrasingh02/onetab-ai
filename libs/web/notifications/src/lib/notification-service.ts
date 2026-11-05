import { DEFAULT_NOTIFICATION_SOUND_PREFERENCES, store } from '@org/common';
import type {
  NotificationDisplayPreferences,
  NotificationSoundEvent,
} from '@org/types';
import { toast } from '@org/ui';
import {
  flashFrame,
  notify as sendOsNotification,
  supportsTaskbarFlash,
} from '@org/web-desktop';
import { isCallOrMeetingActive } from './active-call-detector.js';
import { notificationSound } from './notification-sound.js';

export interface NotificationPayload {
  title: string;
  body: string;
  id?: string;
  icon?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'message';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  route?: string;
  /**
   * Opens `route` from a banner or browser notification. Without it the banner
   * has no Open button. The desktop app routes through `route` itself.
   */
  onActivate?: () => void;
  /**
   * Notifications sharing a tag replace each other instead of stacking, so a
   * burst in one conversation stays one banner.
   */
  tag?: string;
  /** Skip the OS notification and taskbar flash: the user is in the app. */
  silent?: boolean;
  /**
   * Ask for browser notification permission if it was never decided. Only for
   * a direct user action: browsers penalise prompts nobody clicked for.
   */
  promptForPermission?: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string;
  workspaceAvatarUrl?: string;
  /**
   * Which calm audio cue to play, if any. Explicit wins; otherwise it is
   * derived from `type` / `priority`. Pass `'none'` to guarantee silence for a
   * notification that is otherwise sound-worthy.
   */
  soundEvent?: NotificationSoundEvent | 'none';
}

/** Maps a notification's shape to a sound cue when the caller did not say. */
function resolveSoundEvent(
  payload: NotificationPayload,
): NotificationSoundEvent | null {
  if (payload.soundEvent) {
    return payload.soundEvent === 'none' ? null : payload.soundEvent;
  }
  // A critical alert always gets the priority cue, even a red/error one — it is
  // the one class of message that must cut through.
  if (payload.priority === 'critical') return 'priority';
  if (payload.type === 'success') return 'success';
  // Other errors and warnings lean on the toast, not a chime.
  if (payload.type === 'error' || payload.type === 'warning') return null;
  if (payload.priority === 'high') return 'priority';
  return 'message';
}

export interface NotificationResult {
  displayed: boolean;
  suppressed: boolean;
  suppressionReason?: 'call_active' | 'permissions_denied';
  previewHidden: boolean;
  taskbarFlashed: boolean;
}

class NotificationService {
  private lastFlashTime = 0;

  /**
   * Reads the current notification preferences from the Redux store.
   */
  getPreferences(): NotificationDisplayPreferences {
    const fallback: NotificationDisplayPreferences = {
      showContentPreview: true,
      showDuringCalls: true,
      flashTaskbar: true,
      dismissDuration: 5000,
      position: 'bottom-right',
      size: 'comfy',
      sound: DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
    };
    try {
      const state = store.getState();
      return state.preferences?.preferences?.notifications ?? fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Dispatches a notification respecting all central display preferences.
   */
  async notify(payload: NotificationPayload): Promise<NotificationResult> {
    const prefs = this.getPreferences();
    const isCritical = payload.priority === 'critical';

    // 1. Call / Meeting suppression
    if (!prefs.showDuringCalls && !isCritical && isCallOrMeetingActive()) {
      return {
        displayed: false,
        suppressed: true,
        suppressionReason: 'call_active',
        previewHidden: false,
        taskbarFlashed: false,
      };
    }

    // 2. Content preview privacy sanitization
    const previewHidden = !prefs.showContentPreview;
    const effectiveTitle = previewHidden
      ? payload.type === 'message'
        ? 'New message'
        : 'New notification'
      : payload.title;
    const effectiveBody = previewHidden
      ? 'Content preview is disabled in your notification settings.'
      : payload.body;

    // 3. Taskbar Flashing (Windows desktop aware with rate limiting)
    let taskbarFlashed = false;
    if (prefs.flashTaskbar && !payload.silent && supportsTaskbarFlash()) {
      const now = Date.now();
      // Rate-limit taskbar flashing to at most once every 3 seconds
      if (now - this.lastFlashTime > 3000) {
        this.lastFlashTime = now;
        void flashFrame(true);
        taskbarFlashed = true;
      }
    }

    // 4. In-App Toast
    const duration =
      prefs.dismissDuration === null ? Infinity : prefs.dismissDuration;
    const toastOptions = {
      description: effectiveBody,
      duration,
      ...(payload.tag ? { id: payload.tag } : {}),
      ...(payload.onActivate
        ? { action: { label: 'Open', onClick: payload.onActivate } }
        : {}),
    };

    if (payload.type === 'success') {
      toast.success(effectiveTitle, toastOptions);
    } else if (payload.type === 'error') {
      toast.error(effectiveTitle, toastOptions);
    } else if (payload.type === 'warning') {
      toast.warning(effectiveTitle, toastOptions);
    } else {
      toast(effectiveTitle, toastOptions);
    }

    // Only in the foreground: a hidden tab's `AudioContext` is suspended, so
    // there the OS notification carries the sound instead.
    const inForeground =
      typeof document === 'undefined' || document.visibilityState === 'visible';
    const soundEvent = inForeground ? resolveSoundEvent(payload) : null;

    // 5. Native OS / Desktop Notification
    if (!payload.silent) {
      void sendOsNotification(
        {
          title: effectiveTitle,
          body: effectiveBody,
          id: payload.id,
          tag: payload.tag,
          icon:
            payload.icon ?? payload.workspaceAvatarUrl ?? payload.workspaceIcon,
          route: payload.route,
          // The in-app cue below plays, so the system sound would double it.
          silent: soundEvent !== null,
        },
        {
          onClick: payload.onActivate,
          prompt: payload.promptForPermission ?? false,
        },
      );
    }

    // 6. Calm in-app audio cue. Audio never blocks or breaks the notification —
    // the service swallows its own failures.
    if (soundEvent) {
      notificationSound.play(soundEvent, {
        dedupeKey: payload.id,
        immediate: soundEvent === 'success',
      });
    }

    return {
      displayed: true,
      suppressed: false,
      previewHidden,
      taskbarFlashed,
    };
  }
}

export const notificationService = new NotificationService();

import { DEFAULT_NOTIFICATION_SOUND_PREFERENCES, store } from '@org/common';
import type {
  NotificationDisplayPreferences,
  NotificationSoundEvent,
} from '@org/types';
import { toast } from '@org/ui';
import { flashFrame, notify as sendOsNotification, supportsTaskbarFlash } from '@org/web-desktop';
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
  silent?: boolean;
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
    if (prefs.flashTaskbar && supportsTaskbarFlash()) {
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

    if (payload.type === 'success') {
      toast.success(effectiveTitle, {
        description: effectiveBody,
        duration,
      });
    } else if (payload.type === 'error') {
      toast.error(effectiveTitle, {
        description: effectiveBody,
        duration,
      });
    } else if (payload.type === 'warning') {
      toast.warning(effectiveTitle, {
        description: effectiveBody,
        duration,
      });
    } else {
      toast(effectiveTitle, {
        description: effectiveBody,
        duration,
      });
    }

    // 5. Native OS / Desktop Notification
    if (!payload.silent) {
      void sendOsNotification({
        title: effectiveTitle,
        body: effectiveBody,
        id: payload.id,
        icon: payload.icon ?? payload.workspaceAvatarUrl ?? payload.workspaceIcon,
        route: payload.route,
      });
    }

    // 6. Calm in-app audio cue.
    //
    // Only in the foreground: a hidden tab's `AudioContext` is suspended and the
    // OS notification above already carries the system sound. Audio never blocks
    // or breaks the notification — the service swallows its own failures.
    if (
      typeof document === 'undefined' ||
      document.visibilityState === 'visible'
    ) {
      const soundEvent = resolveSoundEvent(payload);
      if (soundEvent) {
        notificationSound.play(soundEvent, {
          dedupeKey: payload.id,
          immediate: soundEvent === 'success',
        });
      }
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

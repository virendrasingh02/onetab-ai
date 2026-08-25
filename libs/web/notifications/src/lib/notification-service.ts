import { store } from '@org/common';
import type { NotificationDisplayPreferences } from '@org/types';
import { toast } from '@org/ui';
import { flashFrame, notify as sendOsNotification, supportsTaskbarFlash } from '@org/web-desktop';
import { isCallOrMeetingActive } from './active-call-detector.js';

export interface NotificationPayload {
  title: string;
  body: string;
  id?: string;
  icon?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'message';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  route?: string;
  silent?: boolean;
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
    try {
      const state = store.getState();
      return (
        state.preferences?.preferences?.notifications ?? {
          showContentPreview: true,
          showDuringCalls: true,
          flashTaskbar: true,
          dismissDuration: 5000,
          position: 'bottom-right',
          size: 'comfy',
        }
      );
    } catch {
      return {
        showContentPreview: true,
        showDuringCalls: true,
        flashTaskbar: true,
        dismissDuration: 5000,
        position: 'bottom-right',
        size: 'comfy',
      };
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
        icon: payload.icon,
        route: payload.route,
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

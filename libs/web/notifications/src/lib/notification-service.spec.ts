import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationService } from './notification-service.js';
import { setActiveCallState } from './active-call-detector.js';
import { store, updateNotificationPreferences } from '@org/common';

vi.mock('@org/ui', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@org/web-desktop', () => ({
  notify: vi.fn().mockResolvedValue(true),
  flashFrame: vi.fn().mockResolvedValue(undefined),
  supportsTaskbarFlash: vi.fn().mockReturnValue(true),
}));

describe('notificationService', () => {
  beforeEach(() => {
    setActiveCallState(false);
    store.dispatch(
      updateNotificationPreferences({
        showContentPreview: true,
        showDuringCalls: true,
        flashTaskbar: true,
        dismissDuration: 5000,
        position: 'bottom-right',
        size: 'comfy',
      }),
    );
  });

  it('dispatches notification with full content when preview is enabled', async () => {
    const result = await notificationService.notify({
      title: 'Alice',
      body: 'Hey, are you free for a call?',
      type: 'message',
    });

    expect(result.displayed).toBe(true);
    expect(result.suppressed).toBe(false);
    expect(result.previewHidden).toBe(false);
  });

  it('redacts content preview when showContentPreview is false', async () => {
    store.dispatch(
      updateNotificationPreferences({
        showContentPreview: false,
      }),
    );

    const result = await notificationService.notify({
      title: 'Secret Channel',
      body: 'Confidential project details',
      type: 'message',
    });

    expect(result.displayed).toBe(true);
    expect(result.previewHidden).toBe(true);
  });

  it('suppresses non-critical notifications during active call when showDuringCalls is false', async () => {
    store.dispatch(
      updateNotificationPreferences({
        showDuringCalls: false,
      }),
    );

    setActiveCallState(true);

    const result = await notificationService.notify({
      title: 'General',
      body: 'Lunch is here!',
      type: 'info',
      priority: 'normal',
    });

    expect(result.displayed).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.suppressionReason).toBe('call_active');
  });

  it('does NOT suppress critical notifications during active call even when showDuringCalls is false', async () => {
    store.dispatch(
      updateNotificationPreferences({
        showDuringCalls: false,
      }),
    );

    setActiveCallState(true);

    const result = await notificationService.notify({
      title: 'Production Alert',
      body: 'Database outage!',
      type: 'error',
      priority: 'critical',
    });

    expect(result.displayed).toBe(true);
    expect(result.suppressed).toBe(false);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationService } from './notification-service.js';
import { setActiveCallState } from './active-call-detector.js';
import { store, updateNotificationPreferences } from '@org/common';
import { toast } from '@org/ui';
import { flashFrame, notify as sendOsNotification } from '@org/web-desktop';

vi.mock('@org/ui', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  notificationAudio: {
    play: vi.fn().mockReturnValue(true),
    unlock: vi.fn().mockResolvedValue(true),
    setMasterVolume: vi.fn(),
    isUnlocked: true,
  },
}));

vi.mock('@org/web-desktop', () => ({
  notify: vi.fn().mockResolvedValue(true),
  flashFrame: vi.fn().mockResolvedValue(undefined),
  supportsTaskbarFlash: vi.fn().mockReturnValue(true),
}));

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('raises the native notification without an in-app toast', async () => {
    await notificationService.notify({
      title: 'Virendra Singh',
      body: 'hello',
      type: 'message',
      tag: 'chat:!room',
      route: '/w/acme/dms/virendra',
      skipTaskbarFlash: true,
    });

    expect(sendOsNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendOsNotification).mock.calls[0][0]).toMatchObject({
      title: 'Virendra Singh',
      body: 'hello',
      tag: 'chat:!room',
      route: '/w/acme/dms/virendra',
    });
    expect(toast).not.toHaveBeenCalled();
    expect(flashFrame).not.toHaveBeenCalled();
  });

  it('falls back to a toast only when the browser or OS refuses', async () => {
    vi.mocked(sendOsNotification).mockResolvedValueOnce(false);

    const result = await notificationService.notify({
      title: 'Alice',
      body: 'hello',
      type: 'message',
    });

    expect(result).toMatchObject({
      displayed: false,
      suppressed: true,
      suppressionReason: 'permissions_denied',
    });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast).mock.calls[0][0]).toBe('Alice');
  });

  it('leaves a refusal to a caller that reports it itself', async () => {
    vi.mocked(sendOsNotification).mockResolvedValueOnce(false);

    await notificationService.notify({
      title: 'Alice',
      body: 'hello',
      skipInAppFallback: true,
    });

    expect(toast).not.toHaveBeenCalled();
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

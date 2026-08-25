import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { store, resetPreferences } from '@org/common';
import { NotificationDisplaySettingsPanel } from './notification-display-settings-panel.js';

vi.mock('@org/notifications', () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue({
      displayed: true,
      suppressed: false,
      previewHidden: false,
      taskbarFlashed: false,
    }),
  },
  useNotificationPermissionBar: vi.fn().mockReturnValue({
    permission: 'granted',
    isDismissed: false,
    isSnoozed: false,
    requestPermission: vi.fn(),
    resetBarState: vi.fn(),
  }),
}));

vi.mock('@org/web-desktop', () => ({
  openSystemSettings: vi.fn().mockResolvedValue(true),
  useCapabilities: vi.fn().mockReturnValue({
    isDesktop: false,
    platform: 'web',
  }),
  useTaskbarFlashSupported: vi.fn().mockReturnValue(false),
  useSystemSettingsSupported: vi.fn().mockReturnValue(false),
}));

describe('NotificationDisplaySettingsPanel', () => {
  beforeEach(() => {
    store.dispatch(resetPreferences());
  });

  it('renders display preferences options correctly', () => {
    render(
      <Provider store={store}>
        <NotificationDisplaySettingsPanel />
      </Provider>,
    );

    expect(screen.getByText('Notification Display')).toBeDefined();
    expect(
      screen.getByText('Show notification message previews'),
    ).toBeDefined();
    expect(
      screen.getByText('Show notifications during calls & meetings'),
    ).toBeDefined();
    expect(
      screen.getByText('Flash taskbar when notification arrives'),
    ).toBeDefined();
    expect(screen.getByText('Top Left')).toBeDefined();
    expect(screen.getByText('Top Right')).toBeDefined();
    expect(screen.getByText('Bottom Left')).toBeDefined();
    expect(screen.getByText('Bottom Right')).toBeDefined();
  });

  it('updates position when clicking Top Right', () => {
    render(
      <Provider store={store}>
        <NotificationDisplaySettingsPanel />
      </Provider>,
    );

    const topRightBtn = screen.getByText('Top Right');
    fireEvent.click(topRightBtn);

    const state = store.getState();
    expect(state.preferences.preferences.notifications.position).toBe(
      'top-right',
    );
  });

  it('updates size when clicking Compact', () => {
    render(
      <Provider store={store}>
        <NotificationDisplaySettingsPanel />
      </Provider>,
    );

    const compactBtn = screen.getByText('Compact');
    fireEvent.click(compactBtn);

    const state = store.getState();
    expect(state.preferences.preferences.notifications.size).toBe('compact');
  });
});

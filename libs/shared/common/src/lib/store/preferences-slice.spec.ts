import { describe, it, expect, beforeEach, vi } from 'vitest';
import preferencesReducer, {
  setPreferences,
  updateChatPreferences,
  updateNotificationPreferences,
  resetPreferences,
  DEFAULT_USER_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  loadInitialPreferences,
  type PreferencesState,
} from './preferences-slice.js';

describe('preferences-slice', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes with default preferences when localStorage is empty', () => {
    const state: PreferencesState = {
      preferences: loadInitialPreferences(),
      isLoadedFromServer: false,
      isSyncing: false,
      lastError: null,
    };
    expect(state.preferences.chat.messageDensity).toBe('comfy');
    expect(state.preferences.chat.openPosition).toBe('last-read');
    expect(state.preferences.chat.readReceipts).toBe(true);
    expect(state.preferences.notifications.position).toBe('bottom-right');
    expect(state.preferences.notifications.size).toBe('comfy');
    expect(state.preferences.notifications.dismissDuration).toBe(5000);
  });

  it('updates chat message density and persists to localStorage', () => {
    const initialState: PreferencesState = {
      preferences: DEFAULT_USER_PREFERENCES,
      isLoadedFromServer: false,
      isSyncing: false,
      lastError: null,
    };

    const nextState = preferencesReducer(
      initialState,
      updateChatPreferences({ messageDensity: 'compact' }),
    );

    expect(nextState.preferences.chat.messageDensity).toBe('compact');
    expect(nextState.preferences.chat.openPosition).toBe('last-read');
    expect(nextState.preferences.chat.readReceipts).toBe(true);

    const saved = JSON.parse(
      window.localStorage.getItem(PREFERENCES_STORAGE_KEY) || '{}',
    );
    expect(saved.chat.messageDensity).toBe('compact');
  });

  it('updates notification position, size, and duration', () => {
    const initialState: PreferencesState = {
      preferences: DEFAULT_USER_PREFERENCES,
      isLoadedFromServer: false,
      isSyncing: false,
      lastError: null,
    };

    const nextState = preferencesReducer(
      initialState,
      updateNotificationPreferences({
        position: 'top-right',
        size: 'compact',
        dismissDuration: 10000,
        showContentPreview: false,
      }),
    );

    expect(nextState.preferences.notifications.position).toBe('top-right');
    expect(nextState.preferences.notifications.size).toBe('compact');
    expect(nextState.preferences.notifications.dismissDuration).toBe(10000);
    expect(nextState.preferences.notifications.showContentPreview).toBe(false);
  });

  it('sanitizes invalid stored values back to defaults', () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        chat: { messageDensity: 'invalid_density', openPosition: 'invalid_pos' },
        notifications: { position: 'invalid_pos', dismissDuration: 99999 },
      }),
    );

    const loaded = loadInitialPreferences();
    expect(loaded.chat.messageDensity).toBe('comfy');
    expect(loaded.chat.openPosition).toBe('last-read');
    expect(loaded.notifications.position).toBe('bottom-right');
    expect(loaded.notifications.dismissDuration).toBe(5000);
  });

  it('resets preferences back to defaults', () => {
    const customState: PreferencesState = {
      preferences: {
        chat: {
          messageDensity: 'compact',
          openPosition: 'newest',
          readReceipts: false,
        },
        notifications: {
          showContentPreview: false,
          showDuringCalls: false,
          flashTaskbar: false,
          dismissDuration: null,
          position: 'top-left',
          size: 'compact',
        },
      },
      isLoadedFromServer: true,
      isSyncing: false,
      lastError: null,
    };

    const resetState = preferencesReducer(customState, resetPreferences());
    expect(resetState.preferences).toEqual(DEFAULT_USER_PREFERENCES);
  });
});

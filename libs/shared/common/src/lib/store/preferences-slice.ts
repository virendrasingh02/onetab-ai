import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
  type ChatPreferences,
  type MessageDensity,
  type NotificationDismissDuration,
  type NotificationDisplayPreferences,
  type NotificationPosition,
  type NotificationSize,
  type NotificationSoundEvent,
  type NotificationSoundPreferences,
  type NotificationSoundPreferencesPatch,
  type NotificationSoundProfile,
  type OpenChatPosition,
  type UserPreferences,
} from '@org/types';

export { DEFAULT_NOTIFICATION_SOUND_PREFERENCES } from '@org/types';

export const PREFERENCES_STORAGE_KEY = 'onetab:user_preferences';

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  messageDensity: 'comfy',
  openPosition: 'last-read',
  readReceipts: true,
};

const NOTIFICATION_SOUND_EVENTS: NotificationSoundEvent[] = [
  'message',
  'dm',
  'mention',
  'priority',
  'call',
  'success',
];

const NOTIFICATION_SOUND_PROFILES: NotificationSoundProfile[] = [
  'calm',
  'warm',
  'crisp',
];

export const DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES: NotificationDisplayPreferences = {
  showContentPreview: true,
  showDuringCalls: true,
  flashTaskbar: true,
  dismissDuration: 5000,
  position: 'bottom-right',
  size: 'comfy',
  sound: DEFAULT_NOTIFICATION_SOUND_PREFERENCES,
};

function sanitizeSoundPreferences(raw: unknown): NotificationSoundPreferences {
  const base = DEFAULT_NOTIFICATION_SOUND_PREFERENCES;
  if (!raw || typeof raw !== 'object') return { ...base, events: { ...base.events } };
  const obj = raw as Record<string, unknown>;

  const enabled =
    typeof obj['enabled'] === 'boolean' ? obj['enabled'] : base.enabled;

  const rawVolume = obj['volume'];
  const volume =
    typeof rawVolume === 'number' && Number.isFinite(rawVolume)
      ? Math.min(1, Math.max(0, rawVolume))
      : base.volume;

  const profile: NotificationSoundProfile = NOTIFICATION_SOUND_PROFILES.includes(
    obj['profile'] as NotificationSoundProfile,
  )
    ? (obj['profile'] as NotificationSoundProfile)
    : base.profile;

  const onlyWhenUnfocused =
    typeof obj['onlyWhenUnfocused'] === 'boolean'
      ? obj['onlyWhenUnfocused']
      : base.onlyWhenUnfocused;

  const rawEvents = (obj['events'] && typeof obj['events'] === 'object'
    ? obj['events']
    : {}) as Record<string, unknown>;
  const events = {} as NotificationSoundPreferences['events'];
  for (const key of NOTIFICATION_SOUND_EVENTS) {
    events[key] =
      typeof rawEvents[key] === 'boolean'
        ? (rawEvents[key] as boolean)
        : base.events[key];
  }

  return { enabled, volume, profile, onlyWhenUnfocused, events };
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  chat: DEFAULT_CHAT_PREFERENCES,
  notifications: DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES,
};

export interface PreferencesState {
  preferences: UserPreferences;
  isLoadedFromServer: boolean;
  isSyncing: boolean;
  lastError: string | null;
}

function sanitizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_USER_PREFERENCES;
  const obj = raw as Record<string, unknown>;

  const chatObj = (obj['chat'] && typeof obj['chat'] === 'object'
    ? obj['chat']
    : {}) as Record<string, unknown>;
  const notifObj = (obj['notifications'] && typeof obj['notifications'] === 'object'
    ? obj['notifications']
    : {}) as Record<string, unknown>;

  const density: MessageDensity =
    chatObj['messageDensity'] === 'compact' ? 'compact' : 'comfy';
  const openPos: OpenChatPosition =
    chatObj['openPosition'] === 'newest' ? 'newest' : 'last-read';
  const readReceipts =
    typeof chatObj['readReceipts'] === 'boolean' ? chatObj['readReceipts'] : true;

  const showContentPreview =
    typeof notifObj['showContentPreview'] === 'boolean'
      ? notifObj['showContentPreview']
      : true;
  const showDuringCalls =
    typeof notifObj['showDuringCalls'] === 'boolean'
      ? notifObj['showDuringCalls']
      : true;
  const flashTaskbar =
    typeof notifObj['flashTaskbar'] === 'boolean'
      ? notifObj['flashTaskbar']
      : true;

  const validDurations: NotificationDismissDuration[] = [
    3000, 5000, 10000, 15000, 30000, null,
  ];
  const rawDuration = notifObj['dismissDuration'];
  const dismissDuration: NotificationDismissDuration = validDurations.includes(
    rawDuration as NotificationDismissDuration,
  )
    ? (rawDuration as NotificationDismissDuration)
    : 5000;

  const validPositions: NotificationPosition[] = [
    'bottom-right',
    'top-right',
    'bottom-left',
    'top-left',
  ];
  const rawPos = notifObj['position'];
  const position: NotificationPosition = validPositions.includes(
    rawPos as NotificationPosition,
  )
    ? (rawPos as NotificationPosition)
    : 'bottom-right';

  const size: NotificationSize =
    notifObj['size'] === 'compact' ? 'compact' : 'comfy';

  const sound = sanitizeSoundPreferences(notifObj['sound']);

  return {
    chat: {
      messageDensity: density,
      openPosition: openPos,
      readReceipts,
    },
    notifications: {
      showContentPreview,
      showDuringCalls,
      flashTaskbar,
      dismissDuration,
      position,
      size,
      sound,
    },
  };
}

export function loadInitialPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_USER_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function persistPreferencesLocally(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Ignore in private / restricted storage
  }
}

const initialState: PreferencesState = {
  preferences: loadInitialPreferences(),
  isLoadedFromServer: false,
  isSyncing: false,
  lastError: null,
};

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setPreferences(state, action: PayloadAction<UserPreferences>) {
      state.preferences = sanitizePreferences(action.payload);
      state.isLoadedFromServer = true;
      persistPreferencesLocally(state.preferences);
    },
    updateChatPreferences(state, action: PayloadAction<Partial<ChatPreferences>>) {
      state.preferences.chat = {
        ...state.preferences.chat,
        ...action.payload,
      };
      state.preferences = sanitizePreferences(state.preferences);
      persistPreferencesLocally(state.preferences);
    },
    updateNotificationPreferences(
      state,
      action: PayloadAction<Partial<NotificationDisplayPreferences>>,
    ) {
      state.preferences.notifications = {
        ...state.preferences.notifications,
        ...action.payload,
      };
      state.preferences = sanitizePreferences(state.preferences);
      persistPreferencesLocally(state.preferences);
    },
    /**
     * Patches only the nested `notifications.sound` block. Kept separate from
     * `updateNotificationPreferences` because a shallow spread there would drop
     * the untouched sound fields (e.g. the per-event map) whenever a caller
     * passed `{ sound: { volume } }`.
     */
    updateNotificationSoundPreferences(
      state,
      action: PayloadAction<NotificationSoundPreferencesPatch>,
    ) {
      const current = state.preferences.notifications.sound;
      state.preferences.notifications.sound = {
        ...current,
        ...action.payload,
        events: {
          ...current.events,
          ...(action.payload.events ?? {}),
        },
      };
      state.preferences = sanitizePreferences(state.preferences);
      persistPreferencesLocally(state.preferences);
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    setSyncError(state, action: PayloadAction<string | null>) {
      state.lastError = action.payload;
      state.isSyncing = false;
    },
    resetPreferences(state) {
      state.preferences = DEFAULT_USER_PREFERENCES;
      persistPreferencesLocally(state.preferences);
    },
  },
});

export const {
  setPreferences,
  updateChatPreferences,
  updateNotificationPreferences,
  updateNotificationSoundPreferences,
  setSyncing,
  setSyncError,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ChatPreferences,
  MessageDensity,
  NotificationDismissDuration,
  NotificationDisplayPreferences,
  NotificationPosition,
  NotificationSize,
  OpenChatPosition,
  UserPreferences,
} from '@org/types';

export const PREFERENCES_STORAGE_KEY = 'onetab:user_preferences';

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  messageDensity: 'comfy',
  openPosition: 'last-read',
  readReceipts: true,
};

export const DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES: NotificationDisplayPreferences = {
  showContentPreview: true,
  showDuringCalls: true,
  flashTaskbar: true,
  dismissDuration: 5000,
  position: 'bottom-right',
  size: 'comfy',
};

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
  setSyncing,
  setSyncError,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;

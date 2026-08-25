export * from './lib/common.js';
export { store, type RootState, type AppDispatch } from './lib/store/store.js';
export {
  useAppDispatch,
  useAppSelector,
  useUserPreferences,
  useChatPreferences,
  useNotificationDisplayPreferences,
  useMessageDensity,
  useOpenChatPosition,
  useReadReceipts,
  useNotificationPosition,
  useNotificationSize,
  useDismissDuration,
} from './lib/store/hooks.js';
export {
  preferencesSlice,
  setPreferences,
  updateChatPreferences,
  updateNotificationPreferences,
  setSyncing,
  setSyncError,
  resetPreferences,
  PREFERENCES_STORAGE_KEY,
  DEFAULT_CHAT_PREFERENCES,
  DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  loadInitialPreferences,
  persistPreferencesLocally,
  type PreferencesState,
} from './lib/store/preferences-slice.js';
export {
  uiSlice,
  setActiveWorkspace,
  setActiveChannel,
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  type UIState,
} from './lib/store/ui-slice.js';


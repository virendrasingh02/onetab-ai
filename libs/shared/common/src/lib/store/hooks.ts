import { useCallback } from 'react';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
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
import {
  setPreferences,
  updateChatPreferences,
  updateNotificationPreferences,
  resetPreferences,
} from './preferences-slice.js';
import type { AppDispatch, RootState } from './store.js';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export function useUserPreferences(): {
  preferences: UserPreferences;
  setPreferences: (prefs: UserPreferences) => void;
  updateChatPreferences: (patch: Partial<ChatPreferences>) => void;
  updateNotificationPreferences: (
    patch: Partial<NotificationDisplayPreferences>,
  ) => void;
  resetPreferences: () => void;
  isLoadedFromServer: boolean;
} {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences.preferences);
  const isLoadedFromServer = useAppSelector(
    (state) => state.preferences.isLoadedFromServer,
  );

  const handleSetPreferences = useCallback(
    (prefs: UserPreferences) => dispatch(setPreferences(prefs)),
    [dispatch],
  );

  const handleUpdateChatPreferences = useCallback(
    (patch: Partial<ChatPreferences>) =>
      dispatch(updateChatPreferences(patch)),
    [dispatch],
  );

  const handleUpdateNotificationPreferences = useCallback(
    (patch: Partial<NotificationDisplayPreferences>) =>
      dispatch(updateNotificationPreferences(patch)),
    [dispatch],
  );

  const handleResetPreferences = useCallback(
    () => dispatch(resetPreferences()),
    [dispatch],
  );

  return {
    preferences,
    setPreferences: handleSetPreferences,
    updateChatPreferences: handleUpdateChatPreferences,
    updateNotificationPreferences: handleUpdateNotificationPreferences,
    resetPreferences: handleResetPreferences,
    isLoadedFromServer,
  };
}

export function useChatPreferences(): {
  chat: ChatPreferences;
  updateChatPreferences: (patch: Partial<ChatPreferences>) => void;
} {
  const dispatch = useAppDispatch();
  const chat = useAppSelector((state) => state.preferences.preferences.chat);

  const handleUpdateChat = useCallback(
    (patch: Partial<ChatPreferences>) => dispatch(updateChatPreferences(patch)),
    [dispatch],
  );

  return {
    chat,
    updateChatPreferences: handleUpdateChat,
  };
}

export function useNotificationDisplayPreferences(): {
  notifications: NotificationDisplayPreferences;
  updateNotificationPreferences: (
    patch: Partial<NotificationDisplayPreferences>,
  ) => void;
} {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(
    (state) => state.preferences.preferences.notifications,
  );

  const handleUpdateNotifications = useCallback(
    (patch: Partial<NotificationDisplayPreferences>) =>
      dispatch(updateNotificationPreferences(patch)),
    [dispatch],
  );

  return {
    notifications,
    updateNotificationPreferences: handleUpdateNotifications,
  };
}

export function useMessageDensity(): MessageDensity {
  return useAppSelector(
    (state) => state.preferences.preferences.chat.messageDensity,
  );
}

export function useOpenChatPosition(): OpenChatPosition {
  return useAppSelector(
    (state) => state.preferences.preferences.chat.openPosition,
  );
}

export function useReadReceipts(): boolean {
  return useAppSelector(
    (state) => state.preferences.preferences.chat.readReceipts,
  );
}

export function useNotificationPosition(): NotificationPosition {
  return useAppSelector(
    (state) => state.preferences.preferences.notifications.position,
  );
}

export function useNotificationSize(): NotificationSize {
  return useAppSelector(
    (state) => state.preferences.preferences.notifications.size,
  );
}

export function useDismissDuration(): NotificationDismissDuration {
  return useAppSelector(
    (state) => state.preferences.preferences.notifications.dismissDuration,
  );
}

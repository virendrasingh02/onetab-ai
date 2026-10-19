import { notificationApi } from '@org/api-client';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { appConfig } from './config';
import { routeForDeepLink } from './deep-links';
import { secureStore } from './secure-store';
import { useSession } from './session';
import { STORAGE_KEYS } from './session-core';
import { useWorkspace } from './workspace';

/**
 * Expo push needs a native install (APNs/FCM). In a browser the notification
 * centre still works through the API; there is just no device to register.
 */
const pushSupported = Platform.OS !== 'web';

// Foreground pushes show as banners too; the in-app badge comes from the API.
if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export type PushStatus =
  'registered' | 'denied' | 'unsupported' | 'unconfigured';

const APP_ID = `${Application.applicationId ?? 'ai.onetab.mobile'}.${Platform.OS}`;

/**
 * Asks for permission (only when `prompt`), fetches this install's Expo push
 * token and registers it with the API's existing `/notifications/devices`.
 * The API's push delivery service then sends every notification-centre row to
 * it.
 */
export async function registerForPush(prompt: boolean): Promise<PushStatus> {
  if (!pushSupported || !Device.isDevice) return 'unsupported';
  if (!appConfig.easProjectId) return 'unconfigured';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && prompt) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return 'denied';

  const { data: pushKey } = await Notifications.getExpoPushTokenAsync({
    projectId: appConfig.easProjectId,
  });
  const device = await notificationApi.registerDevice({
    pushKey,
    appId: APP_ID,
    deviceDisplayName: Device.deviceName ?? Device.modelName ?? undefined,
  });
  await secureStore.set(STORAGE_KEYS.pushRegistrationId, device.id);
  return 'registered';
}

/** Stops pushes to this install. Called on sign-out and from Settings. */
export async function unregisterForPush(): Promise<void> {
  const id = await secureStore.get(STORAGE_KEYS.pushRegistrationId);
  if (!id) return;
  await notificationApi.revokeDevice(id).catch(() => undefined);
  await secureStore.remove(STORAGE_KEYS.pushRegistrationId);
}

interface PushData {
  deepLink?: string | null;
  workspaceSlug?: string | null;
}

/**
 * Registers on sign-in, revokes on sign-out, and routes notification taps —
 * including the tap that cold-started the app — to the matching screen in the
 * notification's own workspace.
 */
export function usePushNotifications(): void {
  const { status, registerSignOutHook } = useSession();
  const { selectWorkspaceBySlug, workspace } = useWorkspace();
  const router = useRouter();
  const handledInitial = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn') return;
    void registerForPush(true).catch(() => undefined);
    return registerSignOutHook(unregisterForPush);
  }, [status, registerSignOutHook]);

  useEffect(() => {
    if (!pushSupported || status !== 'signedIn' || !workspace) return;

    const open = (response: Notifications.NotificationResponse) => {
      const data = (response.notification.request.content.data ??
        {}) as PushData;
      if (data.workspaceSlug) selectWorkspaceBySlug(data.workspaceSlug);
      const route = routeForDeepLink(data.deepLink);
      router.push({ pathname: route.pathname, params: route.params } as Href);
    };

    if (!handledInitial.current) {
      handledInitial.current = true;
      const initial = Notifications.getLastNotificationResponse();
      if (initial) {
        Notifications.clearLastNotificationResponse();
        open(initial);
      }
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [status, workspace, router, selectWorkspaceBySlug]);
}

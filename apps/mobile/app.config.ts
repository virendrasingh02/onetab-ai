import type { ExpoConfig } from 'expo/config';

/**
 * One config, three variants, picked by `APP_VARIANT` (set per EAS build
 * profile in eas.json). Each variant gets its own bundle id so a development
 * build, an internal preview and the store build can sit side by side on one
 * device.
 *
 * Everything under `extra` ends up inside the app binary and is readable by
 * anyone holding it — only public values (URLs, the EAS project id) belong
 * here. Server secrets stay on the API.
 */
type Variant = 'development' | 'preview' | 'production';

const variant = (process.env.APP_VARIANT ?? 'development') as Variant;

const BASE_ID = 'ai.onetab.mobile';
const identifier =
  variant === 'production'
    ? BASE_ID
    : `${BASE_ID}.${variant === 'preview' ? 'preview' : 'dev'}`;
const name =
  variant === 'production'
    ? 'Onetab AI'
    : `Onetab AI (${variant === 'preview' ? 'Preview' : 'Dev'})`;

// The API host the app talks to. A phone cannot reach the dev machine's
// `localhost`, so development needs the LAN IP (or a tunnel) here.
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:4200';
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name,
  slug: 'onetab-ai',
  owner: process.env.EXPO_OWNER,
  version: '0.1.0',
  scheme: 'onetab',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: identifier,
    supportsTablet: true,
    buildNumber: '1',
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSFaceIDUsageDescription: 'Use Face ID to unlock Onetab AI.',
      NSCameraUsageDescription: 'Take photos to share in chat and files.',
      NSPhotoLibraryUsageDescription:
        'Choose photos to share in chat and files.',
    },
  },
  android: {
    package: identifier,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    // Only what the features actually use. Image picker would otherwise add
    // microphone access for video capture, which the app never does.
    permissions: [
      'android.permission.CAMERA',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.POST_NOTIFICATIONS',
    ],
    // SYSTEM_ALERT_WINDOW comes from the React Native template for the debug
    // overlay; Google Play treats it as sensitive, so store builds drop it.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      ...(variant === 'production'
        ? ['android.permission.SYSTEM_ALERT_WINDOW']
        : []),
    ],
    intentFilters: [
      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [{ scheme: 'onetab' }],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#FCFBF8',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0A0A0A' },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#60C686',
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Use Face ID to unlock Onetab AI.' },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose photos to share in chat and files.',
        cameraPermission: 'Take photos to share in chat and files.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    variant,
    apiUrl,
    webUrl,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;

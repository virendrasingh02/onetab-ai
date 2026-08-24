/**
 * @org/web-desktop — the renderer half of the Electron shell.
 *
 * Everything here is safe to import from the plain web build: the bridge is
 * feature-detected at load, and each helper falls back to its browser
 * equivalent (or a no-op) when `window.onetabDesktop` is absent.
 */

export {
  copyText,
  getDesktopApi,
  isDesktop,
  notify,
  openExternal,
  pickFiles,
  saveFile,
  setBadgeCount,
  type DesktopAppInfo,
  type DesktopAppMetadata,
  type DesktopAuthSession,
  type DesktopCapabilities,
  type DesktopCommand,
  type DesktopDeepLink,
  type DesktopHandoffRequest,
  type DesktopNotificationRequest,
  type DesktopOpenFilesRequest,
  type DesktopPickedFile,
  type DesktopPlatform,
  type DesktopSaveFileRequest,
  type DesktopSaveResult,
  type DesktopUpdateStatus,
  type DesktopWindowState,
  type OneTabDesktopApi,
} from './lib/desktop-api.js';

export {
  desktop,
  isFeatureAvailable,
  useCapabilities,
  useDesktopCapability,
  WEB_DEFAULT_CAPABILITIES,
} from './lib/capabilities.js';

export { FeatureGate, type FeatureGateProps } from './lib/feature-gate.js';
export { FEATURE_MATRIX, type FeatureMatrixItem } from './lib/feature-matrix.js';
export { DEFAULT_APP_METADATA, getAppMetadata, useAppMetadata } from './lib/app-metadata.js';
export {
  openAppOrWeb,
  openDesktopOrFallback,
  openInBrowser,
  type DesktopDetectionOptions,
  type OpenAppOrWebOptions,
} from './lib/handoff.js';

export { DesktopProvider, useDesktop } from './lib/desktop-provider.js';
export { useDesktopCommand } from './lib/use-desktop-command.js';
export { useDesktopBadge } from './lib/use-desktop-badge.js';
export { useDesktopPreference } from './lib/use-desktop-preference.js';

export { DesktopChrome } from './lib/desktop-chrome.js';
export { DesktopTitleBar } from './lib/desktop-title-bar.js';
export { DesktopUpdateBanner } from './lib/desktop-update-banner.js';
export { DesktopSettingsCard } from './lib/desktop-settings-card.js';
export { PlatformNotice, type PlatformNoticeProps } from './lib/platform-notice.js';

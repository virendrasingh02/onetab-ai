/**
 * @org/web-desktop — the renderer half of the Electron shell.
 *
 * Everything here is safe to import from the plain web build: the bridge is
 * feature-detected at load, and each helper falls back to its browser
 * equivalent (or a no-op) when `window.onetabDesktop` is absent.
 */

export {
  copyText,
  flashFrame,
  getDesktopApi,
  isDesktop,
  notify,
  openExternal,
  openSystemSettings,
  pickFiles,
  saveFile,
  setBadgeCount,
  type DesktopAppInfo,
  type DesktopAppMetadata,
  type DesktopAuthSession,
  type DesktopCapabilities,
  type DesktopCommand,
  type DesktopDeepLink,
  type DesktopDistribution,
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
  supportsSystemSettings,
  supportsTaskbarFlash,
  useCapabilities,
  useDesktopCapability,
  useSystemSettingsSupported,
  useTaskbarFlashSupported,
  WEB_DEFAULT_CAPABILITIES,
} from './lib/capabilities.js';

export { FeatureGate, type FeatureGateProps } from './lib/feature-gate.js';
export { DEFAULT_APP_METADATA, getAppMetadata, useAppMetadata } from './lib/app-metadata.js';
export {
  isMobileDevice,
  openAppOrWeb,
  openDesktopApp,
  openDesktopOrFallback,
  openInBrowser,
  useIsMobile,
  type DesktopDetectionOptions,
  type OpenAppOrWebOptions,
  type OpenDesktopAppOptions,
} from './lib/handoff.js';

export { DesktopProvider, useDesktop } from './lib/desktop-provider.js';
export { useDesktopCommand } from './lib/use-desktop-command.js';
export { useDesktopBadge } from './lib/use-desktop-badge.js';
export { useDesktopPreference } from './lib/use-desktop-preference.js';

export { DesktopChrome } from './lib/desktop-chrome.js';
export { DesktopTitleBar } from './lib/desktop-title-bar.js';
export { DesktopTitleBarInset } from './lib/desktop-title-bar-inset.js';
export { DesktopWindowControls } from './lib/desktop-window-controls.js';
export { DesktopUpdateIndicator } from './lib/desktop-update-indicator.js';
export { DesktopSettingsCard } from './lib/desktop-settings-card.js';
export { PlatformNotice, type PlatformNoticeProps } from './lib/platform-notice.js';
export { DRAG, NO_DRAG } from './lib/drag-region.js';
export { useClaimsWindowChrome } from './lib/window-chrome-store.js';

// --- capability/feature/policy layer (@org/platform-backed) ---------------
export { toPlatformSnapshot } from './lib/platform-snapshot.js';
export {
  featureManager,
  useAllFeatures,
  useCapability,
  useDistribution,
  useFeature,
  usePlatform,
  usePlatformSnapshot,
} from './lib/use-feature.js';
export { FeatureRoute, FeatureUnavailableNotice, type FeatureRouteProps } from './lib/feature-route.js';
export { PlatformDiagnosticsPage } from './lib/platform-diagnostics-page.js';
export { PlatformDiagnosticsLink } from './lib/platform-diagnostics-link.js';

// --- device-aware app downloads -------------------------------------------
export {
  useAppDownload,
  DOWNLOAD_DISMISSED_KEY,
  DOWNLOAD_SNOOZE_KEY,
  DOWNLOAD_SELECTED_OS_KEY,
  type UseAppDownloadOptions,
  type UseAppDownloadReturn,
} from './lib/use-app-download.js';
export {
  AppDownloadBanner,
  type AppDownloadBannerProps,
} from './lib/app-download-banner.js';
export {
  AppDownloadCard,
  type AppDownloadCardProps,
} from './lib/app-download-card.js';


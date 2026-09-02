import type { OperatingSystem } from "./device-environment.js";

export type MobilePlatform = "ios" | "android";
export type DesktopPlatform = "windows" | "macos" | "linux";
export type DownloadPlatform = MobilePlatform | DesktopPlatform;

export interface MobileStoreConfig {
  url: string;
  storeName: string;
  badgeLabel: string;
  /** iOS bundle identifier, e.g. `ai.onetab.mobile`. */
  bundleId?: string;
  /** iOS numeric App Store id. */
  appStoreId?: string;
  /** Android application id, e.g. `ai.onetab.mobile`. */
  packageName?: string;
}

export interface DesktopInstallerConfig {
  url: string;
  label: string;
  installerType: "exe" | "msi" | "dmg" | "pkg" | "appimage" | "deb" | "rpm" | "zip";
  arch?: string;
}

export interface AppDownloadConfig {
  mobile: {
    ios: MobileStoreConfig;
    android: MobileStoreConfig;
    universalLinkScheme: string;
    deepLinkProtocol: string;
  };
  desktop: {
    windows: DesktopInstallerConfig;
    macos: DesktopInstallerConfig;
    linux: DesktopInstallerConfig;
    protocolScheme: string;
  };
  webFallbackUrl: string;
}

const getEnv = (key: string, fallback: string): string => {
  try {
    // `import.meta.env` is Vite-only and absent from this lib's ambient types
    // (it is Node-typed on purpose). Read it through a local structural view so
    // the file still type-checks for a Node consumer.
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    if (env && typeof env[key] === "string") {
      return env[key] as string;
    }
  } catch {
    // ignore
  }
  return fallback;
};

export const DEFAULT_APP_DOWNLOAD_CONFIG: AppDownloadConfig = {
  mobile: {
    ios: {
      url: getEnv("VITE_IOS_APP_URL", "https://apps.apple.com/app/onetab-ai/id1670000000"),
      storeName: "Apple App Store",
      badgeLabel: "App Store",
      bundleId: "ai.onetab.mobile",
      appStoreId: "1670000000",
    },
    android: {
      url: getEnv("VITE_ANDROID_APP_URL", "https://play.google.com/store/apps/details?id=ai.onetab.mobile"),
      storeName: "Google Play Store",
      badgeLabel: "Google Play",
      packageName: "ai.onetab.mobile",
    },
    universalLinkScheme: getEnv("VITE_MOBILE_UNIVERSAL_LINK", "https://app.onetab.ai"),
    deepLinkProtocol: getEnv("VITE_DEEP_LINK_SCHEME", "onetab://"),
  },
  desktop: {
    windows: {
      url: getEnv("VITE_DESKTOP_WINDOWS_URL", "https://download.onetab.ai/desktop/windows/OneTab-AI-Setup.exe"),
      label: "Windows (.exe)",
      installerType: "exe",
      arch: "x64",
    },
    macos: {
      url: getEnv("VITE_DESKTOP_MACOS_URL", "https://download.onetab.ai/desktop/mac/OneTab-AI.dmg"),
      label: "macOS (.dmg)",
      installerType: "dmg",
      arch: "universal",
    },
    linux: {
      url: getEnv("VITE_DESKTOP_LINUX_URL", "https://download.onetab.ai/desktop/linux/OneTab-AI.AppImage"),
      label: "Linux (.AppImage)",
      installerType: "appimage",
      arch: "x64",
    },
    protocolScheme: getEnv("VITE_DESKTOP_PROTOCOL_SCHEME", "mie://"),
  },
  webFallbackUrl: getEnv("VITE_WEB_APP_URL", "https://onetab.ai/download"),
};

export interface DownloadOption {
  platform: DownloadPlatform;
  os: OperatingSystem;
  label: string;
  url: string;
  isMobile: boolean;
  storeOrFormat: string;
  isPrimaryForUser: boolean;
}

export function getDownloadOptionForOS(
  os: OperatingSystem,
  config: AppDownloadConfig = DEFAULT_APP_DOWNLOAD_CONFIG,
): DownloadOption | null {
  switch (os) {
    case "ios":
      return {
        platform: "ios",
        os: "ios",
        label: "Download on the App Store",
        url: config.mobile.ios.url,
        isMobile: true,
        storeOrFormat: config.mobile.ios.storeName,
        isPrimaryForUser: true,
      };
    case "android":
      return {
        platform: "android",
        os: "android",
        label: "Get it on Google Play",
        url: config.mobile.android.url,
        isMobile: true,
        storeOrFormat: config.mobile.android.storeName,
        isPrimaryForUser: true,
      };
    case "windows":
      return {
        platform: "windows",
        os: "windows",
        label: "Download for Windows",
        url: config.desktop.windows.url,
        isMobile: false,
        storeOrFormat: config.desktop.windows.label,
        isPrimaryForUser: true,
      };
    case "macos":
      return {
        platform: "macos",
        os: "macos",
        label: "Download for Mac",
        url: config.desktop.macos.url,
        isMobile: false,
        storeOrFormat: config.desktop.macos.label,
        isPrimaryForUser: true,
      };
    case "linux":
      return {
        platform: "linux",
        os: "linux",
        label: "Download for Linux",
        url: config.desktop.linux.url,
        isMobile: false,
        storeOrFormat: config.desktop.linux.label,
        isPrimaryForUser: true,
      };
    default:
      return null;
  }
}

export function getAllDesktopDownloadOptions(
  userOS?: OperatingSystem,
  config: AppDownloadConfig = DEFAULT_APP_DOWNLOAD_CONFIG,
): DownloadOption[] {
  return [
    {
      platform: "windows",
      os: "windows",
      label: "Windows (.exe)",
      url: config.desktop.windows.url,
      isMobile: false,
      storeOrFormat: config.desktop.windows.label,
      isPrimaryForUser: userOS === "windows",
    },
    {
      platform: "macos",
      os: "macos",
      label: "macOS (.dmg)",
      url: config.desktop.macos.url,
      isMobile: false,
      storeOrFormat: config.desktop.macos.label,
      isPrimaryForUser: userOS === "macos",
    },
    {
      platform: "linux",
      os: "linux",
      label: "Linux (.AppImage)",
      url: config.desktop.linux.url,
      isMobile: false,
      storeOrFormat: config.desktop.linux.label,
      isPrimaryForUser: userOS === "linux",
    },
  ];
}

export function getAllMobileDownloadOptions(
  userOS?: OperatingSystem,
  config: AppDownloadConfig = DEFAULT_APP_DOWNLOAD_CONFIG,
): DownloadOption[] {
  return [
    {
      platform: "ios",
      os: "ios",
      label: "Apple App Store",
      url: config.mobile.ios.url,
      isMobile: true,
      storeOrFormat: config.mobile.ios.storeName,
      isPrimaryForUser: userOS === "ios",
    },
    {
      platform: "android",
      os: "android",
      label: "Google Play Store",
      url: config.mobile.android.url,
      isMobile: true,
      storeOrFormat: config.mobile.android.storeName,
      isPrimaryForUser: userOS === "android",
    },
  ];
}

export function buildAppDeepLink(
  route: string,
  params: Record<string, string> = {},
  config: AppDownloadConfig = DEFAULT_APP_DOWNLOAD_CONFIG,
): string {
  const cleanRoute = route.startsWith("/") ? route.slice(1) : route;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) query.set(k, v);
  }
  const queryString = query.toString() ? "?" + query.toString() : "";
  const scheme = config.desktop.protocolScheme.endsWith("//")
    ? config.desktop.protocolScheme
    : config.desktop.protocolScheme + "//";
  return scheme + cleanRoute + queryString;
}

export function isDownloadAvailableForOS(
  os: OperatingSystem,
  config: AppDownloadConfig = DEFAULT_APP_DOWNLOAD_CONFIG,
): boolean {
  const option = getDownloadOptionForOS(os, config);
  return option !== null && Boolean(option.url);
}

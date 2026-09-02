import {
  DEFAULT_APP_DOWNLOAD_CONFIG,
  detectDeviceEnvironment,
  getAllDesktopDownloadOptions,
  getAllMobileDownloadOptions,
  getDownloadOptionForOS,
  type AppDownloadConfig,
  type DeviceEnvironment,
  type DownloadOption,
  type OperatingSystem,
} from "@org/platform";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isDesktop } from "./desktop-api.js";

export const DOWNLOAD_DISMISSED_KEY = "onetab:download-prompt:dismissed";
export const DOWNLOAD_SNOOZE_KEY = "onetab:download-prompt:snooze-until";
export const DOWNLOAD_SELECTED_OS_KEY = "onetab:download-prompt:selected-os";

export interface UseAppDownloadOptions {
  config?: AppDownloadConfig;
  workspaceId?: string;
}

export interface UseAppDownloadReturn {
  environment: DeviceEnvironment;
  shouldShowPrompt: boolean;
  isDismissed: boolean;
  isSnoozed: boolean;
  primaryOption: DownloadOption | null;
  desktopOptions: DownloadOption[];
  mobileOptions: DownloadOption[];
  selectedDesktopPlatform: OperatingSystem;
  dismiss: () => void;
  snooze: (hours: number) => void;
  resetState: () => void;
  selectDesktopPlatform: (os: OperatingSystem) => void;
  trackDownload: (option: DownloadOption, source?: string) => void;
}

export function useAppDownload(options: UseAppDownloadOptions = {}): UseAppDownloadReturn {
  const config = options.config ?? DEFAULT_APP_DOWNLOAD_CONFIG;

  const [environment, setEnvironment] = useState<DeviceEnvironment>(() => {
    return detectDeviceEnvironment({ isElectron: isDesktop });
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DOWNLOAD_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(DOWNLOAD_SNOOZE_KEY);
      if (!stored) return null;
      const parsed = parseInt(stored, 10);
      return !isNaN(parsed) && parsed > Date.now() ? parsed : null;
    } catch {
      return null;
    }
  });

  const [selectedDesktopPlatform, setSelectedDesktopPlatformState] = useState<OperatingSystem>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(DOWNLOAD_SELECTED_OS_KEY) as OperatingSystem | null;
        if (stored && ["windows", "macos", "linux"].includes(stored)) {
          return stored;
        }
      } catch {
        // ignore
      }
    }
    const detected = detectDeviceEnvironment().os;
    return detected === "macos" || detected === "linux" ? detected : "windows";
  });

  // Re-detect on mount / window resize
  useEffect(() => {
    const handleResize = () => {
      setEnvironment(detectDeviceEnvironment({ isElectron: isDesktop }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Check snooze expiry
  useEffect(() => {
    if (snoozedUntil && Date.now() > snoozedUntil) {
      setSnoozedUntil(null);
      try {
        window.localStorage.removeItem(DOWNLOAD_SNOOZE_KEY);
      } catch {
        // ignore
      }
    }
  }, [snoozedUntil]);

  const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;

  // Smart display rules:
  // 1. Suppress if native app (Electron) or PWA standalone mode
  // 2. Suppress if dismissed or snoozed
  // 3. For mobile web: show if mobile app available
  // 4. For desktop web: show if desktop app available
  const shouldShowPrompt = useMemo(() => {
    if (environment.isNativeApp || environment.isStandalone) {
      return false;
    }
    if (isDismissed || isSnoozed) {
      return false;
    }
    if (environment.isMobile) {
      const opt = getDownloadOptionForOS(environment.os, config);
      return opt !== null && Boolean(opt.url);
    }
    if (environment.isDesktopDevice || environment.isTablet) {
      const opt = getDownloadOptionForOS(selectedDesktopPlatform || environment.os, config);
      return opt !== null && Boolean(opt.url);
    }
    return false;
  }, [environment, isDismissed, isSnoozed, selectedDesktopPlatform, config]);

  const primaryOption = useMemo(() => {
    if (environment.isMobile) {
      return getDownloadOptionForOS(environment.os, config);
    }
    return getDownloadOptionForOS(selectedDesktopPlatform || environment.os, config);
  }, [environment, selectedDesktopPlatform, config]);

  const desktopOptions = useMemo(() => {
    return getAllDesktopDownloadOptions(selectedDesktopPlatform || environment.os, config);
  }, [selectedDesktopPlatform, environment.os, config]);

  const mobileOptions = useMemo(() => {
    return getAllMobileDownloadOptions(environment.os, config);
  }, [environment.os, config]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DOWNLOAD_DISMISSED_KEY, "true");
      } catch {
        // ignore
      }
    }
  }, []);

  const snooze = useCallback((hours: number) => {
    const until = Date.now() + hours * 60 * 60 * 1000;
    setSnoozedUntil(until);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DOWNLOAD_SNOOZE_KEY, until.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  const resetState = useCallback(() => {
    setIsDismissed(false);
    setSnoozedUntil(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DOWNLOAD_DISMISSED_KEY);
        window.localStorage.removeItem(DOWNLOAD_SNOOZE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const selectDesktopPlatform = useCallback((os: OperatingSystem) => {
    setSelectedDesktopPlatformState(os);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DOWNLOAD_SELECTED_OS_KEY, os);
      } catch {
        // ignore
      }
    }
  }, []);

  const trackDownload = useCallback((option: DownloadOption, source = "prompt") => {
    // Optional telemetry hook / console debug
    try {
      const eventName = option.isMobile ? "mobile_app_download_clicked" : "desktop_app_download_clicked";
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("onetab:analytics:track", {
            detail: {
              event: eventName,
              properties: {
                platform: option.platform,
                os: option.os,
                source,
                url: option.url,
              },
            },
          }),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    environment,
    shouldShowPrompt,
    isDismissed,
    isSnoozed,
    primaryOption,
    desktopOptions,
    mobileOptions,
    selectedDesktopPlatform,
    dismiss,
    snooze,
    resetState,
    selectDesktopPlatform,
    trackDownload,
  };
}

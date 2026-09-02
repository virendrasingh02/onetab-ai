/// <reference lib="dom" />
/**
 * @file device-environment.ts
 * Safe, comprehensive device, operating system, and runtime environment detector.
 *
 * Designed to be SSR-safe, defensive, and browser-capability aware rather than
 * relying exclusively on naive user-agent substring parsing.
 *
 * The `/// <reference lib="dom" />` above makes the file self-contained: it can
 * be type-checked by a Node-only consumer (`@org/common`, `@org/api-*`) without
 * that project adding `dom` to its own `lib`. Every `window`/`navigator` access
 * is still guarded with `typeof … !== "undefined"` for real SSR/Node runtime
 * safety.
 */

export type DeviceType = "mobile" | "tablet" | "desktop";
export type OperatingSystem = "ios" | "android" | "windows" | "macos" | "linux" | "unknown";
export type BrowserName = "chrome" | "safari" | "firefox" | "edge" | "opera" | "brave" | "unknown";
export type AppEnvironment = "electron" | "pwa" | "browser";

export interface DeviceEnvironment {
  deviceType: DeviceType;
  os: OperatingSystem;
  browser: BrowserName;
  environment: AppEnvironment;
  isMobile: boolean;
  isTablet: boolean;
  isDesktopDevice: boolean;
  isStandalone: boolean;
  isNativeApp: boolean;
  isTouchDevice: boolean;
  supportsDeepLinks: boolean;
}

export interface DetectionInput {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  isElectron?: boolean;
  screenWidth?: number;
  brands?: Array<{ brand: string; version: string }>;
  platformHeader?: string;
}

export function isNativeApplication(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as { onetabDesktop?: unknown; process?: { type?: string } };
  return Boolean(win.onetabDesktop || (win.process && win.process.type === "renderer"));
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = typeof navigator !== "undefined" ? (navigator as unknown as { standalone?: boolean }) : undefined;
  if (nav?.standalone === true) return true;
  if (typeof window.matchMedia === "function") {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    );
  }
  return false;
}

export function isTouchCapable(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.maxTouchPoints === "number") {
    return navigator.maxTouchPoints > 0;
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(pointer: coarse)").matches;
  }
  return false;
}

export function detectOperatingSystem(input?: DetectionInput): OperatingSystem {
  const uadPlatform =
    input?.platformHeader ??
    (typeof navigator !== "undefined" && "userAgentData" in navigator
      ? (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform
      : undefined);

  if (uadPlatform) {
    const p = uadPlatform.toLowerCase();
    if (p.includes("win")) return "windows";
    if (p.includes("mac")) return "macos";
    if (p.includes("android")) return "android";
    if (p.includes("ios")) return "ios";
    if (p.includes("linux") && !p.includes("android")) return "linux";
  }

  const ua =
    (input?.userAgent ??
      (typeof navigator !== "undefined" ? navigator.userAgent : "")) ||
    "";
  const platform =
    (input?.platform ??
      (typeof navigator !== "undefined" ? navigator.platform : "")) ||
    "";
  const maxTouchPoints =
    input?.maxTouchPoints ??
    (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0) ??
    0;

  const uaLower = ua.toLowerCase();
  const platformLower = platform.toLowerCase();

  const isIPadOS =
    (platformLower.includes("mac") || uaLower.includes("macintosh")) &&
    maxTouchPoints > 1 &&
    !uaLower.includes("iphone");

  if (isIPadOS || /iphone|ipad|ipod/.test(uaLower) || /iphone|ipad|ipod/.test(platformLower)) {
    return "ios";
  }

  if (/android/.test(uaLower) || /android/.test(platformLower)) {
    return "android";
  }

  if (/win/.test(uaLower) || /win/.test(platformLower)) {
    return "windows";
  }

  if (/macintosh|mac os x/.test(uaLower) || /mac/.test(platformLower)) {
    return "macos";
  }

  if (/linux/.test(uaLower) || /linux/.test(platformLower)) {
    return "linux";
  }

  return "unknown";
}

export function detectDeviceType(input?: DetectionInput, os?: OperatingSystem): DeviceType {
  const resolvedOS = os ?? detectOperatingSystem(input);
  const ua =
    (input?.userAgent ??
      (typeof navigator !== "undefined" ? navigator.userAgent : "")) ||
    "";
  const uaLower = ua.toLowerCase();
  const maxTouchPoints =
    input?.maxTouchPoints ??
    (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0) ??
    0;
  const screenWidth =
    input?.screenWidth ??
    (typeof window !== "undefined" ? window.innerWidth : undefined);

  const isIPad =
    /ipad/.test(uaLower) ||
    ((resolvedOS === "macos" || resolvedOS === "ios") && maxTouchPoints > 1 && !/iphone/.test(uaLower));

  const isAndroidTablet =
    resolvedOS === "android" &&
    (!/mobile/.test(uaLower) || (screenWidth !== undefined && screenWidth >= 768));

  const isGenericTablet = /tablet|playbook|silk/.test(uaLower);

  if (isIPad || isAndroidTablet || isGenericTablet) {
    return "tablet";
  }

  if (
    resolvedOS === "ios" ||
    resolvedOS === "android" ||
    /mobile|iphone|ipod|blackberry|iemobile|opera mini/.test(uaLower)
  ) {
    return "mobile";
  }

  if (screenWidth !== undefined && screenWidth <= 640 && isTouchCapable()) {
    return "mobile";
  }

  return "desktop";
}

export function detectBrowser(input?: DetectionInput): BrowserName {
  const ua =
    (input?.userAgent ??
      (typeof navigator !== "undefined" ? navigator.userAgent : "")) ||
    "";
  const uaLower = ua.toLowerCase();

  if (/edg\//.test(uaLower)) return "edge";
  if (/opr\/|opera/.test(uaLower)) return "opera";
  if (/firefox|fxios/.test(uaLower)) return "firefox";
  if (/brave/.test(uaLower)) return "brave";
  if (/chrome|crios/.test(uaLower) && !/edg\//.test(uaLower) && !/opr\//.test(uaLower)) return "chrome";
  if (/safari/.test(uaLower) && !/chrome|crios/.test(uaLower)) return "safari";

  return "unknown";
}

export function detectDeviceEnvironment(input?: DetectionInput): DeviceEnvironment {
  const isNative = input?.isElectron ?? isNativeApplication();
  const isPwa = input?.standalone ?? isStandalonePwa();
  const isTouch = input?.maxTouchPoints !== undefined ? input.maxTouchPoints > 0 : isTouchCapable();

  const environment: AppEnvironment = isNative ? "electron" : isPwa ? "pwa" : "browser";
  const os = detectOperatingSystem(input);
  const deviceType = detectDeviceType(input, os);
  const browser = detectBrowser(input);

  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";
  const isDesktopDevice = deviceType === "desktop";

  const supportsDeepLinks = isNative || os === "ios" || os === "android" || os === "windows" || os === "macos";

  return {
    deviceType,
    os,
    browser,
    environment,
    isMobile,
    isTablet,
    isDesktopDevice,
    isStandalone: isPwa,
    isNativeApp: isNative,
    isTouchDevice: isTouch,
    supportsDeepLinks,
  };
}

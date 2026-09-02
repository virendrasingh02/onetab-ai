import { describe, it, expect } from "vitest";
import {
  detectBrowser,
  detectDeviceEnvironment,
  detectDeviceType,
  detectOperatingSystem,
} from "./device-environment.js";

describe("device-environment", () => {
  describe("detectOperatingSystem", () => {
    it("detects iOS from iPhone user agent", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
      expect(detectOperatingSystem({ userAgent: ua, platform: "iPhone" })).toBe("ios");
    });

    it("detects iOS from iPadOS (modern iPad reporting MacIntel with multi-touch)", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15";
      expect(
        detectOperatingSystem({ userAgent: ua, platform: "MacIntel", maxTouchPoints: 5 }),
      ).toBe("ios");
    });

    it("detects Android from user agent", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 13; SM-S909B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
      expect(detectOperatingSystem({ userAgent: ua, platform: "Linux armv8l" })).toBe("android");
    });

    it("detects Windows from user agent", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
      expect(detectOperatingSystem({ userAgent: ua, platform: "Win32" })).toBe("windows");
    });

    it("detects macOS from desktop Mac user agent", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
      expect(detectOperatingSystem({ userAgent: ua, platform: "MacIntel", maxTouchPoints: 0 })).toBe("macos");
    });

    it("detects Linux from desktop Linux user agent", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
      expect(detectOperatingSystem({ userAgent: ua, platform: "Linux x86_64" })).toBe("linux");
    });

    it("respects Client Hints platform Header when available", () => {
      expect(detectOperatingSystem({ platformHeader: "Windows" })).toBe("windows");
      expect(detectOperatingSystem({ platformHeader: "macOS" })).toBe("macos");
      expect(detectOperatingSystem({ platformHeader: "Android" })).toBe("android");
      expect(detectOperatingSystem({ platformHeader: "iOS" })).toBe("ios");
    });
  });

  describe("detectDeviceType", () => {
    it("detects iPhone as mobile", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5) AppleWebKit/605";
      expect(detectDeviceType({ userAgent: ua })).toBe("mobile");
    });

    it("detects Android phone as mobile", () => {
      const ua = "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537";
      expect(detectDeviceType({ userAgent: ua })).toBe("mobile");
    });

    it("detects iPad as tablet", () => {
      const ua = "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605";
      expect(detectDeviceType({ userAgent: ua })).toBe("tablet");
    });

    it("detects desktop windows as desktop", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537";
      expect(detectDeviceType({ userAgent: ua, maxTouchPoints: 0 })).toBe("desktop");
    });
  });

  describe("detectBrowser", () => {
    it("detects Chrome, Safari, Firefox, Edge", () => {
      expect(detectBrowser({ userAgent: "Chrome/114.0.0.0 Safari/537.36" })).toBe("chrome");
      expect(detectBrowser({ userAgent: "Version/16.5 Safari/605.1.15" })).toBe("safari");
      expect(detectBrowser({ userAgent: "Firefox/114.0" })).toBe("firefox");
      expect(detectBrowser({ userAgent: "Edg/114.0.1823.43" })).toBe("edge");
    });
  });

  describe("detectDeviceEnvironment", () => {
    it("assembles complete device environment for mobile iOS", () => {
      const env = detectDeviceEnvironment({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5) AppleWebKit/605",
        maxTouchPoints: 5,
      });
      expect(env.os).toBe("ios");
      expect(env.isMobile).toBe(true);
      expect(env.isDesktopDevice).toBe(false);
      expect(env.environment).toBe("browser");
      expect(env.supportsDeepLinks).toBe(true);
    });

    it("assembles complete device environment for desktop Windows", () => {
      const env = detectDeviceEnvironment({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537",
        maxTouchPoints: 0,
      });
      expect(env.os).toBe("windows");
      expect(env.isMobile).toBe(false);
      expect(env.isDesktopDevice).toBe(true);
      expect(env.environment).toBe("browser");
    });

    it("detects Electron environment correctly", () => {
      const env = detectDeviceEnvironment({
        isElectron: true,
        platformHeader: "Windows",
      });
      expect(env.isNativeApp).toBe(true);
      expect(env.environment).toBe("electron");
    });

    it("detects PWA standalone environment correctly", () => {
      const env = detectDeviceEnvironment({
        standalone: true,
        platformHeader: "Android",
      });
      expect(env.isStandalone).toBe(true);
      expect(env.environment).toBe("pwa");
    });
  });
});

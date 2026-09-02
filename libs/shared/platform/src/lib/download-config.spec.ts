import { describe, it, expect } from "vitest";
import {
  buildAppDeepLink,
  getAllDesktopDownloadOptions,
  getAllMobileDownloadOptions,
  getDownloadOptionForOS,
  isDownloadAvailableForOS,
} from "./download-config.js";

describe("download-config", () => {
  describe("getDownloadOptionForOS", () => {
    it("returns Apple App Store download destination for iOS", () => {
      const option = getDownloadOptionForOS("ios");
      expect(option).not.toBeNull();
      expect(option?.platform).toBe("ios");
      expect(option?.isMobile).toBe(true);
      expect(option?.url).toContain("apps.apple.com");
    });

    it("returns Google Play Store download destination for Android", () => {
      const option = getDownloadOptionForOS("android");
      expect(option).not.toBeNull();
      expect(option?.platform).toBe("android");
      expect(option?.isMobile).toBe(true);
      expect(option?.url).toContain("play.google.com");
    });

    it("returns Windows installer destination for Windows", () => {
      const option = getDownloadOptionForOS("windows");
      expect(option).not.toBeNull();
      expect(option?.platform).toBe("windows");
      expect(option?.isMobile).toBe(false);
      expect(option?.url).toContain(".exe");
    });

    it("returns macOS installer destination for macOS", () => {
      const option = getDownloadOptionForOS("macos");
      expect(option).not.toBeNull();
      expect(option?.platform).toBe("macos");
      expect(option?.isMobile).toBe(false);
      expect(option?.url).toContain(".dmg");
    });

    it("returns Linux installer destination for Linux", () => {
      const option = getDownloadOptionForOS("linux");
      expect(option).not.toBeNull();
      expect(option?.platform).toBe("linux");
      expect(option?.isMobile).toBe(false);
      expect(option?.url).toContain(".AppImage");
    });

    it("returns null for unknown OS", () => {
      expect(getDownloadOptionForOS("unknown")).toBeNull();
    });
  });

  describe("getAllDesktopDownloadOptions", () => {
    it("flags user OS as primary", () => {
      const options = getAllDesktopDownloadOptions("windows");
      expect(options.length).toBe(3);
      const winOpt = options.find((o) => o.os === "windows");
      const macOpt = options.find((o) => o.os === "macos");
      expect(winOpt?.isPrimaryForUser).toBe(true);
      expect(macOpt?.isPrimaryForUser).toBe(false);
    });
  });

  describe("getAllMobileDownloadOptions", () => {
    it("returns App Store and Play Store", () => {
      const options = getAllMobileDownloadOptions("ios");
      expect(options.length).toBe(2);
      const ios = options.find((o) => o.os === "ios");
      expect(ios?.isPrimaryForUser).toBe(true);
    });
  });

  describe("buildAppDeepLink", () => {
    it("creates protocol deep link with route and params", () => {
      const link = buildAppDeepLink("w/workspace-1/c/general", { token: "abc123" });
      expect(link).toBe("mie://w/workspace-1/c/general?token=abc123");
    });
  });

  describe("isDownloadAvailableForOS", () => {
    it("returns true for supported OSes", () => {
      expect(isDownloadAvailableForOS("windows")).toBe(true);
      expect(isDownloadAvailableForOS("macos")).toBe(true);
      expect(isDownloadAvailableForOS("linux")).toBe(true);
      expect(isDownloadAvailableForOS("ios")).toBe(true);
      expect(isDownloadAvailableForOS("android")).toBe(true);
      expect(isDownloadAvailableForOS("unknown")).toBe(false);
    });
  });
});

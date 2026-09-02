import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppDownload, DOWNLOAD_DISMISSED_KEY, DOWNLOAD_SNOOZE_KEY } from "./use-app-download.js";

describe("useAppDownload hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default options and detects environment", () => {
    const { result } = renderHook(() => useAppDownload());
    expect(result.current.environment).toBeDefined();
    expect(result.current.isDismissed).toBe(false);
    expect(result.current.isSnoozed).toBe(false);
    expect(result.current.desktopOptions.length).toBeGreaterThan(0);
    expect(result.current.mobileOptions.length).toBeGreaterThan(0);
  });

  it("handles dismiss action and persists to localStorage", () => {
    const { result } = renderHook(() => useAppDownload());
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isDismissed).toBe(true);
    expect(localStorage.getItem(DOWNLOAD_DISMISSED_KEY)).toBe("true");
    expect(result.current.shouldShowPrompt).toBe(false);
  });

  it("handles snooze action and calculates snooze duration", () => {
    const { result } = renderHook(() => useAppDownload());
    act(() => {
      result.current.snooze(24);
    });
    expect(result.current.isSnoozed).toBe(true);
    expect(localStorage.getItem(DOWNLOAD_SNOOZE_KEY)).toBeDefined();
    expect(result.current.shouldShowPrompt).toBe(false);
  });

  it("handles resetState correctly", () => {
    const { result } = renderHook(() => useAppDownload());
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isDismissed).toBe(true);

    act(() => {
      result.current.resetState();
    });
    expect(result.current.isDismissed).toBe(false);
    expect(localStorage.getItem(DOWNLOAD_DISMISSED_KEY)).toBeNull();
  });

  it("allows switching desktop platform", () => {
    const { result } = renderHook(() => useAppDownload());
    act(() => {
      result.current.selectDesktopPlatform("macos");
    });
    expect(result.current.selectedDesktopPlatform).toBe("macos");
  });
});

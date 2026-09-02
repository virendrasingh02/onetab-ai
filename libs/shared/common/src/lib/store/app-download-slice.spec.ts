import { describe, it, expect } from "vitest";
import reducer, {
  dismissDownloadPrompt,
  resetDownloadPrompt,
  setSelectedDesktopPlatform,
  snoozeDownloadPrompt,
  trackDownloadClick,
  type AppDownloadState,
} from "./app-download-slice.js";

describe("app-download-slice", () => {
  const initial: AppDownloadState = {
    promptDismissed: false,
    snoozedUntil: null,
    lastPromptedAt: null,
    downloadClicks: {},
    selectedDesktopPlatform: null,
  };

  it("handles dismissDownloadPrompt", () => {
    const next = reducer(initial, dismissDownloadPrompt());
    expect(next.promptDismissed).toBe(true);
  });

  it("handles snoozeDownloadPrompt", () => {
    const before = Date.now();
    const next = reducer(initial, snoozeDownloadPrompt(24));
    expect(next.snoozedUntil).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);
  });

  it("handles resetDownloadPrompt", () => {
    const dismissedState: AppDownloadState = {
      ...initial,
      promptDismissed: true,
      snoozedUntil: Date.now() + 100000,
    };
    const next = reducer(dismissedState, resetDownloadPrompt());
    expect(next.promptDismissed).toBe(false);
    expect(next.snoozedUntil).toBeNull();
  });

  it("handles trackDownloadClick", () => {
    let next = reducer(initial, trackDownloadClick("windows"));
    expect(next.downloadClicks["windows"]).toBe(1);
    next = reducer(next, trackDownloadClick("windows"));
    expect(next.downloadClicks["windows"]).toBe(2);
  });

  it("handles setSelectedDesktopPlatform", () => {
    const next = reducer(initial, setSelectedDesktopPlatform("macos"));
    expect(next.selectedDesktopPlatform).toBe("macos");
  });
});

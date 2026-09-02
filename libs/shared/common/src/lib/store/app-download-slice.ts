import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { OperatingSystem } from "@org/platform";

export const DOWNLOAD_DISMISSED_STORAGE_KEY = "onetab:download-prompt:dismissed";
export const DOWNLOAD_SNOOZE_STORAGE_KEY = "onetab:download-prompt:snooze-until";
export const DOWNLOAD_SELECTED_OS_STORAGE_KEY = "onetab:download-prompt:selected-os";

export interface AppDownloadState {
  promptDismissed: boolean;
  snoozedUntil: number | null;
  lastPromptedAt: number | null;
  downloadClicks: Record<string, number>;
  selectedDesktopPlatform: OperatingSystem | null;
}

export function loadInitialDownloadState(): AppDownloadState {
  if (typeof window === "undefined") {
    return {
      promptDismissed: false,
      snoozedUntil: null,
      lastPromptedAt: null,
      downloadClicks: {},
      selectedDesktopPlatform: null,
    };
  }

  let promptDismissed = false;
  let snoozedUntil: number | null = null;
  let selectedDesktopPlatform: OperatingSystem | null = null;

  try {
    promptDismissed = window.localStorage.getItem(DOWNLOAD_DISMISSED_STORAGE_KEY) === "true";
  } catch {
    // ignore
  }

  try {
    const rawSnooze = window.localStorage.getItem(DOWNLOAD_SNOOZE_STORAGE_KEY);
    if (rawSnooze) {
      const parsed = parseInt(rawSnooze, 10);
      if (!isNaN(parsed) && parsed > Date.now()) {
        snoozedUntil = parsed;
      } else {
        window.localStorage.removeItem(DOWNLOAD_SNOOZE_STORAGE_KEY);
      }
    }
  } catch {
    // ignore
  }

  try {
    const rawOS = window.localStorage.getItem(DOWNLOAD_SELECTED_OS_STORAGE_KEY) as OperatingSystem | null;
    if (rawOS && ["windows", "macos", "linux"].includes(rawOS)) {
      selectedDesktopPlatform = rawOS;
    }
  } catch {
    // ignore
  }

  return {
    promptDismissed,
    snoozedUntil,
    lastPromptedAt: null,
    downloadClicks: {},
    selectedDesktopPlatform,
  };
}

const initialState: AppDownloadState = loadInitialDownloadState();

export const appDownloadSlice = createSlice({
  name: "appDownload",
  initialState,
  reducers: {
    dismissDownloadPrompt(state) {
      state.promptDismissed = true;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DOWNLOAD_DISMISSED_STORAGE_KEY, "true");
        } catch {
          // ignore
        }
      }
    },
    snoozeDownloadPrompt(state, action: PayloadAction<number /* hours */>) {
      const hours = action.payload;
      const until = Date.now() + hours * 60 * 60 * 1000;
      state.snoozedUntil = until;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DOWNLOAD_SNOOZE_STORAGE_KEY, until.toString());
        } catch {
          // ignore
        }
      }
    },
    resetDownloadPrompt(state) {
      state.promptDismissed = false;
      state.snoozedUntil = null;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(DOWNLOAD_DISMISSED_STORAGE_KEY);
          window.localStorage.removeItem(DOWNLOAD_SNOOZE_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    },
    trackDownloadClick(state, action: PayloadAction<string>) {
      const platform = action.payload;
      state.downloadClicks[platform] = (state.downloadClicks[platform] ?? 0) + 1;
    },
    setSelectedDesktopPlatform(state, action: PayloadAction<OperatingSystem | null>) {
      state.selectedDesktopPlatform = action.payload;
      if (typeof window !== "undefined") {
        try {
          if (action.payload) {
            window.localStorage.setItem(DOWNLOAD_SELECTED_OS_STORAGE_KEY, action.payload);
          } else {
            window.localStorage.removeItem(DOWNLOAD_SELECTED_OS_STORAGE_KEY);
          }
        } catch {
          // ignore
        }
      }
    },
  },
});

export const {
  dismissDownloadPrompt,
  snoozeDownloadPrompt,
  resetDownloadPrompt,
  trackDownloadClick,
  setSelectedDesktopPlatform,
} = appDownloadSlice.actions;

// Selectors
export const selectAppDownloadState = (state: { appDownload: AppDownloadState }) => state.appDownload;
export const selectIsDownloadPromptDismissed = (state: { appDownload: AppDownloadState }) =>
  state.appDownload.promptDismissed;
export const selectDownloadSnoozedUntil = (state: { appDownload: AppDownloadState }) =>
  state.appDownload.snoozedUntil;
export const selectSelectedDesktopPlatform = (state: { appDownload: AppDownloadState }) =>
  state.appDownload.selectedDesktopPlatform;

export default appDownloadSlice.reducer;

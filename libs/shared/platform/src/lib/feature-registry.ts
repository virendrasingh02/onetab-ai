import type { FeatureDefinition } from './types.js';

/**
 * The single source of truth for what every feature needs and how it
 * degrades. This replaces the old `FEATURE_MATRIX` in `@org/web-desktop`
 * (a static platform/web boolean table nothing actually read for gating) —
 * every entry below is carried over from it, refined with the state machine
 * `evaluateFeature` needs, plus two entries (`safeStorage`, `nativeFileSystem`)
 * that were already true of the app but never declared anywhere.
 *
 * Store-specific restrictions are deliberately absent from this file — those
 * live in `./policies/*` and are applied by `evaluateFeature`, not declared
 * per feature, so adding a store later never means editing this list.
 */
export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  browserAuth: {
    id: 'browserAuth',
    name: 'Browser-based sign-in (PKCE)',
    description:
      'Signs in through the system/default browser with PKCE code exchange instead of an embedded credential form.',
    platforms: ['windows', 'macos', 'linux', 'web'],
    requiredCapabilities: ['authentication'],
    uiRelevance: 'informational',
  },

  deepLinks: {
    id: 'deepLinks',
    name: 'Custom protocol deep links (onetab:// / mie://)',
    description:
      'Launches the app and opens a route directly from an external link, email, or notification click.',
    platforms: ['windows', 'macos', 'linux'],
    requiredCapabilities: ['deepLinks'],
    degrade: 'web_only',
    fallback: { type: 'web', url: '/', label: 'Open in browser' },
    uiRelevance: 'user-facing',
  },

  nativeNotifications: {
    id: 'nativeNotifications',
    name: 'OS desktop notifications',
    description:
      'System toast notifications that focus the app and route to the relevant screen on click.',
    platforms: ['windows', 'macos', 'linux', 'web'],
    permissionCapabilities: ['notifications'],
    degrade: 'disabled',
    uiRelevance: 'user-facing',
  },

  appUpdates: {
    id: 'appUpdates',
    name: 'Automatic app updates',
    description: 'Checks for, downloads, and installs new versions in the background.',
    platforms: ['windows', 'macos', 'linux'],
    requiredCapabilities: ['appUpdates'],
    degrade: 'disabled',
    storeRestrictedReason: 'Updates are managed by the store this build was installed from.',
    uiRelevance: 'user-facing',
  },

  autoLaunch: {
    id: 'autoLaunch',
    name: 'Launch at login',
    description: 'Starts the app in the background when the user logs into their OS.',
    platforms: ['windows', 'macos'],
    requiredCapabilities: ['autoLaunch'],
    degrade: 'disabled',
    uiRelevance: 'user-facing',
  },

  safeStorage: {
    id: 'safeStorage',
    name: 'Encrypted credential storage',
    description:
      'OS-level encrypted session persistence (DPAPI / Keychain / libsecret) rather than plain text on disk.',
    platforms: ['windows', 'macos', 'linux'],
    uiRelevance: 'informational',
  },

  nativeFileSystem: {
    id: 'nativeFileSystem',
    name: 'Native file dialogs',
    description: 'OS "Open"/"Save As" dialogs instead of an HTML file input and anchor download.',
    platforms: ['windows', 'macos', 'linux', 'web'],
    uiRelevance: 'informational',
  },

  windowControls: {
    id: 'windowControls',
    name: 'Frameless window & custom title bar',
    description: 'A custom-drawn title bar with minimize/maximize/close, synced to the OS theme.',
    platforms: ['windows', 'macos', 'linux'],
    requiredCapabilities: ['windowControls'],
    degrade: 'hidden',
    uiRelevance: 'user-facing',
  },

  singleInstance: {
    id: 'singleInstance',
    name: 'Single instance enforcement',
    description:
      'A second launch, or a clicked deep link, focuses the already-running window instead of opening a duplicate.',
    platforms: ['windows', 'macos', 'linux'],
    uiRelevance: 'informational',
  },
};

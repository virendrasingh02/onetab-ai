import type { DistributionPolicy } from '../types.js';

/** macOS, submitted to and updated through the Mac App Store. */
export const appleAppStorePolicy: DistributionPolicy = {
  distribution: 'mac-app-store',
  label: 'Mac App Store',
  restrictedFeatureIds: ['appUpdates', 'autoLaunch'],
  forbiddenCapabilities: ['appUpdates'],
  notes:
    'App Review requires the App Sandbox and forbids a bundled self-updater ' +
    '(Guideline 2.4.5) — updates must go through the Store, hence appUpdates ' +
    'is restricted rather than merely disabled. autoLaunch is restricted here ' +
    'defensively rather than allowed: this build\'s entitlements ' +
    '(apps/desktop/resources/entitlements.mac.plist) do not yet declare ' +
    'com.apple.security.app-sandbox, so the app is not actually sandboxed and ' +
    'is not eligible for submission at all until that work is done — see ' +
    'DESKTOP_STORE_COMPLIANCE_AUDIT.md before treating this policy as load-bearing.',
};

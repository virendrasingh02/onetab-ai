import type { DistributionPolicy } from '../types.js';

/** Windows, packaged and updated through the Microsoft Store (MSIX). */
export const microsoftStorePolicy: DistributionPolicy = {
  distribution: 'microsoft-store',
  label: 'Microsoft Store',
  restrictedFeatureIds: ['appUpdates'],
  forbiddenCapabilities: ['appUpdates'],
  notes:
    'MSIX packages are serviced by the Store; a bundled self-updater is ' +
    'redundant and against Store policy, hence appUpdates is restricted. ' +
    'No electron-builder "appx" target exists yet — this policy is ready for ' +
    'when one does; see DESKTOP_STORE_COMPLIANCE_AUDIT.md.',
};

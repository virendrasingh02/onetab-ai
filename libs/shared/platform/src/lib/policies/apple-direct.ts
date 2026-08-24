import type { DistributionPolicy } from '../types.js';

/** macOS, distributed outside the Mac App Store (notarized DMG/ZIP). */
export const appleDirectPolicy: DistributionPolicy = {
  distribution: 'direct',
  label: 'macOS (Direct Download)',
  restrictedFeatureIds: [],
  forbiddenCapabilities: [],
  notes:
    'No App Sandbox is required for a notarized direct build, so this ' +
    'distribution offers the full native feature set this app implements — ' +
    'nothing is restricted here today.',
};

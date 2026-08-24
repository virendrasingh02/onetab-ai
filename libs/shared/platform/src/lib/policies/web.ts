import type { DistributionPolicy } from '../types.js';

/** The plain browser build. Also the fail-safe default `resolvePolicy` falls back to. */
export const webPolicy: DistributionPolicy = {
  distribution: 'web',
  label: 'Web',
  restrictedFeatureIds: [],
  forbiddenCapabilities: [],
  notes:
    'Runs in the browser origin with no store review. Desktop-only features ' +
    'are already excluded by their own `platforms` list rather than by a ' +
    'restriction here.',
};

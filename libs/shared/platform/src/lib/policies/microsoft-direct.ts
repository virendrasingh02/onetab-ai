import type { DistributionPolicy } from '../types.js';

/** Windows, distributed as a direct NSIS installer. */
export const microsoftDirectPolicy: DistributionPolicy = {
  distribution: 'direct',
  label: 'Windows (Direct Download)',
  restrictedFeatureIds: [],
  forbiddenCapabilities: [],
  notes:
    'The NSIS installer runs unsandboxed, so this distribution offers the ' +
    'full native feature set this app implements.',
};

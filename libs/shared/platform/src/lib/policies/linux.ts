import type { DistributionPolicy } from '../types.js';

/** Linux, distributed as AppImage/deb. No Linux store is targeted today. */
export const linuxPolicy: DistributionPolicy = {
  distribution: 'direct',
  label: 'Linux',
  restrictedFeatureIds: [],
  forbiddenCapabilities: [],
  notes:
    'Nothing is store-restricted here — Linux has no store review to answer ' +
    'to. autoLaunch never reaches this policy at all: its `platforms` list ' +
    '(feature-registry.ts) omits linux entirely, matching the main process, ' +
    'which only calls app.setLoginItemSettings for win32/darwin ' +
    '(apps/desktop/src/main/capabilities.ts) — there is no XDG autostart ' +
    'entry writer yet, so it evaluates to OS_UNSUPPORTED rather than any ' +
    'policy restriction.',
};

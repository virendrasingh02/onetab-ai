/**
 * @org/platform — the capability/feature/policy engine.
 *
 * Framework- and runtime-agnostic on purpose: it never imports Electron,
 * `window`, or React. `@org/web-desktop` is what feeds it a live
 * `PlatformSnapshot` (from the Electron bridge, or the browser defaults) and
 * exposes the React hooks — see `useFeature`/`usePlatform`/`useDistribution`/
 * `useCapability` there.
 */

export { FEATURE_REGISTRY } from './lib/feature-registry.js';
export { evaluate, evaluateAll, evaluateFeature } from './lib/feature-manager.js';
export { resolvePolicy } from './lib/policies/index.js';
export {
  appleAppStorePolicy,
  appleDirectPolicy,
  linuxPolicy,
  microsoftDirectPolicy,
  microsoftStorePolicy,
  webPolicy,
} from './lib/policies/index.js';

export type {
  CapabilityKey,
  DegradeStrategy,
  Distribution,
  DistributionPolicy,
  FeatureDefinition,
  FeatureEvaluation,
  FeatureFallback,
  FeatureState,
  PlanTier,
  PlatformOS,
  PlatformSnapshot,
  Runtime,
} from './lib/types.js';

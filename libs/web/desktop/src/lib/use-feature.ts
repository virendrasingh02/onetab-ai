import {
  evaluate,
  evaluateAll,
  type CapabilityKey,
  type Distribution,
  type FeatureEvaluation,
  type PlatformOS,
  type PlatformSnapshot,
} from '@org/platform';
import { useMemo } from 'react';
import { desktop, useCapabilities } from './capabilities.js';
import { toPlatformSnapshot } from './platform-snapshot.js';

/**
 * The live `PlatformSnapshot` — platform, runtime, distribution and
 * capabilities — recomputed whenever the underlying desktop capabilities
 * change (e.g. the bridge's async `capabilities.get()` resolves after mount).
 */
export function usePlatformSnapshot(): PlatformSnapshot {
  const capabilities = useCapabilities();
  return useMemo(() => toPlatformSnapshot(capabilities), [capabilities]);
}

/** Evaluates one feature from `@org/platform`'s `FEATURE_REGISTRY` against the live snapshot. */
export function useFeature(id: string): FeatureEvaluation {
  const snapshot = usePlatformSnapshot();
  return useMemo(() => evaluate(id, snapshot), [id, snapshot]);
}

/** Every registered feature evaluated against the live snapshot — what the diagnostics screen renders. */
export function useAllFeatures(): FeatureEvaluation[] {
  const snapshot = usePlatformSnapshot();
  return useMemo(() => evaluateAll(snapshot), [snapshot]);
}

export function usePlatform(): PlatformOS {
  return usePlatformSnapshot().platform;
}

export function useDistribution(): Distribution {
  return usePlatformSnapshot().distribution;
}

export function useCapability(key: CapabilityKey): boolean {
  return usePlatformSnapshot().capabilities[key] ?? false;
}

/**
 * The non-hook entry point for code outside the component tree (menu
 * handlers, route loaders). Reads whatever `desktop.capabilities.get()` last
 * cached — kept live for the app's whole lifetime because `DesktopProvider`
 * mounts `useCapabilities()` at the root — rather than a hook's own state, so
 * this never needs a `PlatformSnapshot` passed in by the caller.
 */
export const featureManager = {
  evaluate: (id: string): FeatureEvaluation => evaluate(id, toPlatformSnapshot(desktop.capabilities.get())),
  evaluateAll: (): FeatureEvaluation[] => evaluateAll(toPlatformSnapshot(desktop.capabilities.get())),
};

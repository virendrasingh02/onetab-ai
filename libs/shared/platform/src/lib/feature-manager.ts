import { FEATURE_REGISTRY } from './feature-registry.js';
import { resolvePolicy } from './policies/index.js';
import type {
  DistributionPolicy,
  FeatureDefinition,
  FeatureEvaluation,
  FeatureState,
  PlatformOS,
  PlatformSnapshot,
} from './types.js';

const PLATFORM_LABELS: Record<PlatformOS, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  web: 'the web',
};

function platformLabel(platform: PlatformOS): string {
  return PLATFORM_LABELS[platform];
}

const DEGRADE_STATE: Record<NonNullable<FeatureDefinition['degrade']>, FeatureState> = {
  hidden: 'HIDDEN',
  disabled: 'DISABLED',
  web_only: 'WEB_ONLY',
  external: 'EXTERNAL',
};

/**
 * Decides one feature's state for one snapshot.
 *
 * Checks run in this order, and the first that applies wins — each is
 * strictly more specific than the ones after it:
 *
 * 1. `comingSoon` — declared but intentionally unshipped.
 * 2. OS mismatch — `snapshot.platform` isn't in `platforms` → `OS_UNSUPPORTED`.
 * 3. Store policy — the resolved `DistributionPolicy` restricts this feature
 *    id or one of its required capabilities outright → `STORE_RESTRICTED`.
 *    Checked before the plain capability check below because a policy
 *    restriction is a *legal/review* fact, not a *runtime support* fact, even
 *    when the underlying capability happens to be technically present.
 * 4. Permission capabilities missing → `REQUIRES_PERMISSION` (the fix is
 *    "grant the OS permission", not "use a fallback").
 * 5. Required capabilities missing → the feature's own `degrade` strategy
 *    (`DISABLED` by default).
 * 6. `requiredPlan` set and unsatisfied → `REQUIRES_PLAN`. Always satisfied
 *    today — see `PlanTier`'s doc comment.
 * 7. Otherwise → `AVAILABLE`.
 */
export function evaluateFeature(
  def: FeatureDefinition,
  snapshot: PlatformSnapshot,
  policy: DistributionPolicy = resolvePolicy(snapshot.platform, snapshot.distribution),
): FeatureEvaluation {
  const base = { id: def.id, platform: snapshot.platform, distribution: snapshot.distribution };
  const fallback = def.fallback ?? null;

  if (def.comingSoon) {
    return { ...base, state: 'COMING_SOON', available: false, reason: `${def.name} is coming soon.`, fallback };
  }

  if (!def.platforms.includes(snapshot.platform)) {
    return {
      ...base,
      state: 'OS_UNSUPPORTED',
      available: false,
      reason: `${def.name} is not available on ${platformLabel(snapshot.platform)}.`,
      fallback,
    };
  }

  const requiredCapabilities = def.requiredCapabilities ?? [];
  const storeRestricted =
    policy.restrictedFeatureIds.includes(def.id) ||
    requiredCapabilities.some((capability) => policy.forbiddenCapabilities.includes(capability));

  if (storeRestricted) {
    return {
      ...base,
      state: 'STORE_RESTRICTED',
      available: false,
      reason: def.storeRestrictedReason ?? `${def.name} isn't available in the ${policy.label} build.`,
      fallback,
    };
  }

  const missingPermission = (def.permissionCapabilities ?? []).some(
    (capability) => !snapshot.capabilities[capability],
  );
  if (missingPermission) {
    return {
      ...base,
      state: 'REQUIRES_PERMISSION',
      available: false,
      reason: `${def.name} needs a permission that hasn't been granted yet.`,
      fallback,
    };
  }

  const missingCapability = requiredCapabilities.some((capability) => !snapshot.capabilities[capability]);
  if (missingCapability) {
    return {
      ...base,
      state: DEGRADE_STATE[def.degrade ?? 'disabled'],
      available: false,
      reason: `${def.name} isn't supported in this build.`,
      fallback,
    };
  }

  if (def.requiredPlan && snapshot.planTier) {
    const HIERARCHY: Record<string, number> = {
      starter: 0,
      free: 0,
      pro: 1,
      business: 2,
      enterprise: 3,
    };
    const currentLevel = HIERARCHY[snapshot.planTier] ?? 0;
    const requiredLevel = HIERARCHY[def.requiredPlan] ?? 0;
    if (currentLevel < requiredLevel) {
      return {
        ...base,
        state: 'REQUIRES_PLAN',
        available: false,
        reason: `${def.name} requires the ${def.requiredPlan} plan.`,
        fallback,
      };
    }
  }

  return { ...base, state: 'AVAILABLE', available: true, reason: null, fallback };

}

/** Looks a feature up in `FEATURE_REGISTRY` and evaluates it. */
export function evaluate(id: string, snapshot: PlatformSnapshot): FeatureEvaluation {
  const def = FEATURE_REGISTRY[id];
  if (!def) {
    return {
      id,
      state: 'HIDDEN',
      available: false,
      reason: `Unknown feature id "${id}".`,
      fallback: null,
      platform: snapshot.platform,
      distribution: snapshot.distribution,
    };
  }
  return evaluateFeature(def, snapshot);
}

/** Evaluates every registered feature for one snapshot — what the diagnostics screen renders. */
export function evaluateAll(snapshot: PlatformSnapshot): FeatureEvaluation[] {
  return Object.keys(FEATURE_REGISTRY).map((id) => evaluate(id, snapshot));
}

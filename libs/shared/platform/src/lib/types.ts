/**
 * The vocabulary the whole capability/feature/policy layer is built from.
 *
 * Nothing here talks to Electron, a browser API, or a specific store — that
 * live wiring belongs to the runtime that owns it (`@org/web-desktop` today;
 * a future mobile shell later). This package only knows how to take a
 * `PlatformSnapshot` someone else assembled and decide what a feature's
 * state should be. See `docs/desktop-app.md` and
 * `DESKTOP_STORE_COMPLIANCE_AUDIT.md` for how the concrete values are derived.
 */

/** Normalized OS/target — not `process.platform`; see the runtime's own mapping. */
export type PlatformOS = 'windows' | 'macos' | 'linux' | 'web';

/** What the app is actually running inside of. `tauri` is reserved, unused today. */
export type Runtime = 'electron' | 'tauri' | 'browser';

/**
 * Where this build came from and who controls its updates/payments/review
 * rules. `direct` covers both a Windows .exe and a notarized macOS DMG/ZIP —
 * `resolvePolicy()` disambiguates those by pairing this with `PlatformOS`.
 */
export type Distribution = 'direct' | 'microsoft-store' | 'mac-app-store' | 'web';

/**
 * Account tier gating. No feature in `FEATURE_REGISTRY` sets `requiredPlan`
 * today — the product has no real billing/entitlements backend yet (billing
 * is a client-side `useState` simulation; see `PLATFORM_AUDIT_REPORT.md`
 * §4-B2). The type and the `REQUIRES_PLAN` state exist so a real plan check
 * can be dropped into `evaluateFeature` later without a schema change.
 */
export type PlanTier = 'starter' | 'free' | 'pro' | 'business' | 'enterprise';

/**
 * Boolean facts a runtime can report about itself. This mirrors
 * `DesktopCapabilities` in `@org/web-desktop` field-for-field on purpose —
 * that type stays the source of truth for what the Electron bridge actually
 * exposes; this one stays free of any Electron dependency so it can also
 * describe a plain browser or a future mobile shell.
 */
export type CapabilityKey =
  | 'authentication'
  | 'notifications'
  | 'deepLinks'
  | 'appUpdates'
  | 'autoLaunch'
  | 'filesystem'
  | 'clipboard'
  | 'screenshots'
  | 'windowControls';

/** Everything a feature evaluation needs to know about "here and now". */
export interface PlatformSnapshot {
  platform: PlatformOS;
  runtime: Runtime;
  distribution: Distribution;
  /** Present only when the host can report it (e.g. not from a browser). */
  architecture?: string;
  osVersion?: string;
  capabilities: Partial<Record<CapabilityKey, boolean>>;
  /** `null` until real billing exists — see `PlanTier`. */
  planTier?: PlanTier | null;
}

/**
 * The ten states a feature can be in. Cumulative in severity: an evaluation
 * returns the *first* one that applies, checked in the order documented on
 * `evaluateFeature`.
 */
export type FeatureState =
  | 'AVAILABLE'
  | 'DISABLED'
  | 'HIDDEN'
  | 'WEB_ONLY'
  | 'EXTERNAL'
  | 'REQUIRES_PERMISSION'
  | 'REQUIRES_PLAN'
  | 'STORE_RESTRICTED'
  | 'OS_UNSUPPORTED'
  | 'COMING_SOON';

/** What to do when a feature's capability requirement isn't met. */
export type DegradeStrategy = 'hidden' | 'disabled' | 'web_only' | 'external';

export interface FeatureFallback {
  type: 'web' | 'external';
  /** Path (web) or absolute URL (external) — the caller resolves it against its own base. */
  url: string;
  label?: string;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  /** OSes this feature can ever run on, regardless of distribution. */
  platforms: PlatformOS[];
  /** All must be true in the snapshot's `capabilities`, or the degrade strategy applies. */
  requiredCapabilities?: CapabilityKey[];
  /**
   * Capabilities that represent an OS *permission* rather than plain support
   * (e.g. notifications). Missing one of these yields `REQUIRES_PERMISSION`
   * instead of the generic degrade outcome, because the fix is "grant
   * permission", not "use the fallback".
   */
  permissionCapabilities?: CapabilityKey[];
  /** Inert until real billing exists — see `PlanTier`. */
  requiredPlan?: PlanTier;
  /** Declared but intentionally not shipped yet; always evaluates to `COMING_SOON`. */
  comingSoon?: boolean;
  /** What state a missing required capability produces. Defaults to `'disabled'`. */
  degrade?: DegradeStrategy;
  fallback?: FeatureFallback | null;
  /** Overrides the generic "isn't available in this build" copy for STORE_RESTRICTED. */
  storeRestrictedReason?: string;
  /**
   * `'user-facing'` features gate an actual control (a button, a settings
   * toggle, a route). `'informational'` ones (single-instance enforcement,
   * safe storage) have no UI to gate — they exist so the diagnostics screen
   * and the Settings summary can report on them honestly.
   */
  uiRelevance?: 'user-facing' | 'informational';
}

export interface FeatureEvaluation {
  id: string;
  state: FeatureState;
  /** Shorthand for `state === 'AVAILABLE'`. */
  available: boolean;
  reason: string | null;
  fallback: FeatureFallback | null;
  platform: PlatformOS;
  distribution: Distribution;
}

/**
 * The rulebook for one (platform, distribution) pair — the *only* place
 * Apple/Microsoft/Store-specific restrictions are allowed to live. See
 * `libs/shared/platform/src/lib/policies/`.
 */
export interface DistributionPolicy {
  distribution: Distribution;
  /** Human label for reasons and diagnostics, e.g. "Mac App Store". */
  label: string;
  /** Feature ids this distribution cannot offer at all, regardless of runtime capability. */
  restrictedFeatureIds: string[];
  /** Capabilities this distribution's review/sandbox rules forbid outright. */
  forbiddenCapabilities: CapabilityKey[];
  /** Why — for the diagnostics screen and for code review, not shown to end users. */
  notes: string;
}

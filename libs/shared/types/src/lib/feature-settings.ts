/**
 * Generalizes the precedence rule link previews already proved out
 * (`resolvePreviewVisibility` in `@org/chat-ui`'s `use-link-preview.ts`) so
 * every ENABLED/OPTIONAL/DISABLED workspace policy paired with a boolean
 * user preference can share one implementation instead of each feature
 * re-deriving its own precedence logic.
 *
 * Precedence, most to least specific:
 *   1. `contextOverride`   — an explicit, most-specific choice (e.g. a single
 *      message's "show/hide preview", a per-conversation override)
 *   2. `policy === 'DISABLED'` — the workspace forbids it outright; no
 *      override below this point can turn it back on
 *   3. `policy === 'ENABLED'`  — the workspace forces it on
 *   4. `userPreference`     — the member's own choice, consulted only while
 *      the workspace leaves the policy `OPTIONAL` (or unset)
 *   5. `systemDefault`      — the platform default when nothing above applies
 */
export type TieredFeaturePolicy = 'ENABLED' | 'OPTIONAL' | 'DISABLED';

export interface ResolvePolicyGatedSettingParams {
  /** Workspace-level policy value, when a tiered policy applies to this feature. */
  policy?: TieredFeaturePolicy;
  /** The member's own preference, consulted only while the policy is OPTIONAL. */
  userPreference?: boolean;
  /** The most specific override available (per-message, per-conversation, …). Wins over everything when set. */
  contextOverride?: boolean;
  /** Fallback when nothing else resolves it. Defaults to `true`. */
  systemDefault?: boolean;
}

export function resolvePolicyGatedSetting(
  params: ResolvePolicyGatedSettingParams,
): boolean {
  const { policy, userPreference, contextOverride, systemDefault = true } = params;

  if (typeof contextOverride === 'boolean') return contextOverride;
  if (policy === 'DISABLED') return false;
  if (policy === 'ENABLED') return true;
  if (typeof userPreference === 'boolean') return userPreference;
  return systemDefault;
}

/**
 * True while the workspace policy still leaves the choice up to the member —
 * i.e. the per-user control for this feature should render enabled rather
 * than locked to the workspace's forced value.
 */
export function isPolicyOverridable(policy?: TieredFeaturePolicy): boolean {
  return policy !== 'ENABLED' && policy !== 'DISABLED';
}

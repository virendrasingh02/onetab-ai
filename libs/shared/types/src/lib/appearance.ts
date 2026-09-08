import type { ThemeConfig } from './entities.js';

/**
 * Workspace-scoped appearance.
 *
 * The same shape is stored in three places and layered to decide what a member
 * sees in a given workspace:
 *
 * 1. `WorkspaceThemePreference.data` — the member's personal override *for this
 *    workspace* (any member may set it).
 * 2. `WorkspaceSettings.theme` — the workspace's appearance/branding default
 *    (only `MANAGE_SETTINGS`).
 * 3. `ThemeSetting.data` — the member's legacy user-global appearance, kept as
 *    the fallback so nobody's look changes on upgrade.
 * 4. `DESIGN_SYSTEM_DEFAULT_APPEARANCE` — the last resort.
 *
 * Every layer that a normal member can write is keyed by workspace, so a change
 * in one workspace can never affect another. `resolveWorkspaceAppearance`
 * collapses the layers, field by field.
 *
 * The literal unions mirror `themeSettingSchema`
 * (libs/shared/validation) and the design-system tokens; validation at the API
 * boundary is what actually enforces them.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeDensity = 'compact' | 'default' | 'comfortable';
export type ThemeAccent =
  | 'mint'
  | 'violet'
  | 'blue'
  | 'green'
  | 'amber'
  | 'pink'
  | 'cyan'
  | 'orange'
  | 'indigo'
  | 'teal'
  | 'rose';
export type ThemeRadius = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * A stored appearance blob. Every field is optional: a partial blob means
 * "inherit this field from the next layer down". `customTheme` is atomic — an
 * explicit `null` means "no custom theme" and still overrides lower layers,
 * whereas `undefined` means "inherit".
 */
export interface ThemeAppearance {
  theme?: ThemeMode;
  density?: ThemeDensity;
  accent?: ThemeAccent;
  radius?: ThemeRadius;
  customTheme?: ThemeConfig | null;
}

/** A fully-resolved appearance — no field left to inherit. */
export interface ResolvedAppearance {
  theme: ThemeMode;
  density: ThemeDensity;
  accent: ThemeAccent;
  radius: ThemeRadius;
  customTheme: ThemeConfig | null;
}

/** Matches `<ThemeProvider>`'s own defaults in @org/design-system. */
export const DESIGN_SYSTEM_DEFAULT_APPEARANCE: ResolvedAppearance = {
  theme: 'light',
  density: 'default',
  accent: 'mint',
  radius: 'md',
  customTheme: null,
};

/** The layers feeding {@link resolveWorkspaceAppearance}, highest priority first. */
export interface WorkspaceAppearanceLayers {
  /** `WorkspaceThemePreference.data` for the current member + workspace. */
  memberOverride?: ThemeAppearance | null;
  /** `WorkspaceSettings.theme` for the current workspace. */
  workspaceDefault?: ThemeAppearance | null;
  /** The member's legacy user-global `ThemeSetting.data`. */
  userGlobal?: ThemeAppearance | null;
}

/** What `GET /workspaces/:id/settings/appearance` returns. */
export interface WorkspaceAppearanceResponse {
  workspaceId: string;
  /** The workspace's default (branding). `{}` when unset. */
  workspaceDefault: ThemeAppearance;
  /** The caller's personal override for this workspace. `{}` when unset. */
  memberOverride: ThemeAppearance;
  /** The caller's legacy user-global appearance. `{}` when unset. */
  userGlobal: ThemeAppearance;
  /** All layers collapsed — what the client should paint. */
  resolved: ResolvedAppearance;
  /** Whether the caller may edit `workspaceDefault`. */
  canManageDefault: boolean;
}

function pick<K extends keyof ThemeAppearance>(
  key: K,
  layers: Array<ThemeAppearance | null | undefined>,
): ThemeAppearance[K] | undefined {
  for (const layer of layers) {
    if (layer && layer[key] !== undefined) return layer[key];
  }
  return undefined;
}

/**
 * Collapse the appearance layers into one blob to paint.
 *
 * Field by field: member override, then workspace default, then the member's
 * user-global preference, then the design-system default. `customTheme` is
 * taken atomically from the first layer that mentions it at all (including an
 * explicit `null`).
 */
export function resolveWorkspaceAppearance(
  layers: WorkspaceAppearanceLayers,
): ResolvedAppearance {
  const order = [
    layers.memberOverride,
    layers.workspaceDefault,
    layers.userGlobal,
  ];

  const hasCustom = order.find(
    (layer) => layer && 'customTheme' in layer && layer.customTheme !== undefined,
  );

  return {
    theme: pick('theme', order) ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.theme,
    density: pick('density', order) ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.density,
    accent: pick('accent', order) ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.accent,
    radius: pick('radius', order) ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.radius,
    customTheme: hasCustom ? (hasCustom.customTheme ?? null) : null,
  };
}

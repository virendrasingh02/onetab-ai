import type { AgentWidgetConfig, AgentWidgetLayout } from '@org/types';

/**
 * Widget Studio's form, and how it maps onto the deployment's stored
 * `widgetConfig`. The API and the browser SDK read the nested
 * `appearance` / `behavior` objects, so that is the one shape written; the
 * flat keys older saves used are still read, so nothing already saved is lost.
 */
export interface WidgetForm {
  layout: AgentWidgetLayout;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  primaryColor: string;
  /** Empty means "use the agent's own avatar". */
  avatarUrl: string;
  theme: 'system' | 'light' | 'dark';
  position: 'bottom-right' | 'bottom-left';
  suggestedPrompts: string[];
  /** Empty means the default, "Ask <title> a question". */
  inputPlaceholder: string;
  launcherLabel: string;
  disclaimer: string;
  privacyPolicyUrl: string;
  sessionDurationMinutes: number;
}

export const DEFAULT_WIDGET_FORM: WidgetForm = {
  layout: 'panel',
  title: '',
  subtitle: '',
  welcomeMessage: '',
  primaryColor: '#6366f1',
  avatarUrl: '',
  theme: 'dark',
  position: 'bottom-right',
  suggestedPrompts: [],
  inputPlaceholder: '',
  launcherLabel: '',
  disclaimer: '',
  privacyPolicyUrl: '',
  sessionDurationMinutes: 1440,
};

const LAYOUTS = ['panel', 'compact', 'pill'] as const;
const THEMES = ['system', 'light', 'dark'] as const;
const POSITIONS = ['bottom-right', 'bottom-left'] as const;

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const text = (...candidates: unknown[]): string | undefined => {
  for (const c of candidates) if (typeof c === 'string' && c.trim()) return c;
  return undefined;
};

/** Largest uploaded avatar kept inline in the widget config. */
export const MAX_AVATAR_BYTES = 256 * 1024;

const AVATAR_URL = /^(https?:\/\/|\/(?!\/))[^\s"'<>]+$/i;
const AVATAR_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

/** An avatar the embed will accept (mirrors the API's check), or undefined. */
export function cleanAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v && (AVATAR_URL.test(v) || AVATAR_DATA_URL.test(v)) ? v : undefined;
}

/** A link the embed will put on the disclaimer (http/https only), or undefined. */
export function cleanLinkUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A hex colour the SDK can drop straight into CSS, or undefined. */
export function cleanColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value.trim()) ? value.trim() : undefined;
}

export function readWidgetForm(raw: AgentWidgetConfig | undefined): WidgetForm {
  const config = obj(raw);
  const appearance = obj(config['appearance']);
  const behavior = obj(config['behavior']);
  const theme = text(appearance['theme'], config['theme']);
  const position = text(appearance['position'], config['position']);
  const prompts = appearance['suggestedPrompts'] ?? config['suggestedPrompts'];
  const minutes = Number(behavior['sessionDurationMinutes']);
  const layout = text(appearance['layout']);

  return {
    layout: (LAYOUTS as readonly string[]).includes(layout ?? '') ? (layout as AgentWidgetLayout) : DEFAULT_WIDGET_FORM.layout,
    title: text(appearance['title'], config['title']) ?? DEFAULT_WIDGET_FORM.title,
    subtitle: text(appearance['subtitle'], config['subtitle']) ?? DEFAULT_WIDGET_FORM.subtitle,
    welcomeMessage:
      text(appearance['welcomeMessage'], appearance['greeting'], config['welcomeMessage']) ?? DEFAULT_WIDGET_FORM.welcomeMessage,
    primaryColor: cleanColor(appearance['primaryColor']) ?? cleanColor(config['primaryColor']) ?? DEFAULT_WIDGET_FORM.primaryColor,
    avatarUrl: cleanAvatarUrl(appearance['avatarUrl']) ?? DEFAULT_WIDGET_FORM.avatarUrl,
    theme: (THEMES as readonly string[]).includes(theme ?? '') ? (theme as WidgetForm['theme']) : DEFAULT_WIDGET_FORM.theme,
    position: (POSITIONS as readonly string[]).includes(position ?? '')
      ? (position as WidgetForm['position'])
      : DEFAULT_WIDGET_FORM.position,
    suggestedPrompts: Array.isArray(prompts)
      ? prompts.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      : DEFAULT_WIDGET_FORM.suggestedPrompts,
    inputPlaceholder: text(appearance['inputPlaceholder']) ?? DEFAULT_WIDGET_FORM.inputPlaceholder,
    launcherLabel: text(appearance['launcherLabel']) ?? DEFAULT_WIDGET_FORM.launcherLabel,
    disclaimer: text(appearance['disclaimer']) ?? DEFAULT_WIDGET_FORM.disclaimer,
    privacyPolicyUrl: cleanLinkUrl(appearance['privacyPolicyUrl']) ?? DEFAULT_WIDGET_FORM.privacyPolicyUrl,
    sessionDurationMinutes:
      Number.isFinite(minutes) && minutes > 0 ? Math.min(Math.round(minutes), 60 * 24 * 30) : DEFAULT_WIDGET_FORM.sessionDurationMinutes,
  };
}

/** The stored config for a form, keeping anything else the saved config carries. */
export function toWidgetConfig(form: WidgetForm, base: AgentWidgetConfig | undefined): AgentWidgetConfig {
  const config = obj(base);
  return {
    ...config,
    appearance: {
      ...obj(config['appearance']),
      layout: form.layout,
      title: form.title.trim() || undefined,
      subtitle: form.subtitle.trim() || undefined,
      welcomeMessage: form.welcomeMessage.trim() || undefined,
      primaryColor: cleanColor(form.primaryColor) ?? DEFAULT_WIDGET_FORM.primaryColor,
      avatarUrl: cleanAvatarUrl(form.avatarUrl),
      theme: form.theme,
      position: form.position,
      suggestedPrompts: form.suggestedPrompts.map((p) => p.trim()).filter(Boolean),
      inputPlaceholder: form.inputPlaceholder.trim() || undefined,
      launcherLabel: form.launcherLabel.trim() || undefined,
      disclaimer: form.disclaimer.trim() || undefined,
      privacyPolicyUrl: cleanLinkUrl(form.privacyPolicyUrl),
    },
    behavior: {
      ...obj(config['behavior']),
      sessionDurationMinutes: form.sessionDurationMinutes,
    },
  } as AgentWidgetConfig;
}

/** Allowed origins as the API stores them: trimmed, no blanks, no duplicates; `*` means any. */
export function cleanOrigins(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const origin = raw.trim().replace(/\/+$/, '');
    if (origin && !out.includes(origin)) out.push(origin);
  }
  return out;
}

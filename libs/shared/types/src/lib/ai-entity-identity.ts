/**
 * The identity of an AI entity (agent or coworker): a built-in icon on a
 * colour, or a photo. Framework-free so the API (deployed widget, chat-server
 * profiles) and every web surface read and write it the same way; the React
 * avatar and picker in `@org/ui` build on this.
 *
 * Stored entirely in the entity's `avatarUrl`:
 * - a photo: an `https:`/`data:` URL;
 * - a built-in icon: `icon:<icon>` or `icon:<icon>:<color>` (e.g. `icon:bot:emerald`).
 */

export interface AiEntityIconDef {
  id: string;
  label: string;
}

/** Every built-in icon, in picker order. */
export const AI_ENTITY_ICON_DEFS: readonly AiEntityIconDef[] = [
  { id: 'bot', label: 'Bot' },
  { id: 'brain', label: 'Brain' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'zap', label: 'Lightning' },
  { id: 'flame', label: 'Flame' },
  { id: 'shield', label: 'Shield' },
  { id: 'user', label: 'Person' },
  { id: 'cpu', label: 'Processor' },
  { id: 'layers', label: 'Layers' },
  { id: 'search', label: 'Search' },
  { id: 'database', label: 'Database' },
  { id: 'globe', label: 'Web' },
  { id: 'chat', label: 'Chat' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'wrench', label: 'Tool' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'support', label: 'Support' },
  { id: 'code', label: 'Code' },
  { id: 'rocket', label: 'Launch' },
  { id: 'idea', label: 'Idea' },
];

/** Older spellings (Studio's `configuration.icon`, early coworker presets) → icon id. */
export const AI_ENTITY_ICON_ALIASES: Readonly<Record<string, string>> = {
  spark: 'sparkles',
  code2: 'code',
  messagesquare: 'chat',
  gitbranch: 'workflow',
  headphones: 'support',
  lightbulb: 'idea',
  lightning: 'zap',
  person: 'user',
  processor: 'cpu',
  web: 'globe',
  tool: 'wrench',
  launch: 'rocket',
};

export interface AiEntityColorDef {
  id: string;
  label: string;
  /** For places that can't use Tailwind (the embeddable widget, generated SVGs). */
  hex: string;
}

/** Every identity colour, in picker order. */
export const AI_ENTITY_COLOR_DEFS: readonly AiEntityColorDef[] = [
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'sky', label: 'Sky', hex: '#0284c7' },
  { id: 'zinc', label: 'Zinc', hex: '#71717a' },
];

export const DEFAULT_AI_ENTITY_ICON = 'bot';
export const DEFAULT_AI_ENTITY_COLOR = 'emerald';

const ICON_IDS = new Set(AI_ENTITY_ICON_DEFS.map((o) => o.id));
const COLOR_BY_ID = new Map(AI_ENTITY_COLOR_DEFS.map((o) => [o.id, o]));

/** The icon id for any spelling (`Bot`, `Code2`, `spark`…), or `undefined` if unknown. */
export function resolveAiEntityIconId(name?: string | null): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  const id = AI_ENTITY_ICON_ALIASES[key] ?? key;
  return ICON_IDS.has(id) ? id : undefined;
}

export function resolveAiEntityColorId(name?: string | null): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return COLOR_BY_ID.has(key) ? key : undefined;
}

export function aiEntityColorHex(colorId?: string | null): string | undefined {
  return colorId ? COLOR_BY_ID.get(colorId)?.hex : undefined;
}

export type AiEntityIdentity =
  | { type: 'photo'; src: string }
  | { type: 'icon'; icon: string; color?: string }
  | { type: 'none' };

/** Reads an entity's `avatarUrl` into what to draw. */
export function parseAiEntityAvatar(avatarUrl?: string | null): AiEntityIdentity {
  const value = avatarUrl?.trim();
  if (!value) return { type: 'none' };
  if (!value.startsWith('icon:')) return { type: 'photo', src: value };
  const [, iconPart, colorPart] = value.split(':');
  return {
    type: 'icon',
    icon: resolveAiEntityIconId(iconPart) ?? DEFAULT_AI_ENTITY_ICON,
    color: resolveAiEntityColorId(colorPart),
  };
}

/** `icon:<icon>[:<color>]` — the value to store for a built-in icon. */
export function formatAiEntityIconAvatar(icon: string, color?: string | null): string {
  const iconId = resolveAiEntityIconId(icon) ?? DEFAULT_AI_ENTITY_ICON;
  const colorId = resolveAiEntityColorId(color);
  return colorId ? `icon:${iconId}:${colorId}` : `icon:${iconId}`;
}

/**
 * An agent saved before identities lived in `avatarUrl` kept its icon and
 * colour in `configuration.icon` / `configuration.theme`; fold those in.
 */
export function aiEntityAvatarFromLegacy(
  avatarUrl?: string | null,
  configuration?: { icon?: unknown; theme?: unknown; avatar?: unknown } | null,
): string | null {
  const direct = avatarUrl?.trim() || (typeof configuration?.avatar === 'string' ? configuration.avatar.trim() : '');
  if (direct) return direct;
  const icon = typeof configuration?.icon === 'string' ? configuration.icon : undefined;
  const theme = typeof configuration?.theme === 'string' ? configuration.theme : undefined;
  if (!icon && !theme) return null;
  return formatAiEntityIconAvatar(icon ?? DEFAULT_AI_ENTITY_ICON, theme);
}

/** Lucide (ISC licence) 24×24 stroke shapes for each built-in icon, for SVG output outside React. */
const ICON_SVG: Readonly<Record<string, string>> = {
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  brain: '<path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>',
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  zap: '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
  flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  cpu: '<path d="M12 20v2"/><path d="M12 2v2"/><path d="M17 20v2"/><path d="M17 2v2"/><path d="M2 12h2"/><path d="M2 17h2"/><path d="M2 7h2"/><path d="M20 12h2"/><path d="M20 17h2"/><path d="M20 7h2"/><path d="M7 20v2"/><path d="M7 2v2"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  chat: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  terminal: '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  workflow: '<path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>',
  support: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  code: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  rocket: '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>',
  idea: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
};

/** Base64 without `Buffer` or a DOM, so it runs in the browser and in Node alike. */
function toBase64(ascii: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < ascii.length; i += 3) {
    const a = ascii.charCodeAt(i);
    const b = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : -1;
    const c = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : -1;
    out += chars[a >> 2];
    out += chars[((a & 3) << 4) | (b < 0 ? 0 : b >> 4)];
    out += b < 0 ? '=' : chars[((b & 15) << 2) | (c < 0 ? 0 : c >> 6)];
    out += c < 0 ? '=' : chars[c & 63];
  }
  return out;
}

/**
 * An icon identity as a self-contained SVG image (white glyph on its colour,
 * round), for surfaces that only take an image URL — the embeddable widget,
 * chat-server profiles. `fallbackHex` colours an icon saved without a colour.
 * Photos are returned unchanged; an empty value gives `null`.
 */
export function aiEntityAvatarImageUrl(avatarUrl?: string | null, fallbackHex = '#6366f1'): string | null {
  const parsed = parseAiEntityAvatar(avatarUrl);
  if (parsed.type === 'none') return null;
  if (parsed.type === 'photo') return parsed.src;
  const fill = aiEntityColorHex(parsed.color) ?? fallbackHex;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
    `<circle cx="48" cy="48" r="48" fill="${fill}"/>` +
    '<g transform="translate(24 24) scale(2)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    (ICON_SVG[parsed.icon] ?? ICON_SVG[DEFAULT_AI_ENTITY_ICON]) +
    '</g></svg>';
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

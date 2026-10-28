import { cn } from '@org/utils';
import {
  Bot,
  Brain,
  Code2,
  Cpu,
  Database,
  Flame,
  GitBranch,
  Globe,
  Headphones,
  Layers,
  Lightbulb,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Terminal,
  User,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  AI_ENTITY_COLOR_DEFS,
  AI_ENTITY_ICON_ALIASES,
  AI_ENTITY_ICON_DEFS,
  parseAiEntityAvatar,
} from '@org/types';
import { useState, type FC } from 'react';

// The rules themselves live in `@org/types` (the API uses them too); re-exported so UI callers have one import.
export {
  DEFAULT_AI_ENTITY_COLOR,
  DEFAULT_AI_ENTITY_ICON,
  aiEntityAvatarFromLegacy,
  aiEntityAvatarImageUrl,
  aiEntityColorHex,
  formatAiEntityIconAvatar,
  parseAiEntityAvatar,
  resolveAiEntityColorId,
  resolveAiEntityIconId,
  type AiEntityIdentity,
} from '@org/types';

/**
 * The single visual identity of every AI entity (coworker / agent). Sidebar rows,
 * chat headers, message avatars, profile panels, Studio cards and the create /
 * edit dialogs all draw from here, so the same entity is always the same
 * photo-or-glyph on the same colour.
 *
 * An entity's identity lives entirely in its `avatarUrl`, so it travels with
 * every API response that already carries one:
 * - a photo: an `https:`/`data:` URL;
 * - a built-in icon: `icon:<icon>` or `icon:<icon>:<color>` (e.g. `icon:bot:emerald`).
 * Without a colour, the tone falls back to the entity kind (agents) or a tint
 * derived from the name (coworkers).
 */
export type AiEntityKind = 'coworker' | 'agent';

export interface AiEntityIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** The React glyph for each icon id in `@org/types`' catalogue. */
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  bot: Bot,
  brain: Brain,
  sparkles: Sparkles,
  zap: Zap,
  flame: Flame,
  shield: Shield,
  user: User,
  cpu: Cpu,
  layers: Layers,
  search: Search,
  database: Database,
  globe: Globe,
  chat: MessageSquare,
  terminal: Terminal,
  wrench: Wrench,
  workflow: GitBranch,
  support: Headphones,
  code: Code2,
  rocket: Rocket,
  idea: Lightbulb,
};

/** Every built-in icon, in picker order — ids and labels come from `@org/types`. */
export const AI_ENTITY_ICONS: readonly AiEntityIconOption[] = AI_ENTITY_ICON_DEFS.map((d) => ({
  ...d,
  icon: ICON_COMPONENTS[d.id] ?? Bot,
}));

export interface AiEntityColorOption {
  id: string;
  label: string;
  hex: string;
  /** Solid fill for a swatch. */
  swatch: string;
  /** Tinted background + glyph colour for an avatar. */
  tone: string;
  /** Gradient stops for a profile cover banner (used with `bg-gradient-to-br`). */
  cover: string;
}

/** Tailwind classes per colour id. Literal strings so Tailwind keeps them. */
const COLOR_CLASSES: Record<string, Pick<AiEntityColorOption, 'swatch' | 'tone' | 'cover'>> = {
  emerald: { swatch: 'bg-emerald-500', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', cover: 'from-emerald-500/25 to-emerald-600/5' },
  indigo: { swatch: 'bg-indigo-500', tone: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30', cover: 'from-indigo-500/25 to-indigo-600/5' },
  purple: { swatch: 'bg-purple-500', tone: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30', cover: 'from-purple-500/25 to-purple-600/5' },
  amber: { swatch: 'bg-amber-500', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', cover: 'from-amber-500/25 to-amber-600/5' },
  cyan: { swatch: 'bg-cyan-500', tone: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30', cover: 'from-cyan-500/25 to-cyan-600/5' },
  rose: { swatch: 'bg-rose-500', tone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30', cover: 'from-rose-500/25 to-rose-600/5' },
  sky: { swatch: 'bg-sky-600', tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30', cover: 'from-sky-500/25 to-sky-700/5' },
  zinc: { swatch: 'bg-zinc-500', tone: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30', cover: 'from-zinc-500/25 to-zinc-600/5' },
};

/** Every identity colour, in picker order — ids, labels and hex come from `@org/types`. */
export const AI_ENTITY_COLORS: readonly AiEntityColorOption[] = AI_ENTITY_COLOR_DEFS.map((d) => ({
  ...d,
  ...(COLOR_CLASSES[d.id] ?? COLOR_CLASSES['zinc']),
}));

const ICON_BY_ID = new Map(AI_ENTITY_ICONS.map((o) => [o.id, o]));
const COLOR_BY_ID = new Map(AI_ENTITY_COLORS.map((o) => [o.id, o]));

/** `icon:<id>` → glyph, kept for callers that look presets up by key. */
export const AI_ENTITY_PRESET_ICONS: Record<string, LucideIcon> = {
  ...Object.fromEntries(AI_ENTITY_ICONS.map((o) => [`icon:${o.id}`, o.icon])),
  ...Object.fromEntries(
    Object.entries(AI_ENTITY_ICON_ALIASES).map(([alias, id]) => [`icon:${alias}`, (ICON_BY_ID.get(id) as AiEntityIconOption).icon]),
  ),
};

/** The preset glyph for an `avatarUrl`, or `undefined` when it's a photo/empty. */
export function getAiEntityPresetIcon(avatarUrl?: string | null): LucideIcon | undefined {
  const parsed = parseAiEntityAvatar(avatarUrl);
  return parsed.type === 'icon' ? ICON_BY_ID.get(parsed.icon)?.icon : undefined;
}

/** The glyph shown when there's no photo: the chosen preset, else the default `Bot`. */
export function getAiEntityGlyph(avatarUrl?: string | null): LucideIcon | undefined {
  return parseAiEntityAvatar(avatarUrl).type === 'photo' ? undefined : (getAiEntityPresetIcon(avatarUrl) ?? Bot);
}

/** One letter for any AI entity with no image or icon. */
export function getAiEntityInitial(name?: string | null): string {
  const first = Array.from((name ?? '').trim())[0];
  return (first ?? 'A').toUpperCase();
}

const GRADIENTS = [
  'from-violet-500/20 to-purple-600/20 text-violet-600 dark:text-violet-300 border-violet-500/30',
  'from-indigo-500/20 to-blue-600/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
  'from-teal-500/20 to-emerald-600/20 text-teal-600 dark:text-teal-300 border-teal-500/30',
  'from-amber-500/20 to-orange-600/20 text-amber-600 dark:text-amber-300 border-amber-500/30',
  'from-rose-500/20 to-pink-600/20 text-rose-600 dark:text-rose-300 border-rose-500/30',
  'from-cyan-500/20 to-sky-600/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
];

/** Deterministic tint from a name; also used for a coworker's cover banner. */
export function getAiEntityGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * The avatar's background/glyph colour: the chosen identity colour when the
 * avatar names one; otherwise agents share one primary tone and coworkers tint by name.
 */
export function getAiEntityTone(kind: AiEntityKind, name: string, avatarUrl?: string | null): string {
  const parsed = parseAiEntityAvatar(avatarUrl);
  const chosen = parsed.type === 'icon' && parsed.color ? COLOR_BY_ID.get(parsed.color) : undefined;
  if (chosen) return chosen.tone;
  return kind === 'agent'
    ? 'bg-primary/10 text-primary border-primary/20'
    : cn('bg-gradient-to-br', getAiEntityGradient(name));
}

/** A profile cover's gradient stops: the chosen colour, else the name-derived tint. */
export function getAiEntityCover(name: string, avatarUrl?: string | null): string {
  const parsed = parseAiEntityAvatar(avatarUrl);
  const chosen = parsed.type === 'icon' && parsed.color ? COLOR_BY_ID.get(parsed.color) : undefined;
  return chosen ? chosen.cover : getAiEntityGradient(name);
}

const SIZES = {
  xs: { box: 'size-6 text-[10px]', icon: 'size-3.5' },
  sm: { box: 'size-7 text-xs', icon: 'size-4' },
  md: { box: 'size-10 text-sm', icon: 'size-5' },
  lg: { box: 'size-12 text-base', icon: 'size-6' },
  xl: { box: 'size-16 text-xl', icon: 'size-8' },
} as const;

export interface AiEntityAvatarProps {
  name: string;
  kind?: AiEntityKind;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export const AiEntityAvatar: FC<AiEntityAvatarProps> = ({
  name,
  kind = 'coworker',
  avatarUrl,
  size = 'md',
  className,
}) => {
  // Track which URL failed so a changed photo gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { box, icon } = SIZES[size] ?? SIZES.md;
  const parsed = parseAiEntityAvatar(avatarUrl);
  const Glyph = getAiEntityGlyph(avatarUrl);
  const showImage = parsed.type === 'photo' && failedSrc !== parsed.src;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-semibold leading-none shadow-xs',
        box,
        getAiEntityTone(kind, name, avatarUrl),
        className,
      )}
    >
      {showImage ? (
        <img
          src={parsed.src}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedSrc(parsed.src)}
        />
      ) : Glyph ? (
        <Glyph className={icon} />
      ) : (
        <span aria-hidden>{getAiEntityInitial(name)}</span>
      )}
    </span>
  );
};

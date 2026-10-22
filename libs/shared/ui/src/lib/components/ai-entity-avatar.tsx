import { cn } from '@org/utils';
import {
  Bot,
  Brain,
  Code2,
  Globe,
  Layers,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState, type FC } from 'react';

/**
 * The single visual identity of every AI entity (coworker / agent). Sidebar rows,
 * chat headers, message avatars, profile panels and lists all draw from here, so
 * the same coworker is always the same photo-or-glyph on the same colour.
 */
export type AiEntityKind = 'coworker' | 'agent';

/** Coworker `icon:*` avatar presets — the single source for every surface that draws one. */
export const AI_ENTITY_PRESET_ICONS: Record<string, LucideIcon> = {
  'icon:bot': Bot,
  'icon:brain': Brain,
  'icon:code': Code2,
  'icon:spark': Sparkles,
  'icon:shield': Shield,
  'icon:search': Search,
  'icon:chat': MessageSquare,
  'icon:rocket': Rocket,
  'icon:globe': Globe,
  'icon:layers': Layers,
  'icon:zap': Zap,
};

const isPhotoSource = (avatarUrl?: string | null) =>
  !!avatarUrl && !avatarUrl.startsWith('icon:');

/** The preset glyph for an `avatarUrl`, or `undefined` when it's a photo/empty. */
export function getAiEntityPresetIcon(avatarUrl?: string | null): LucideIcon | undefined {
  return avatarUrl ? AI_ENTITY_PRESET_ICONS[avatarUrl] : undefined;
}

/** The glyph shown when there's no photo: the chosen preset, else the default `Bot`. */
export function getAiEntityGlyph(avatarUrl?: string | null): LucideIcon | undefined {
  return isPhotoSource(avatarUrl) ? undefined : (getAiEntityPresetIcon(avatarUrl) ?? Bot);
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

/** Agents share one primary tone (like their sidebar tile); coworkers tint by name. */
export function getAiEntityTone(kind: AiEntityKind, name: string): string {
  return kind === 'agent'
    ? 'bg-primary/10 text-primary border-primary/20'
    : cn('bg-gradient-to-br', getAiEntityGradient(name));
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
  const [imageFailed, setImageFailed] = useState(false);
  const { box, icon } = SIZES[size] ?? SIZES.md;
  const Glyph = getAiEntityGlyph(avatarUrl);
  const showImage = isPhotoSource(avatarUrl) && !imageFailed;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-semibold leading-none shadow-xs',
        box,
        getAiEntityTone(kind, name),
        className,
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl as string}
          alt={name}
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : Glyph ? (
        <Glyph className={icon} />
      ) : (
        <span aria-hidden>{getAiEntityInitial(name)}</span>
      )}
    </span>
  );
};

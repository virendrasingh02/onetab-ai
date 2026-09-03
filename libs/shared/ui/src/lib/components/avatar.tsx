import {
  avatarGradient,
  avatarTint,
  normalizeAvatarSeed,
} from '@org/design-system';
import { cn, initials } from '@org/utils';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { IconRenderer } from './icon-picker-popover.js';
import { Hint } from './tooltip.js';

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden select-none',
  {
    variants: {
      size: {
        xs: 'size-5 text-[10px]',
        sm: 'size-6 text-[11px]',
        md: 'size-8 text-xs',
        lg: 'size-10 text-sm',
        xl: 'size-16 text-xl',
      },
      shape: {
        // Workspaces read as "apps" (squircle); people read as circles.
        circle: 'rounded-full',
        rounded: 'rounded-lg',
      },
    },
    defaultVariants: { size: 'md', shape: 'circle' },
  },
);

export interface AvatarProps
  extends
    ComponentProps<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

export function Avatar({ className, size, shape, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size, shape }), className)}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'font-medium text-white flex size-full items-center justify-center',
        className,
      )}
      {...props}
    />
  );
}

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/**
 * The API's spelling of the same set (`User.presence`). Accepted anywhere this
 * library takes a `presence` so call sites can hand the value straight through
 * instead of open-coding a `'ONLINE' ? 'online' : …` ladder — the ladders were
 * dropping `BUSY` to offline on half the surfaces.
 */
export type ApiPresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

/**
 * Every spelling of presence in the codebase, accepted anywhere this library
 * takes `presence`:
 *  - `@org/ui`'s own lowercase union,
 *  - the API enum (`User.presence`),
 *  - `'unavailable'` — the realtime/Matrix idle state, drawn as "away".
 */
export type PresenceInput = PresenceStatus | ApiPresenceStatus | 'unavailable';

export const PRESENCE_STYLES: Record<PresenceStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-destructive',
  // Faint, so "offline" and the no-presence-data placeholder read as absence
  // rather than as a status worth looking at.
  offline: 'bg-muted-foreground/40',
};

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Do not disturb',
  offline: 'Offline',
};

/**
 * Narrows the API's `PresenceStatus` (`'ONLINE' | 'AWAY' | …`) to the lowercase
 * union this library draws with.
 *
 * The two enums have the same members, but they are declared in different
 * packages — `@org/ui` does not depend on `@org/types` — so the crossing has to
 * happen somewhere. Doing it here keeps every call site from open-coding a
 * `toLowerCase()` cast, which is how the members list ended up rendering both
 * "away" and "busy" as offline.
 */
export function toPresenceStatus(
  value: string | null | undefined,
): PresenceStatus {
  const normalized = value?.toLowerCase();
  // The realtime/Matrix layer says "unavailable" for what the UI calls "away".
  if (normalized === 'unavailable') return 'away';
  return normalized === 'online' ||
    normalized === 'away' ||
    normalized === 'busy'
    ? normalized
    : 'offline';
}

/**
 * Resolves a user id to their *live* presence, or `undefined` when there is no
 * live reading for them.
 *
 * This is the seam that lets every `UserAvatar` show real, DB-backed presence
 * without each call site wiring a realtime hook. `@org/ui` cannot depend on the
 * realtime layer, so the app provides the lookup: it reads the workspace
 * presence snapshot / live events from `@org/realtime` and hands the resolver
 * to `AvatarPresenceProvider` near the root. Unprovided, it is a no-op and
 * avatars fall back to the `presence` prop.
 */
export type AvatarPresenceResolver = (
  userId: string,
) => PresenceInput | null | undefined;

const AvatarPresenceContext = createContext<AvatarPresenceResolver>(
  () => undefined,
);

export function AvatarPresenceProvider({
  resolve,
  children,
}: {
  resolve: AvatarPresenceResolver;
  children: ReactNode;
}) {
  return (
    <AvatarPresenceContext.Provider value={resolve}>
      {children}
    </AvatarPresenceContext.Provider>
  );
}

/**
 * The presence to draw for a user: the live reading when one exists, else the
 * caller's `fallback` (typically a snapshot from a REST payload), else unknown.
 */
export function useResolvedPresence(
  userId: string | undefined,
  fallback?: PresenceInput | null,
): PresenceInput | null | undefined {
  const resolve = useContext(AvatarPresenceContext);
  const live = userId ? resolve(userId) : undefined;
  return live ?? fallback;
}

export interface UserAvatarProps extends Omit<AvatarProps, 'shape'> {
  name: string;
  src?: string | null;
  /** Stable tint seed. Defaults to `name`; pass a user id where available. */
  seed?: string;
  /** Lowercase or the API's uppercase spelling — both are normalized here. */
  presence?: PresenceInput | null;
  /**
   * Whether to draw the corner indicator. On by default — a person avatar
   * carries a status indicator everywhere. When `presence` is unknown it shows
   * a hollow placeholder; pass `false` for dense stacks where it would be noise.
   */
  indicator?: boolean;
  statusEmoji?: string | null;
  statusText?: string | null;
}

/** Status-indicator geometry, scaled so it stays proportional at every size. */
const INDICATOR_SIZES: Record<
  NonNullable<AvatarProps['size']>,
  { dot: string; emoji: string }
> = {
  xs: { dot: 'size-1.5', emoji: 'text-[9px] -right-1 -bottom-1' },
  sm: { dot: 'size-2', emoji: 'text-[10px] -right-1 -bottom-1' },
  md: { dot: 'size-2.5', emoji: 'text-[11px] -right-1 -bottom-1' },
  lg: { dot: 'size-3', emoji: 'text-sm -right-1 -bottom-1' },
  xl: { dot: 'size-4', emoji: 'text-xl -right-0.5 -bottom-0.5' },
};

export interface PresenceDotProps {
  /** Any presence spelling. `null` / omitted → a faint "unknown" dot. */
  presence?: PresenceInput | null;
  /** Matches the avatar size scale; a standalone dot defaults to `sm`. */
  size?: AvatarProps['size'];
  /** Names the person in the a11y label, e.g. "Ada is Online". */
  name?: string;
  /** Wrap in a hover tooltip. Default `true`. */
  hint?: boolean;
  className?: string;
}

/**
 * The one presence dot. `UserAvatar` places it in its corner; standalone status
 * lines render it inline. Same colours, same labels, same size scale
 * everywhere — there is deliberately no second implementation of this.
 */
export function PresenceDot({
  presence,
  size = 'sm',
  name,
  hint = true,
  className,
}: PresenceDotProps) {
  const known = presence != null;
  const state = known ? toPresenceStatus(presence) : 'offline';
  const label = PRESENCE_LABELS[state];

  const dot = (
    <span
      role="status"
      title={label}
      aria-label={
        name
          ? known
            ? `${name} is ${label}`
            : `${name} presence unknown`
          : known
            ? label
            : 'Presence unknown'
      }
      className={cn(
        'inline-block shrink-0 rounded-full',
        INDICATOR_SIZES[size ?? 'sm'].dot,
        PRESENCE_STYLES[state],
        className,
      )}
    />
  );

  return hint ? (
    <Hint label={label} side="top">
      {dot}
    </Hint>
  ) : (
    dot
  );
}

/**
 * The one avatar for a person: a circle (always — people are never squircles),
 * a deterministic gradient fallback derived from `seed` so the same user looks
 * identical in every surface and in the desktop app, plus one status indicator.
 *
 * The indicator is deterministic and independent of which props a caller
 * happens to pass: a status emoji, when set, replaces the presence dot (they
 * share the corner — showing both is noise on a list avatar), otherwise the
 * dot is drawn from the normalized `presence`. So the same person reads the
 * same way on every surface.
 */
export function UserAvatar({
  name,
  src,
  seed,
  presence,
  indicator = true,
  statusEmoji,
  statusText,
  size,
  className,
  ...props
}: UserAvatarProps) {
  // Prefer the caller's stable seed (a user id), but never let an empty string
  // through — `'' ?? name` keeps `''`, which would paint every seedless avatar
  // the same colour. Fall back to the name only when there is genuinely no seed.
  const tintSeed = seed?.trim() ? seed : name;

  // Live presence wins over the (usually snapshot) `presence` prop. The seed is
  // normally the user id; `normalizeAvatarSeed` also turns a chat Matrix id into
  // the same id the presence map is keyed by.
  const presenceKey = seed?.trim() ? normalizeAvatarSeed(seed) : undefined;
  const resolvedPresence = useResolvedPresence(presenceKey, presence);

  const geometry = INDICATOR_SIZES[size ?? 'md'];
  const showEmoji = indicator && Boolean(statusEmoji);
  const showDot = indicator && !statusEmoji;

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar
        size={size}
        shape="circle"
        className={cn('rounded-full', className)}
        {...props}
      >
        {src ? (
          <AvatarImage src={src} alt={name} className="rounded-full" />
        ) : null}
        <AvatarFallback
          className="rounded-full"
          style={{
            backgroundImage: avatarGradient(tintSeed),
            // A flat fallback under the gradient for any renderer that drops it.
            backgroundColor: avatarTint(tintSeed),
          }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {showDot ? (
        <PresenceDot
          presence={resolvedPresence}
          size={size}
          name={name}
          className="-right-0.5 -bottom-0.5 absolute ring-2 ring-background cursor-default pointer-events-auto"
        />
      ) : null}
      {showEmoji ? (
        <span
          role="status"
          aria-label={
            statusText
              ? `${name}: ${statusText}`
              : `${name} status ${statusEmoji}`
          }
          title={statusText ? `${statusEmoji} ${statusText}` : undefined}
          className={cn(
            'drop-shadow-xs absolute leading-none select-none',
            geometry.emoji,
          )}
        >
          {statusEmoji}
        </span>
      ) : null}
    </span>
  );
}

export interface WorkspaceAvatarProps extends AvatarProps {
  name: string;
  src?: string | null;
  /** Stable tint seed. Defaults to `name`; pass workspace id where available. */
  seed?: string;
  /** Chosen icon — a registry name, an emoji, or an image URL. */
  icon?: string | null;
  /** Hex tint for `icon`, applied only to registry icons. */
  iconColor?: string | null;
}

/** Icon glyphs scaled to comfortably fill the avatar box alongside image avatars. */
const ICON_SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'size-3.5',
  sm: 'size-4.5',
  md: 'size-5.5',
  lg: 'size-7',
  xl: 'size-11',
};

/**
 * Workspace avatar: uploaded logo, else chosen icon, else a deterministic
 * single-letter tile. Squircle by default, because workspaces read as "apps".
 *
 * The precedence matters and is deliberate — a workspace can hold both a logo
 * and an icon, and the logo is the more specific choice. Keeping the icon
 * behind it means removing a logo reveals the icon again rather than dropping
 * all the way back to an initial.
 */
export function WorkspaceAvatar({
  name,
  src,
  seed,
  icon,
  iconColor,
  size = 'md',
  shape = 'rounded',
  className,
  ...props
}: WorkspaceAvatarProps) {
  const isImageIcon =
    !src &&
    Boolean(
      icon &&
      (icon.startsWith('http://') ||
        icon.startsWith('https://') ||
        icon.startsWith('data:image') ||
        icon.startsWith('/')),
    );

  const imageSrc = src || (isImageIcon ? icon : null);

  return (
    <Avatar size={size} shape={shape} className={className} {...props}>
      {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
      {!imageSrc ? (
        <AvatarFallback
          style={
            // An icon supplies its own colour; the tinted tile is for initials.
            icon
              ? undefined
              : { backgroundColor: avatarTint(seed?.trim() ? seed : name) }
          }
          className={
            icon ? 'border border-border bg-surface-raised' : undefined
          }
        >
          {icon ? (
            <IconRenderer
              icon={icon}
              iconColor={iconColor ?? undefined}
              sizeClassName={ICON_SIZES[size ?? 'md']}
              fallbackEmoji={initials(name)}
            />
          ) : (
            initials(name)
          )}
        </AvatarFallback>
      ) : null}
    </Avatar>
  );
}

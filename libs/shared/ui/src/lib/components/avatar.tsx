import {
  avatarGradient,
  avatarTint,
  normalizeAvatarSeed,
} from '@org/design-system';
import { useAuthenticatedMediaSrc } from '@org/hooks';
import { cn, initials } from '@org/utils';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  createContext,
  useContext,
  type ComponentProps,
  type CSSProperties,
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

/**
 * The one place an avatar image actually loads. `src` is transparently
 * resolved through `useAuthenticatedMediaSrc`: a Matrix room/member/sender
 * avatar comes back as an authenticated-media URL a plain `<img>` cannot
 * fetch (see that hook's docs), so this is what makes every avatar in the
 * app — not just the ones built through `UserAvatar`/`WorkspaceAvatar` —
 * render instead of silently 401ing. Anything else (the app's own uploads,
 * `data:`/`blob:` URIs) passes through untouched.
 */
export function AvatarImage({
  className,
  src,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  const resolvedSrc = useAuthenticatedMediaSrc(
    typeof src === 'string' ? src : undefined,
  );
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      src={resolvedSrc ?? undefined}
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
  // A solid, muted grey — "offline" (and the no-presence-data placeholder) still
  // reads as absence next to the bright states, but the dot itself stays fully
  // opaque so it never looks like a rendering glitch.
  offline: 'bg-muted-foreground',
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
  /**
   * Carve a concave corner (an "inverted radius") out of the avatar behind the
   * indicator so the dot / emoji reads against the page rather than against a
   * busy photo. On whenever an indicator is drawn; pass `false` to keep the
   * avatar a full circle.
   */
  notch?: boolean;
  statusEmoji?: string | null;
  statusText?: string | null;
}

/**
 * Status-indicator geometry, scaled so it stays proportional at every size.
 * `dot` is the presence-dot box; `emoji` is just the glyph size — both are
 * placed by `INDICATOR_POSITION`, not by these classes.
 */
const INDICATOR_SIZES: Record<
  NonNullable<AvatarProps['size']>,
  { dot: string; emoji: string }
> = {
  xs: { dot: 'size-1.5', emoji: 'text-[9px]' },
  sm: { dot: 'size-2', emoji: 'text-[10px]' },
  md: { dot: 'size-2.5', emoji: 'text-[11px]' },
  lg: { dot: 'size-3', emoji: 'text-xs' },
  xl: { dot: 'size-4', emoji: 'text-base' },
};

/**
 * Rendered pixel size of the presence dot per avatar size — mirrors the
 * `dot` Tailwind classes above (`size-1.5` = 6px, `size-2` = 8px, …). The dot
 * is a fixed pixel size regardless of how large the avatar is drawn, so the
 * concave corner cut is measured from it, not from the avatar.
 */
const DOT_PX: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

/**
 * Where the indicator sits: centred on the avatar circle's lower-right edge
 * (~the 45° point of an inscribed circle) rather than the square's corner, so
 * it stays put at every size and however the avatar is resized via `className`.
 */
const INDICATOR_POSITION = {
  left: '86%',
  top: '86%',
  transform: 'translate(-50%, -50%)',
} as const;

/**
 * A concave corner ("inverted radius") behind the status dot, as a CSS mask
 * that punches a round hole where the dot sits. Centred on the same edge point,
 * with a radius of `max(12%, dot + a little)` — it scales with the avatar but
 * never shrinks below the dot, so it hugs it cleanly from `xs` to `xl` and on
 * `className`-resized avatars.
 *
 * `corner-shape: scoop` is the direct spec for this but only lands in the
 * newest Chromium. The mask goes on an inner element — never the one that
 * carries the caller's `ring` / `shadow`, which a mask would clip.
 */
function notchMaskStyle(size: NonNullable<AvatarProps['size']>) {
  // Dot radius + its 2px ring + ~1px breathing room — the floor below the %.
  const min = `${DOT_PX[size] / 2 + 3}px`;
  const r = `max(12%, ${min})`;
  const mask =
    `radial-gradient(ellipse ${r} ${r} at 86% 86%, #0000 0 99%, #000 100%)`;
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  } as const;
}

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
  style?: CSSProperties;
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
  style,
}: PresenceDotProps) {
  const known = presence != null;
  const state = known ? toPresenceStatus(presence) : 'offline';
  const label = PRESENCE_LABELS[state];

  const dot = (
    <span
      role="status"
      title={label}
      style={style}
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
  notch = true,
  statusEmoji,
  statusText,
  size,
  className,
  style,
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
  // Carve the concave corner for the dot only — the emoji carries its own chip.
  const scooped = notch && showDot;

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar
        size={size}
        shape="circle"
        className={cn('rounded-full', className)}
        style={style}
        {...props}
      >
        {/*
         * The image + fallback live in an inner layer so the concave-corner mask
         * can be applied here without eating the caller's ring / shadow, which
         * sit on the <Avatar> above.
         */}
        <span
          className="absolute inset-0 overflow-hidden rounded-full"
          style={scooped ? notchMaskStyle(size ?? 'md') : undefined}
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
        </span>
      </Avatar>
      {showDot ? (
        <PresenceDot
          presence={resolvedPresence}
          size={size}
          name={name}
          style={INDICATOR_POSITION}
          className="pointer-events-auto absolute cursor-default ring-2 ring-background"
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
          style={INDICATOR_POSITION}
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-background p-[0.2em] leading-none shadow-sm ring-1 ring-border/50 select-none',
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

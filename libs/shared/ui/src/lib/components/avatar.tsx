import { avatarGradient, avatarTint } from '@org/design-system';
import { cn, initials } from '@org/utils';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { IconRenderer } from './icon-picker-popover.js';

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

const PRESENCE_STYLES: Record<PresenceStatus, string> = {
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
  return normalized === 'online' ||
    normalized === 'away' ||
    normalized === 'busy'
    ? normalized
    : 'offline';
}

export interface UserAvatarProps extends Omit<AvatarProps, 'shape'> {
  name: string;
  src?: string | null;
  /** Stable tint seed. Defaults to `name`; pass a user id where available. */
  seed?: string;
  presence?: PresenceStatus;
  /**
   * Whether to draw the corner indicator. On by default — a person avatar
   * carries a presence dot everywhere. When `presence` is unknown it shows a
   * hollow placeholder; pass `false` for dense stacks where it would be noise.
   */
  indicator?: boolean;
  statusEmoji?: string | null;
  statusText?: string | null;
}

/**
 * The one avatar for a person: a circle (always — people are never squircles),
 * a deterministic gradient fallback derived from `seed` so the same user looks
 * identical in every surface and in the desktop app, plus a presence dot and
 * optional status emoji.
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
  const tintSeed = seed ?? name;
  const dot = presence ?? 'offline';
  const showDot = indicator && (presence !== undefined || !statusEmoji);

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
        <span
          role="status"
          aria-label={
            presence ? `${name} is ${presence}` : `${name} presence unknown`
          }
          className={cn(
            '-right-0.5 -bottom-0.5 size-2.5 absolute rounded-full border-2 border-background',
            PRESENCE_STYLES[dot],
          )}
        />
      ) : null}
      {statusEmoji && !presence ? (
        <span
          role="status"
          aria-label={
            statusText
              ? `${name}: ${statusText}`
              : `${name} status ${statusEmoji}`
          }
          title={statusText ? `${statusEmoji} ${statusText}` : undefined}
          className="-right-1 -bottom-1 drop-shadow-xs absolute text-[11px] leading-none select-none"
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
            icon ? undefined : { backgroundColor: avatarTint(seed ?? name) }
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

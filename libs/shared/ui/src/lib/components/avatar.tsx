import { avatarTint } from '@org/design-system';
import { cn, initials } from '@org/utils';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

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
  extends ComponentProps<typeof AvatarPrimitive.Root>,
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
        'flex size-full items-center justify-center font-medium text-white',
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
  offline: 'bg-muted-foreground',
};

export interface UserAvatarProps extends AvatarProps {
  name: string;
  src?: string | null;
  /** Stable tint seed. Defaults to `name`; pass a user id where available. */
  seed?: string;
  presence?: PresenceStatus;
}

/**
 * Avatar with a deterministic colour fallback and optional presence dot.
 * The tint is derived from `seed`, so a user keeps the same colour everywhere.
 */
export function UserAvatar({
  name,
  src,
  seed,
  presence,
  size,
  shape,
  className,
  ...props
}: UserAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar size={size} shape={shape} className={className} {...props}>
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback style={{ backgroundColor: avatarTint(seed ?? name) }}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {presence ? (
        <span
          role="status"
          aria-label={`${name} is ${presence}`}
          className={cn(
            'border-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2',
            PRESENCE_STYLES[presence],
          )}
        />
      ) : null}
    </span>
  );
}

export interface WorkspaceAvatarProps extends AvatarProps {
  name: string;
  src?: string | null;
  /** Stable tint seed. Defaults to `name`; pass workspace id where available. */
  seed?: string;
}

/**
 * Workspace Avatar with image support and deterministic colour single-letter fallback.
 * Uses squircle (rounded) shape by default.
 */
export function WorkspaceAvatar({
  name,
  src,
  seed,
  size = 'md',
  shape = 'rounded',
  className,
  ...props
}: WorkspaceAvatarProps) {
  return (
    <Avatar size={size} shape={shape} className={className} {...props}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback style={{ backgroundColor: avatarTint(seed ?? name) }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}


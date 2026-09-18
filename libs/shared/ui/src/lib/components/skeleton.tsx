import { cn } from '@org/utils';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Base skeleton primitive with smooth pulse animation and reduced-motion support.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      // aria-hidden: the surrounding region announces its own busy state.
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-muted motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

const AVATAR_SIZES = {
  xs: 'size-5 text-[10px]',
  sm: 'size-6 text-[11px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-16 text-xl',
} as const;

export interface SkeletonAvatarProps extends ComponentProps<'div'> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
}

/**
 * Avatar-shaped skeleton matching UserAvatar and WorkspaceAvatar geometry.
 */
export function SkeletonAvatar({
  size = 'md',
  shape = 'circle',
  className,
  ...props
}: SkeletonAvatarProps) {
  return (
    <Skeleton
      data-slot="skeleton-avatar"
      className={cn(
        'shrink-0',
        AVATAR_SIZES[size],
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        className,
      )}
      {...props}
    />
  );
}

const TEXT_SIZES = {
  xs: 'h-2.5',
  sm: 'h-3.5',
  base: 'h-4',
  lg: 'h-5',
} as const;

export interface SkeletonTextProps extends ComponentProps<'div'> {
  width?: string | number;
  size?: 'xs' | 'sm' | 'base' | 'lg';
}

/**
 * Typography-shaped skeleton line with varied width and rounded styling.
 */
export function SkeletonText({
  width,
  size = 'sm',
  className,
  style,
  ...props
}: SkeletonTextProps) {
  return (
    <Skeleton
      data-slot="skeleton-text"
      style={{ width, ...style }}
      className={cn(
        'rounded',
        TEXT_SIZES[size],
        !width && 'w-full',
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonRowProps extends ComponentProps<'div'> {
  leading?: 'avatar' | 'icon' | 'none' | ReactNode;
  avatarSize?: 'xs' | 'sm' | 'md';
  avatarShape?: 'circle' | 'rounded';
  lines?: 1 | 2 | 3;
  trailing?: 'none' | 'badge' | 'action' | 'counter';
}

/**
 * Composable list row skeleton matching sidebar nav rows and member lists.
 */
export function SkeletonRow({
  leading = 'none',
  avatarSize = 'sm',
  avatarShape = 'circle',
  lines = 1,
  trailing = 'none',
  className,
  ...props
}: SkeletonRowProps) {
  return (
    <div
      data-slot="skeleton-row"
      aria-hidden
      className={cn('gap-2.5 py-1.5 flex items-center rounded-xl', className)}
      {...props}
    >
      {leading === 'avatar' ? (
        <SkeletonAvatar size={avatarSize} shape={avatarShape} />
      ) : leading === 'icon' ? (
        <Skeleton className="size-4 shrink-0 rounded" />
      ) : leading !== 'none' ? (
        leading
      ) : null}

      <div className="min-w-0 gap-1 flex flex-1 flex-col justify-center">
        <SkeletonText size="sm" className="w-[65%]" />
        {lines >= 2 ? (
          <SkeletonText size="xs" className="w-[40%]" />
        ) : null}
        {lines >= 3 ? (
          <SkeletonText size="xs" className="w-[80%]" />
        ) : null}
      </div>

      {trailing === 'badge' ? (
        <Skeleton className="h-4 w-8 shrink-0 rounded-full" />
      ) : trailing === 'action' ? (
        <Skeleton className="size-5 shrink-0 rounded-md" />
      ) : trailing === 'counter' ? (
        <Skeleton className="size-4 shrink-0 rounded-full" />
      ) : null}
    </div>
  );
}

export interface SkeletonListProps extends ComponentProps<'div'> {
  rows?: number;
  /** Show a leading circle per row, for avatar/member lists. */
  withAvatar?: boolean;
}

/** Placeholder matching the shape of a dense list row. */
export function SkeletonList({
  rows = 5,
  withAvatar = false,
  className,
  ...props
}: SkeletonListProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('gap-3 flex flex-col', className)}
      {...props}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, index) => {
        // Natural staggered width variation
        const widths = ['w-[38%]', 'w-[48%]', 'w-[32%]', 'w-[56%]', 'w-[42%]'];
        const subWidths = ['w-[62%]', 'w-[75%]', 'w-[50%]', 'w-[68%]', 'w-[58%]'];
        return (
          <div key={index} className="gap-3 flex items-center">
            {withAvatar ? (
              <Skeleton className="size-8 shrink-0 rounded-full" />
            ) : null}
            <div className="min-w-0 gap-1.5 flex flex-1 flex-col">
              <Skeleton className={cn('h-3.5', widths[index % widths.length])} />
              <Skeleton className={cn('h-3', subWidths[index % subWidths.length])} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Skeleton for the Workspace Switcher trigger in the AppHeader or sidebar top.
 */
export function WorkspaceMenuSkeleton({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="workspace-menu-skeleton"
      aria-hidden
      className={cn(
        'group/workspace-header gap-1 flex w-full items-center justify-between',
        className,
      )}
      {...props}
    >
      <div className="gap-2 px-2 py-1 flex flex-1 items-center rounded-lg">
        <SkeletonAvatar size="sm" shape="rounded" className="shadow-2xs rounded-sm" />
        <div className="min-w-0 leading-tight flex flex-1 flex-col justify-center">
          <div className="gap-1.5 flex items-center">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="size-3.5 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeletons for sidebar channel lists matching navRowClass.
 */
export function ChannelNavSkeleton({
  rows = 4,
  className,
  ...props
}: ComponentProps<'div'> & { rows?: number }) {
  const titleWidths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36'];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading channels"
      className={cn('space-y-0.5 py-0.5', className)}
      {...props}
    >
      <span className="sr-only">Loading channels…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="gap-2.5 pl-2.5 pr-2 py-1.5 flex items-center rounded-xl min-h-[32px]"
        >
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className={cn('h-3.5 rounded', titleWidths[i % titleWidths.length])} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeletons for sidebar DM lists matching navRowClass.
 */
export function DirectMessagesNavSkeleton({
  rows = 4,
  className,
  ...props
}: ComponentProps<'div'> & { rows?: number }) {
  const titleWidths = ['w-28', 'w-36', 'w-24', 'w-32', 'w-20'];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading direct messages"
      className={cn('space-y-0.5 py-0.5', className)}
      {...props}
    >
      <span className="sr-only">Loading direct messages…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="gap-2.5 pl-2.5 pr-2 py-1.5 flex items-center rounded-xl min-h-[32px]"
        >
          <SkeletonAvatar size="xs" shape="circle" className="size-4 text-[8px]" />
          <Skeleton className={cn('h-3.5 rounded', titleWidths[i % titleWidths.length])} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeletons for sidebar resource items (AI Agents, Coworkers, Apps).
 */
export function ResourceNavSkeleton({
  rows = 3,
  shape = 'rounded',
  className,
  ...props
}: ComponentProps<'div'> & { rows?: number; shape?: 'circle' | 'rounded' }) {
  const titleWidths = ['w-28', 'w-32', 'w-24', 'w-36'];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading resources"
      className={cn('space-y-0.5 py-0.5', className)}
      {...props}
    >
      <span className="sr-only">Loading resources…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="gap-2.5 pl-2.5 pr-2 py-1.5 flex items-center rounded-xl min-h-[32px]"
        >
          <Skeleton className={cn('size-4 shrink-0', shape === 'circle' ? 'rounded-full' : 'rounded')} />
          <Skeleton className={cn('h-3.5 rounded', titleWidths[i % titleWidths.length])} />
        </div>
      ))}
    </div>
  );
}

export interface ChatHeaderSkeletonProps extends ComponentProps<'div'> {
  avatarShape?: 'circle' | 'rounded';
  avatarSize?: 'xs' | 'sm' | 'md';
  hasTabs?: boolean;
}

/**
 * Sticky chat header skeleton matching channels, DMs, agents, coworkers, and apps.
 * Preserves the exact min-h-12 and sticky layout to eliminate layout shifting.
 */
export function ChatHeaderSkeleton({
  avatarShape = 'circle',
  avatarSize = 'sm',
  hasTabs = true,
  className,
  ...props
}: ChatHeaderSkeletonProps) {
  return (
    <div
      data-slot="chat-header-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading conversation header"
      className={cn(
        'top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95 select-none',
        className,
      )}
      {...props}
    >
      <span className="sr-only">Loading conversation header…</span>
      <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
        {/* Left Side: Avatar/Icon + Title + Status/Badge */}
        <div className="min-w-0 gap-2.5 flex items-center">
          <SkeletonAvatar
            size={avatarSize}
            shape={avatarShape}
            className={avatarSize === 'sm' ? 'size-6' : 'size-7'}
          />
          <div className="gap-2 flex items-center">
            <Skeleton className="h-5 w-32 sm:w-44 rounded-md" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>

        {/* Right Side: Header actions */}
        <div className="gap-1 flex items-center">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </div>

      {/* Tabs strip */}
      {hasTabs ? (
        <div className="px-3 sm:px-6 h-9 flex items-center gap-4 border-t border-border/40">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Full chat conversation screen skeleton (Header + Messages Feed + Composer placeholder).
 */
export function ChatConversationSkeleton({
  avatarShape = 'circle',
  avatarSize = 'sm',
  hasTabs = true,
  className,
  ...props
}: ChatHeaderSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('min-h-0 flex flex-1 flex-col overflow-hidden bg-background text-foreground', className)}
      {...props}
    >
      <ChatHeaderSkeleton
        avatarShape={avatarShape}
        avatarSize={avatarSize}
        hasTabs={hasTabs}
      />

      {/* Message Feed Skeleton */}
      <div className="min-h-0 p-4 sm:p-6 flex flex-1 flex-col justify-end space-y-6 overflow-hidden">
        <div className="space-y-4">
          {/* Incoming message */}
          <div className="gap-3 flex items-start">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="space-y-1.5 flex-1 max-w-md">
              <div className="gap-2 flex items-center">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>

          {/* Outgoing message */}
          <div className="gap-3 flex items-start flex-row-reverse">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="space-y-1.5 flex-1 max-w-md items-end flex flex-col">
              <div className="gap-2 flex items-center">
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-3.5 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
          </div>

          {/* Incoming message */}
          <div className="gap-3 flex items-start">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="space-y-1.5 flex-1 max-w-sm">
              <div className="gap-2 flex items-center">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>
          </div>
        </div>

        {/* Composer Placeholder */}
        <div className="pt-2">
          <div className="h-12 w-full rounded-xl border border-border/60 bg-muted/20 px-3 flex items-center justify-between">
            <Skeleton className="h-3.5 w-48 rounded" />
            <div className="gap-1.5 flex items-center">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="size-6 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import { cn } from '@org/utils';
import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { ComponentProps } from 'react';

export function Breadcrumb(props: ComponentProps<'nav'>) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'gap-1.5 text-sm flex flex-wrap items-center break-words text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('gap-1.5 inline-flex items-center', className)}
      {...props}
    />
  );
}

export function BreadcrumbLink({
  className,
  asChild,
  ...props
}: ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'a';
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        'rounded-sm transition-colors duration-(--duration-fast) hover:text-foreground',
        'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
}

/** The final crumb: the current location, so it is not a link. */
export function BreadcrumbPage({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-medium text-foreground', className)}
      {...props}
    />
  );
}

export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

export function BreadcrumbEllipsis({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden
      className={cn('size-5 flex items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-3.5" />
      <span className="sr-only">More</span>
    </span>
  );
}

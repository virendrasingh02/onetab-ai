import { cn } from '@org/utils';
import type { ComponentProps } from 'react';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        // The white panel that sits on the grey app canvas. Hover lifts the
        // border a step rather than dropping a shadow: a card in a grid of
        // cards should not jump when the pointer crosses it.
        'flex flex-col rounded-card border border-border bg-card text-card-foreground',
        'transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'gap-1 p-4 pb-2 flex flex-col',
        'has-data-[slot=card-action]:grid has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-action]:items-start',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        'text-sm font-semibold tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('p-4 pt-2', className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('gap-2 p-4 pt-0 flex items-center', className)}
      {...props}
    />
  );
}

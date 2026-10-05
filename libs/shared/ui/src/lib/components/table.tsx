import { cn } from '@org/utils';
import type { ComponentProps } from 'react';
import { ScrollArea } from './scroll-area.js';

/**
 * Table primitives.
 *
 * `Table` wraps itself in a horizontal `ScrollArea` so a wide table scrolls
 * inside its own region instead of forcing the page sideways — and so the bar
 * it scrolls with is the same overlay bar as everywhere else, rather than a
 * 15px always-on gutter eating a row of the table on Windows.
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <ScrollArea data-slot="table-container" className="relative w-full">
      <table
        data-slot="table"
        className={cn('text-sm w-full caption-bottom', className)}
        {...props}
      />
    </ScrollArea>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'top-0 sticky z-10 bg-card/80 backdrop-blur-xs [&_tr]:border-b [&_tr]:border-border/40',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'font-medium border-t border-border/40 bg-muted/10 [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-border/40 transition-colors duration-(--duration-fast)',
        'hover:bg-muted/30 data-[state=selected]:bg-muted/50',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, scope = 'col', ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope={scope}
      data-slot="table-head"
      className={cn(
        'h-10 px-4 py-3 text-xs font-semibold text-left align-middle whitespace-nowrap text-muted-foreground/90 tracking-tight',
        '[&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-4 py-3.5 text-xs align-middle text-foreground',
        '[&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-3 text-xs text-subtle', className)}
      {...props}
    />
  );
}

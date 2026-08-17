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
        // Opaque, because it is sticky — rows scroll underneath it.
        'sticky top-0 z-10 bg-surface-muted [&_tr]:border-b [&_tr]:border-border',
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
        'border-t border-border bg-surface-muted font-medium [&>tr]:last:border-b-0',
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
        'h-10 border-b border-border transition-colors duration-(--duration-fast)',
        'hover:bg-accent data-[state=selected]:bg-selected',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
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
        'px-3 py-2 align-middle text-xs text-foreground',
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

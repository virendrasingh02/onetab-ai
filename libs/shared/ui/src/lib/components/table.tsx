import { cn } from '@org/utils';
import type { ComponentProps } from 'react';

/**
 * Table primitives.
 *
 * `Table` wraps itself in an `overflow-x-auto` container so a wide table
 * scrolls inside its own region instead of forcing the page sideways.
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="scrollbar-subtle relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('text-sm w-full caption-bottom', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('sticky top-0 z-10 bg-[#09090B] [&_tr]:border-b [&_tr]:border-[#27272A]', className)}
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
        'font-medium border-t border-[#27272A] bg-[#111113] [&>tr]:last:border-b-0',
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
        'h-[40px] border-b border-[#27272A] transition-colors duration-[120ms]',
        'hover:bg-[#1E1F23] data-[state=selected]:bg-[#23242A]',
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
        'h-[40px] px-3 text-xs font-medium text-left align-middle whitespace-nowrap text-[#71717A]',
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
        'px-3 py-2 align-middle text-xs text-[#FAFAFA]',
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
      className={cn('mt-3 text-xs text-[#71717A]', className)}
      {...props}
    />
  );
}

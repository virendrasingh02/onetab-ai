import { cn } from '@org/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from './button.js';

export interface PaginationProps extends ComponentProps<'nav'> {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showItemCount?: boolean;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  showItemCount = true,
  className,
  ...props
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = totalItems !== undefined && pageSize !== undefined ? (page - 1) * pageSize + 1 : undefined;
  const endItem =
    totalItems !== undefined && pageSize !== undefined
      ? Math.min(page * pageSize, totalItems)
      : undefined;

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn('flex flex-wrap items-center justify-between gap-4 py-2 text-xs', className)}
      {...props}
    >
      {/* Item info */}
      <div className="flex items-center gap-3 text-muted-foreground">
        {showItemCount && totalItems !== undefined && (
          <span>
            Showing <strong className="text-foreground">{startItem}</strong> to{' '}
            <strong className="text-foreground">{endItem}</strong> of{' '}
            <strong className="text-foreground">{totalItems}</strong> entries
          </span>
        )}
        {onPageSizeChange && pageSize !== undefined && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px] text-subtle">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-6 rounded-btn border border-border bg-surface px-1.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="Go to first page"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>

        <Button
          variant="outline"
          size="icon-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="flex size-6 items-center justify-center text-subtle">
                <MoreHorizontal className="size-3.5" />
              </span>
            ) : (
              <Button
                key={p}
                variant={page === p ? 'primary' : 'ghost'}
                size="icon-xs"
                onClick={() => onPageChange(p)}
                aria-current={page === p ? 'page' : undefined}
                className={cn('size-6 text-xs', page === p && 'font-semibold')}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <Button
          variant="outline"
          size="icon-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Go to next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>

        <Button
          variant="outline"
          size="icon-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Go to last page"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}

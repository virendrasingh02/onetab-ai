import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface AnalyticsDataTableProps<T> {
  title?: string;
  description?: string;
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKey?: keyof T | ((row: T) => string);
  pageSize?: number;
  onExportCsv?: () => void;
  headerActions?: ReactNode;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/**
 * Standardized Admin Data Table matching the reference design layout:
 * - Rounded-2xl card container with subtle borders
 * - Top header with title and rounded pill search input on right
 * - Clean table header with sort arrows and balanced padding
 * - High-contrast rows with status pills and formatted metrics
 * - Dedicated footer with entry count and pagination controls
 */
export function AnalyticsDataTable<T extends object = Record<string, unknown>>({
  title,
  description,
  data,
  columns,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Filter records...',
  searchKey,
  pageSize = 10,
  onExportCsv,
  headerActions,
  onRowClick,
  emptyMessage = 'No matching records found.',
}: AnalyticsDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Filter
  const filteredData = useMemo(() => {
    if (!search.trim() || !searchKey) return data;
    const q = search.toLowerCase();
    return data.filter((row) => {
      if (typeof searchKey === 'function') {
        return searchKey(row).toLowerCase().includes(q);
      }
      const val = row[searchKey as keyof T];
      return String(val ?? '').toLowerCase().includes(q);
    });
  }, [data, search, searchKey]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortCol) return filteredData;
    const col = columns.find((c) => c.id === sortCol);
    if (!col || !col.accessorKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[col.accessorKey!];
      const bVal = b[col.accessorKey!];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const res = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? res : -res;
    });
  }, [filteredData, sortCol, sortDirection, columns]);

  // Pagination
  const totalPages = Math.max(Math.ceil(sortedData.length / pageSize), 1);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = (colId: string) => {
    if (sortCol === colId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortCol(null);
      }
    } else {
      setSortCol(colId);
      setSortDirection('asc');
    }
  };

  return (
    <Card className="rounded-2xl border border-border/60 bg-card shadow-2xs overflow-hidden">
      {(title || searchable || headerActions || onExportCsv) && (
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border/40">
          <div>
            {title ? (
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                {title}
              </CardTitle>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {searchable ? (
              <div className="relative flex items-center">
                <Search className="size-3.5 text-muted-foreground/60 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-52 sm:w-64 rounded-full border border-border/60 bg-background/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-all"
                />
              </div>
            ) : null}

            {onExportCsv ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCsv}
                className="h-8 text-xs gap-1.5 rounded-lg border-border/60"
              >
                <Download className="size-3.5" />
                CSV
              </Button>
            ) : null}

            {headerActions}
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-transparent border-b border-border/40">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={cn(
                      'text-xs font-semibold py-3 px-5 text-muted-foreground/90 tracking-tight whitespace-nowrap',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left',
                      col.className,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 hover:text-foreground font-semibold transition-colors',
                          col.align === 'right' && 'ml-auto',
                          col.align === 'center' && 'mx-auto',
                        )}
                      >
                        <span>{col.header}</span>
                        {sortCol === col.id ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="size-3 text-foreground shrink-0" />
                          ) : (
                            <ArrowDown className="size-3 text-foreground shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40 hover:opacity-100 shrink-0" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border/40">
                    {columns.map((col) => (
                      <TableCell key={col.id} className="py-3.5 px-5">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-xs text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, idx) => (
                  <TableRow
                    key={idx}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-border/40 hover:bg-muted/30 transition-colors',
                      onRowClick ? 'cursor-pointer' : '',
                    )}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(
                          'text-xs py-3.5 px-5 align-middle',
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left',
                          col.className,
                        )}
                      >
                        {col.cell
                          ? col.cell(row)
                          : String(
                              col.accessorKey
                                ? row[col.accessorKey] ?? '—'
                                : '—',
                            )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 text-xs text-muted-foreground">
          <div>
            Showing{' '}
            <span className="font-semibold text-foreground">
              {sortedData.length === 0 ? 0 : (page - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-foreground">
              {Math.min(page * pageSize, sortedData.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-foreground">
              {sortedData.length}
            </span>{' '}
            entries
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="size-7 rounded-lg border border-border/60 bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

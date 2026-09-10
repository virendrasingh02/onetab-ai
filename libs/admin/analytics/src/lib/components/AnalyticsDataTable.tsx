import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SearchInput,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
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

export function AnalyticsDataTable<T extends object = Record<string, unknown>>({
  title,
  data,
  columns,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
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
    <Card className="overflow-hidden">
      {(title || searchable || headerActions || onExportCsv) && (
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b">
          {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
          <div className="flex flex-wrap items-center gap-2">
            {searchable && (
              <SearchInput
                placeholder={searchPlaceholder}
                value={search}
                onValueChange={(val: string) => {
                  setSearch(val);
                  setPage(1);
                }}
                className="h-8 text-xs w-48 sm:w-60"
              />
            )}
            {onExportCsv && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCsv}
                className="h-8 text-xs gap-1.5"
              >
                <Download className="size-3.5" />
                CSV
              </Button>
            )}
            {headerActions}
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={`text-xs font-semibold py-2.5 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
                        className="inline-flex items-center gap-1 hover:text-foreground font-semibold"
                      >
                        {col.header}
                        {sortCol === col.id ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
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
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.id} className="py-3">
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
                    className={
                      onRowClick
                        ? 'cursor-pointer hover:bg-muted/50 transition-colors'
                        : ''
                    }
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={`text-xs py-2.5 ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        } ${col.className || ''}`}
                      >
                        {col.cell
                          ? col.cell(row)
                          : String(
                              col.accessorKey ? row[col.accessorKey] ?? '—' : '—',
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-muted-foreground">
          <div>
            Showing{' '}
            <span className="font-medium text-foreground">
              {sortedData.length === 0 ? 0 : (page - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-foreground">
              {Math.min(page * pageSize, sortedData.length)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-foreground">
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
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

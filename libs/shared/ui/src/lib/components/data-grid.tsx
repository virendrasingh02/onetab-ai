import { useIsMobile } from '@org/hooks';
import { cn } from '@org/utils';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { EmptyState } from './empty-state.js';
import { Pagination } from './pagination.js';
import { Skeleton } from './skeleton.js';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataGridColumn<T> {
  id: string;
  header: string | ReactNode;
  accessorKey?: keyof T | string;
  cell?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  editable?: boolean;
  onCellEdit?: (row: T, newValue: any) => void;
}

export interface DataGridBulkAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  onClick: (selectedRows: T[]) => void;
}

export interface DataGridProps<T> {
  data: T[];
  columns: DataGridColumn<T>[];
  getRowId?: (row: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  bulkActions?: DataGridBulkAction<T>[];
  enableSelection?: boolean;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  enableColumnVisibility?: boolean;
  enableExport?: boolean;
  exportFilename?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
  title?: ReactNode;
  actionSlot?: ReactNode;
  onRefresh?: () => void;
  /**
   * How the grid renders on a phone-width screen.
   * - `auto` (default): a stacked card per row below `md`, the table from `md`
   *   up. Sorting moves to a "Sort" menu; search, selection, bulk actions,
   *   column visibility, export and pagination all keep working.
   * - `table`: always the table (it scrolls horizontally in its own region).
   * - `cards`: always the card layout.
   */
  mobileVariant?: 'auto' | 'table' | 'cards';
}

export function DataGrid<T extends Record<string, any>>({
  data,
  columns,
  getRowId = (row, idx) => row.id ?? `row-${idx}`,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records to display at this time.',
  bulkActions = [],
  enableSelection = true,
  enableSearch = true,
  searchPlaceholder = 'Search table...',
  enableColumnVisibility = true,
  enableExport = true,
  exportFilename = 'export',
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  className,
  title,
  actionSlot,
  onRefresh,
  mobileVariant = 'auto',
}: DataGridProps<T>) {
  const isMobile = useIsMobile();
  const showCards =
    mobileVariant === 'cards' || (mobileVariant === 'auto' && isMobile);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.id)),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 1. Filtering by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, searchQuery]);

  // 2. Sorting
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = column.accessorKey ? a[column.accessorKey] : a[column.id];
      const bVal = column.accessorKey ? b[column.accessorKey] : b[column.id];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // 3. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Row selection helpers
  const allCurrentPageIds = paginatedData.map((row, idx) => getRowId(row, idx));
  const isAllCurrentSelected =
    allCurrentPageIds.length > 0 &&
    allCurrentPageIds.every((id) => selectedIds.has(id));
  const isSomeCurrentSelected =
    allCurrentPageIds.some((id) => selectedIds.has(id)) &&
    !isAllCurrentSelected;

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllCurrentSelected) {
      allCurrentPageIds.forEach((id) => next.delete(id));
    } else {
      allCurrentPageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (colId: string) => {
    const next = new Set(visibleColumnIds);
    if (next.has(colId)) {
      if (next.size > 1) next.delete(colId);
    } else {
      next.add(colId);
    }
    setVisibleColumnIds(next);
  };

  const handleExportCSV = () => {
    const activeCols = columns.filter((c) => visibleColumnIds.has(c.id));
    const headerRow = activeCols.map((c) => `"${String(c.header)}"`).join(',');
    const rows = sortedData.map((row) =>
      activeCols
        .map((c) => {
          const val = c.accessorKey ? row[c.accessorKey] : row[c.id];
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headerRow, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${exportFilename}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedRows = data.filter((row, idx) =>
    selectedIds.has(getRowId(row, idx)),
  );

  const activeColumns = columns.filter((c) => visibleColumnIds.has(c.id));

  return (
    <div
      className={cn(
        'gap-3 p-4 flex flex-col rounded-card border border-border bg-surface shadow-xs',
        className,
      )}
    >
      {/* Header Toolbar */}
      <div className="gap-3 flex flex-wrap items-center justify-between">
        <div className="gap-3 flex items-center">
          {title && (
            <div className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </div>
          )}
          <Badge variant="secondary" className="font-mono text-meta">
            {filteredData.length} records
          </Badge>
        </div>

        <div className="gap-2 sm:flex-none flex flex-1 flex-wrap items-center justify-end">
          {enableSearch && (
            <div className="min-w-40 sm:w-64 sm:flex-none relative flex-1">
              <Search className="left-2.5 size-3.5 absolute top-1/2 -translate-y-1/2 text-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="h-8 theme-fixed pl-8 pr-3 text-xs w-full rounded-input border border-input bg-field text-foreground outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="right-2 absolute top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Card layout has no column headers to click, so sorting moves
              here. Hidden when the table is showing. */}
          {showCards && columns.some((c) => c.sortable) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<ArrowDownUp className="size-3.5" />}
                >
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns
                  .filter((c) => c.sortable)
                  .map((col) => {
                    const isSorted = sortColumn === col.id;
                    return (
                      <DropdownMenuItem
                        key={col.id}
                        onSelect={() => handleSort(col.id)}
                        className="justify-between"
                      >
                        <span className="truncate">
                          {typeof col.header === 'string' ? col.header : col.id}
                        </span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="size-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="size-3.5 text-primary" />
                          )
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                {sortColumn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setSortColumn(null);
                        setSortDirection(null);
                      }}
                    >
                      <X className="mr-2 size-3.5" />
                      Clear sort
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<Eye className="size-3.5" />}
                >
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visibleColumnIds.has(col.id)}
                    onCheckedChange={() => toggleColumnVisibility(col.id)}
                  >
                    {typeof col.header === 'string' ? col.header : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {enableExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              leadingIcon={<Download className="size-3.5" />}
            >
              Export
            </Button>
          )}

          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              aria-label="Refresh data"
              title="Refresh"
            >
              <RefreshCw
                className={cn('size-3.5', loading && 'animate-spin')}
              />
            </Button>
          )}

          {actionSlot}
        </div>
      </div>

      {/* Floating Bulk Actions Bar when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="gap-3 px-3 py-2 flex items-center justify-between rounded-md border border-primary/20 bg-selected">
          <div className="gap-2 text-xs font-medium flex items-center text-primary-text">
            <span className="size-5 font-bold flex items-center justify-center rounded-full bg-primary text-meta text-primary-foreground">
              {selectedIds.size}
            </span>
            <span>selected</span>
          </div>

          <div className="gap-1.5 flex items-center">
            {bulkActions.map((action) => (
              <Button
                key={action.id}
                size="xs"
                variant={action.variant ?? 'secondary'}
                leadingIcon={action.icon}
                onClick={() => action.onClick(selectedRows)}
              >
                {action.label}
              </Button>
            ))}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Render surface — a stacked card per row on phones, the table above. */}
      {showCards ? (
        <ul className="gap-2 flex flex-col">
          {loading ? (
            Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
              <li
                key={`skel-card-${i}`}
                className="p-3 rounded-md border border-border bg-surface"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-4 max-w-50 w-full" />
                <Skeleton className="mt-2 h-4 max-w-40 w-full" />
              </li>
            ))
          ) : paginatedData.length === 0 ? (
            <li className="py-10 rounded-md border border-border bg-surface">
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                size="sm"
              />
            </li>
          ) : (
            paginatedData.map((row, rIdx) => {
              const rowId = getRowId(row, (currentPage - 1) * pageSize + rIdx);
              const isSelected = selectedIds.has(rowId);
              return (
                <li key={rowId}>
                  <div
                    className={cn(
                      'gap-2 p-3 flex flex-col rounded-md border border-border bg-surface',
                      isSelected && 'bg-selected/40 ring-1 ring-primary/30',
                    )}
                  >
                    {enableSelection && (
                      <label className="gap-2 font-medium flex items-center text-meta text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(rowId)}
                          className="size-4 rounded cursor-pointer border-border accent-brand"
                        />
                        <span>{isSelected ? 'Selected' : 'Select'}</span>
                      </label>
                    )}
                    <dl className="gap-x-3 gap-y-1.5 text-xs grid grid-cols-[minmax(0,7.5rem)_1fr]">
                      {activeColumns.map((col) => {
                        const rawValue = col.accessorKey
                          ? row[col.accessorKey]
                          : row[col.id];
                        return (
                          <Fragment key={col.id}>
                            <dt className="truncate text-muted-foreground">
                              {typeof col.header === 'string'
                                ? col.header
                                : col.id}
                            </dt>
                            <dd className="min-w-0 wrap-break-word text-foreground/90">
                              {col.cell
                                ? col.cell(row, rIdx)
                                : String(rawValue ?? '—')}
                            </dd>
                          </Fragment>
                        );
                      })}
                    </dl>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      ) : (
        <div className="relative overflow-x-auto rounded-md border border-border">
          <table className="text-xs w-full border-collapse text-left">
            {/* Table Header */}
            <thead className="font-medium tracking-wider border-b border-border bg-surface-raised text-meta text-muted-foreground uppercase select-none">
              <tr>
                {enableSelection && (
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeCurrentSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="size-3.5 rounded cursor-pointer border-border accent-brand"
                    />
                  </th>
                )}
                {activeColumns.map((col) => {
                  const isSorted = sortColumn === col.id;
                  return (
                    <th
                      key={col.id}
                      style={{ width: col.width }}
                      className={cn(
                        'px-3 py-2.5 font-semibold text-foreground/80',
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left',
                        col.sortable &&
                          'cursor-pointer transition-colors hover:bg-accent/70 hover:text-foreground',
                      )}
                      onClick={() => col.sortable && handleSort(col.id)}
                    >
                      <div
                        className={cn(
                          'gap-1.5 flex items-center',
                          col.align === 'right'
                            ? 'justify-end'
                            : col.align === 'center'
                              ? 'justify-center'
                              : 'justify-start',
                        )}
                      >
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-subtle">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="size-3 text-primary" />
                              ) : (
                                <ArrowDown className="size-3 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border bg-surface">
              {loading ? (
                Array.from({ length: pageSize }).map((_, rIdx) => (
                  <tr key={`skel-${rIdx}`}>
                    {enableSelection && (
                      <td className="px-3 py-3 text-center">
                        <Skeleton className="size-3.5 mx-auto" />
                      </td>
                    )}
                    {activeColumns.map((col) => (
                      <td key={col.id} className="px-3 py-3">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumns.length + (enableSelection ? 1 : 0)}
                    className="py-12"
                  >
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                      size="sm"
                    />
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rIdx) => {
                  const rowId = getRowId(
                    row,
                    (currentPage - 1) * pageSize + rIdx,
                  );
                  const isSelected = selectedIds.has(rowId);

                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        'transition-colors duration-75 hover:bg-accent/40',
                        isSelected && 'bg-selected/40 hover:bg-selected/60',
                      )}
                    >
                      {enableSelection && (
                        <td className="w-10 px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(rowId)}
                            className="size-3.5 rounded cursor-pointer border-border accent-brand"
                          />
                        </td>
                      )}

                      {activeColumns.map((col) => {
                        const isEditing =
                          editingCell?.rowId === rowId &&
                          editingCell?.columnId === col.id;
                        const rawValue = col.accessorKey
                          ? row[col.accessorKey]
                          : row[col.id];

                        return (
                          <td
                            key={col.id}
                            style={{ width: col.width }}
                            className={cn(
                              'px-3 py-2.5 align-middle text-foreground/90',
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left',
                              col.editable && 'cursor-cell hover:bg-accent/60',
                            )}
                            onDoubleClick={() => {
                              if (col.editable) {
                                setEditingCell({ rowId, columnId: col.id });
                                setEditValue(String(rawValue ?? ''));
                              }
                            }}
                          >
                            {isEditing ? (
                              <div className="gap-1 flex items-center">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      col.onCellEdit?.(row, editValue);
                                      setEditingCell(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingCell(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    col.onCellEdit?.(row, editValue);
                                    setEditingCell(null);
                                  }}
                                  className="h-6 px-1.5 text-xs w-full rounded-sm border border-primary bg-surface text-foreground outline-none focus:ring-1 focus:ring-ring"
                                />
                              </div>
                            ) : col.cell ? (
                              col.cell(row, rIdx)
                            ) : (
                              <span className="truncate">
                                {String(rawValue ?? '—')}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && sortedData.length > 0 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={sortedData.length}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}

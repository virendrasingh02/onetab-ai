import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  SearchInput,
  Spinner,
} from '@org/ui';
import { cn } from '@org/utils';
import { ArrowDown, ArrowUp, RefreshCw, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useIntegrationActionQuery, useIntegrationMutations } from './use-integrations.js';

interface GSheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

interface SheetTab {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

interface GoogleSheetsModalProps {
  workspaceId: string;
  integrationId: string;
  accountEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleSheetsModal({
  workspaceId,
  integrationId,
  accountEmail,
  isOpen,
  onClose,
}: GoogleSheetsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<GSheetFile | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null);
  const isSearching = searchQuery.trim().length > 0;

  const listQuery = useIntegrationActionQuery<{ files: GSheetFile[] }>(
    workspaceId,
    integrationId,
    isSearching ? 'search_spreadsheets' : 'list_spreadsheets',
    isSearching ? { query: searchQuery.trim() } : {},
    { enabled: isOpen && !selectedSheet },
  );

  const structureQuery = useIntegrationActionQuery<{ title: string; tabs: SheetTab[] }>(
    workspaceId,
    integrationId,
    'get_spreadsheet',
    { spreadsheetId: selectedSheet?.id },
    { enabled: isOpen && !!selectedSheet },
  );

  const effectiveTab = activeTab ?? structureQuery.data?.tabs?.[0]?.title ?? null;

  const rangeQuery = useIntegrationActionQuery<{ range: string; rows: unknown[][] }>(
    workspaceId,
    integrationId,
    'get_range',
    { spreadsheetId: selectedSheet?.id, range: effectiveTab ?? undefined },
    { enabled: isOpen && !!selectedSheet && !!effectiveTab },
  );

  const { sync } = useIntegrationMutations(workspaceId);

  const [header, ...bodyRows] = rangeQuery.data?.rows ?? [];

  const visibleRows = useMemo(() => {
    let rows = bodyRows;
    if (filterText.trim()) {
      const needle = filterText.trim().toLowerCase();
      rows = rows.filter((row) => row.some((cell) => String(cell ?? '').toLowerCase().includes(needle)));
    }
    if (sort) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[sort.col] ?? '');
        const bv = String(b[sort.col] ?? '');
        const an = Number(av);
        const bn = Number(bv);
        const cmp = Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== '' ? an - bn : av.localeCompare(bv);
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [bodyRows, filterText, sort]);

  const toggleSort = (col: number) =>
    setSort((s) => (s?.col === col ? (s.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }));

  const reset = () => {
    setSelectedSheet(null);
    setActiveTab(null);
    setFilterText('');
    setSort(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate text-sm">
              Google Sheets{accountEmail ? ` — ${accountEmail}` : ''}
            </DialogTitle>
            {!selectedSheet ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Sync now"
                disabled={sync.isPending}
                onClick={() => sync.mutate(integrationId, { onSuccess: () => listQuery.refetch() })}
              >
                <RefreshCw className={cn('size-3.5', sync.isPending && 'animate-spin')} />
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {!selectedSheet ? (
          <div className="px-5 py-2.5 border-b border-border shrink-0">
            <SearchInput value={searchQuery} onValueChange={setSearchQuery} placeholder="Search spreadsheets…" className="h-7 text-xs" />
          </div>
        ) : (
          <div className="px-5 py-2 border-b border-border gap-2 flex items-center flex-wrap shrink-0">
            <button type="button" onClick={reset} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              ← Spreadsheets
            </button>
            <span className="text-xs font-semibold text-foreground">{selectedSheet.name}</span>
            {structureQuery.data?.tabs?.length ? (
              <div className="ml-1 gap-1 flex items-center">
                {structureQuery.data.tabs.map((t) => (
                  <button
                    key={t.sheetId}
                    type="button"
                    onClick={() => setActiveTab(t.title)}
                    className={cn(
                      'px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors',
                      (effectiveTab === t.title) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="ml-auto w-44">
              <Input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter rows…" className="h-7 text-xs" />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {!selectedSheet ? (
            listQuery.isLoading ? (
              <div className="p-8 flex justify-center">
                <Spinner label="Loading spreadsheets…" />
              </div>
            ) : listQuery.isError ? (
              <ErrorState
                title="Couldn't load your spreadsheets"
                description={listQuery.error instanceof Error ? listQuery.error.message : 'Please try again.'}
                onRetry={() => listQuery.refetch()}
              />
            ) : (listQuery.data?.files?.length ?? 0) === 0 ? (
              <EmptyState title="No spreadsheets found" description={isSearching ? 'No spreadsheets match your search.' : 'Create a sheet in Google Sheets to see it here.'} />
            ) : (
              <div className="divide-y divide-border">
                {(listQuery.data?.files ?? []).map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setSelectedSheet(sheet)}
                    className="w-full px-5 py-2.5 gap-3 flex items-center text-left transition-colors hover:bg-surface-inset"
                  >
                    <Table2 className="size-4 shrink-0 text-success-text" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{sheet.name}</span>
                      {sheet.modifiedTime ? (
                        <span className="text-[11px] text-muted-foreground">{new Date(sheet.modifiedTime).toLocaleDateString()}</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : rangeQuery.isLoading || structureQuery.isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner label="Loading sheet data…" />
            </div>
          ) : rangeQuery.isError ? (
            <ErrorState
              title="Couldn't load sheet data"
              description={rangeQuery.error instanceof Error ? rangeQuery.error.message : 'Please try again.'}
              onRetry={() => rangeQuery.refetch()}
            />
          ) : !header ? (
            <EmptyState title="This sheet is empty" description="No values were found in the selected tab." />
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-surface-inset">
                <tr>
                  {header.map((cell, col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border whitespace-nowrap">
                      <button type="button" onClick={() => toggleSort(col)} className="gap-1 flex items-center hover:text-primary">
                        {String(cell ?? '')}
                        {sort?.col === col ? sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-border/60 last:border-0 hover:bg-surface-inset/60">
                    {header.map((_, col) => (
                      <td key={col} className="px-3 py-1.5 whitespace-nowrap text-foreground/90">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

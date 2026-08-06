import type { ReportType } from '@org/types';
import { Button, StatCard } from '@org/ui';
import { cn } from '@org/utils';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DataTable,
  Panel,
  QueryState,
  RangePicker,
  RefreshButton,
  ViewHeader,
  ViewShell,
} from '@org/analytics-ui';
import {
  useReport,
  useReportDefinitions,
  useReportDownload,
} from './use-analytics.js';

/**
 * Report builder: pick a report, preview the exact table that will be
 * exported, then download it as CSV. The preview and the export come from the
 * same endpoint so they cannot disagree.
 */
export function ReportsView() {
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState<ReportType | null>(null);

  const definitions = useReportDefinitions();
  const report = useReport(selected, days);
  const download = useReportDownload();

  // Land on the first report so the screen is never an empty shell.
  useEffect(() => {
    if (!selected && definitions.data?.length) {
      setSelected(definitions.data[0].type);
    }
  }, [definitions.data, selected]);

  return (
    <ViewShell>
      <ViewHeader
        icon={<FileSpreadsheet />}
        accent="cyan"
        title="Reports"
        description="Generate and export workspace, usage and reliability reports"
        actions={
          <>
            <RangePicker days={days} onChange={setDays} />
            <RefreshButton
              onClick={() => report.refetch()}
              busy={report.isFetching}
            />
            <Button
              size="sm"
              disabled={!selected}
              loading={download.isPending}
              leadingIcon={<Download />}
              onClick={() =>
                selected && download.mutate({ type: selected, days })
              }
            >
              Export CSV
            </Button>
          </>
        }
      />

      <QueryState isLoading={definitions.isLoading} error={definitions.error}>
        <div className="gap-6 lg:grid-cols-4 grid grid-cols-1">
          {/*
            The picker is an exclusive choice, so it is exposed as a radio
            group with `aria-checked` rather than a row of unrelated buttons.
          */}
          <div
            role="radiogroup"
            aria-label="Report type"
            className="space-y-2 lg:col-span-1"
          >
            {(definitions.data ?? []).map((definition) => {
              const isSelected = selected === definition.type;
              return (
                <button
                  key={definition.type}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelected(definition.type)}
                  className={cn(
                    'p-3 w-full rounded-xl border text-left',
                    'transition-colors duration-(--duration-fast)',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                    isSelected
                      ? 'border-accent-cyan/40 bg-accent'
                      : 'bg-surface hover:border-border-strong',
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {definition.name}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {definition.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3">
            <QueryState
              isLoading={report.isLoading || !selected}
              error={report.error}
            >
              {report.data ? (
                <>
                  <div className="mb-6 gap-4 md:grid-cols-4 grid grid-cols-2">
                    {Object.entries(report.data.summary).map(([key, value]) => (
                      <StatCard key={key} label={key} value={String(value)} />
                    ))}
                  </div>

                  <Panel
                    title={report.data.name}
                    subtitle={`${report.data.rows.length} rows · ${
                      report.data.rangeDays
                    }-day range · generated ${new Date(
                      report.data.generatedAt,
                    ).toLocaleString()}`}
                  >
                    <DataTable
                      columns={report.data.columns}
                      rows={report.data.rows.map((row) =>
                        row.map((cell) => String(cell)),
                      )}
                      emptyMessage="This report has no rows for the selected range."
                    />
                  </Panel>

                  <div role="alert">
                    {download.isError ? (
                      <p className="mt-3 text-xs text-destructive">
                        Export failed:{' '}
                        {download.error instanceof Error
                          ? download.error.message
                          : 'unknown error'}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </QueryState>
          </div>
        </div>
      </QueryState>
    </ViewShell>
  );
}

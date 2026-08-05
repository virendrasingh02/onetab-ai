import type { ReportType } from '@org/types';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DataTable,
  Panel,
  QueryState,
  RangePicker,
  RefreshButton,
  ViewHeader,
  ViewShell,
} from './analytics-ui.js';
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
        icon={<FileSpreadsheet className="w-6 h-6 text-cyan-400" />}
        title="Reports"
        description="Generate and export workspace, usage and reliability reports"
        actions={
          <>
            <RangePicker days={days} onChange={setDays} />
            <RefreshButton
              onClick={() => report.refetch()}
              busy={report.isFetching}
            />
            <button
              type="button"
              disabled={!selected || download.isPending}
              onClick={() =>
                selected && download.mutate({ type: selected, days })
              }
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium flex items-center gap-1.5 transition"
            >
              {download.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Export CSV
            </button>
          </>
        }
      />

      <QueryState isLoading={definitions.isLoading} error={definitions.error}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-2 lg:col-span-1">
            {(definitions.data ?? []).map((definition) => (
              <button
                key={definition.type}
                type="button"
                onClick={() => setSelected(definition.type)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selected === definition.type
                    ? 'bg-slate-800/80 border-cyan-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <p className="text-sm font-semibold text-slate-100">
                  {definition.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {definition.description}
                </p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            <QueryState
              isLoading={report.isLoading || !selected}
              error={report.error}
            >
              {report.data ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {Object.entries(report.data.summary).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-slate-900/60 border border-slate-800 rounded-xl p-4"
                      >
                        <p className="text-lg font-bold text-white truncate">
                          {String(value)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {key}
                        </p>
                      </div>
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

                  {download.isError ? (
                    <p className="text-xs text-red-400 mt-3">
                      Export failed:{' '}
                      {download.error instanceof Error
                        ? download.error.message
                        : 'unknown error'}
                    </p>
                  ) : null}
                </>
              ) : null}
            </QueryState>
          </div>
        </div>
      </QueryState>
    </ViewShell>
  );
}

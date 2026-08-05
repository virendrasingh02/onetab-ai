import { Files, HardDrive, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  Breakdown,
  DataTable,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RangePicker,
  RefreshButton,
  ViewHeader,
  ViewShell,
  formatBytes,
  formatNumber,
  formatRelative,
} from './analytics-ui.js';
import { useStorageAnalytics } from './use-analytics.js';

/** Capacity planning: what is stored, by whom, and how fast it is growing. */
export function StorageAnalyticsView() {
  const [days, setDays] = useState(30);
  const query = useStorageAnalytics(days);
  const data = query.data;

  const nearQuota = (data?.usedPct ?? 0) >= 80;

  return (
    <ViewShell>
      <ViewHeader
        icon={<HardDrive className="w-6 h-6 text-emerald-400" />}
        title="Storage Analytics"
        description="File storage breakdown, growth and capacity planning"
        actions={
          <>
            <RangePicker days={days} onChange={setDays} />
            <RefreshButton
              onClick={() => query.refetch()}
              busy={query.isFetching}
            />
          </>
        }
      />

      <QueryState isLoading={query.isLoading} error={query.error}>
        {data ? (
          <>
            <Panel className="mb-6">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    Total storage used
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatNumber(data.totalFiles)} files across the workspace
                  </p>
                </div>
                <span className="text-lg font-bold text-white">
                  {formatBytes(data.totalBytes)}
                  <span className="text-xs text-slate-400 font-normal">
                    {' '}
                    / {formatBytes(data.quotaBytes)}
                  </span>
                </span>
              </div>
              <ProgressBar
                pct={data.usedPct}
                color={
                  nearQuota
                    ? 'from-amber-600 to-red-500'
                    : 'from-emerald-600 to-cyan-500'
                }
              />
              <p
                className={`text-xs mt-2 ${
                  nearQuota ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {data.usedPct}% of quota used —{' '}
                {formatBytes(Math.max(0, data.quotaBytes - data.totalBytes))}{' '}
                available
                {nearQuota ? ' · approaching the limit' : ''}
              </p>
            </Panel>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                label="Files stored"
                value={data.totalFiles}
                icon={Files}
                color="bg-blue-600/20 text-blue-400"
              />
              <MetricCard
                label="Total size"
                value={formatBytes(data.totalBytes)}
                icon={HardDrive}
                color="bg-emerald-600/20 text-emerald-400"
              />
              <MetricCard
                label={`Uploaded · ${days}d`}
                value={data.growthSeries.reduce(
                  (sum, point) => sum + point.value,
                  0,
                )}
                icon={TrendingUp}
                color="bg-amber-600/20 text-amber-400"
              />
              <MetricCard
                label="Contributors"
                value={data.topUploaders.length}
                icon={Users}
                color="bg-purple-600/20 text-purple-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title={`Upload volume · last ${days} days`}
                subtitle="Files added per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.growthSeries}
                  color="from-emerald-600 to-cyan-500"
                  valueLabel="files"
                />
              </Panel>

              <Panel title="By file type" subtitle="Share of bytes stored">
                <Breakdown
                  slices={data.byType}
                  formatValue={formatBytes}
                  emptyMessage="No files uploaded yet."
                />
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Largest files" subtitle="Prime candidates for cleanup">
                <DataTable
                  columns={['File', 'Type', 'Size', 'Added']}
                  rows={data.largestFiles.map((file) => [
                    <span
                      className="text-slate-100 font-medium block max-w-[220px] truncate"
                      title={file.filename}
                    >
                      {file.filename}
                    </span>,
                    <span className="text-slate-500">{file.mimeType}</span>,
                    formatBytes(file.sizeBytes),
                    formatRelative(file.createdAt),
                  ])}
                  emptyMessage="No files uploaded yet."
                />
              </Panel>

              <Panel title="Top uploaders" subtitle="Bytes contributed per member">
                <DataTable
                  columns={['Member', 'Files', 'Size']}
                  rows={data.topUploaders.map((uploader) => [
                    <span className="text-slate-100 font-medium">
                      {uploader.name}
                    </span>,
                    formatNumber(uploader.files),
                    formatBytes(uploader.bytes),
                  ])}
                  emptyMessage="Nobody has uploaded a file yet."
                />
              </Panel>
            </div>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}

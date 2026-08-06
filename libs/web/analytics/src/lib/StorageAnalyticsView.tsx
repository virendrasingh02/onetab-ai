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
} from '@org/analytics-ui';
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
        icon={<HardDrive />}
        accent="green"
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
              <div className="gap-3 mb-4 flex flex-wrap items-end justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Total storage used
                  </h3>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    {formatNumber(data.totalFiles)} files across the workspace
                  </p>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {formatBytes(data.totalBytes)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {' '}
                    / {formatBytes(data.quotaBytes)}
                  </span>
                </span>
              </div>
              <ProgressBar
                pct={data.usedPct}
                accent={nearQuota ? 'amber' : 'green'}
              />
              <p
                className={`text-xs mt-2 ${
                  nearQuota ? 'text-warning' : 'text-muted-foreground'
                }`}
              >
                {data.usedPct}% of quota used —{' '}
                {formatBytes(Math.max(0, data.quotaBytes - data.totalBytes))}{' '}
                available
                {nearQuota ? ' · approaching the limit' : ''}
              </p>
            </Panel>

            <div className="md:grid-cols-4 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Files stored"
                value={data.totalFiles}
                icon={Files}
                accent="blue"
              />
              <MetricCard
                label="Total size"
                value={formatBytes(data.totalBytes)}
                icon={HardDrive}
                accent="green"
              />
              <MetricCard
                label={`Uploaded · ${days}d`}
                value={data.growthSeries.reduce(
                  (sum, point) => sum + point.value,
                  0,
                )}
                icon={TrendingUp}
                accent="amber"
              />
              <MetricCard
                label="Contributors"
                value={data.topUploaders.length}
                icon={Users}
                accent="violet"
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
              <Panel
                title={`Upload volume · last ${days} days`}
                subtitle="Files added per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.growthSeries}
                  accent="green"
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

            <div className="lg:grid-cols-2 gap-6 grid grid-cols-1">
              <Panel
                title="Largest files"
                subtitle="Prime candidates for cleanup"
              >
                <DataTable
                  columns={['File', 'Type', 'Size', 'Added']}
                  rows={data.largestFiles.map((file) => [
                    <span
                      className="font-medium block max-w-[220px] truncate text-foreground"
                      title={file.filename}
                    >
                      {file.filename}
                    </span>,
                    <span className="text-muted-foreground">
                      {file.mimeType}
                    </span>,
                    formatBytes(file.sizeBytes),
                    formatRelative(file.createdAt),
                  ])}
                  emptyMessage="No files uploaded yet."
                />
              </Panel>

              <Panel
                title="Top uploaders"
                subtitle="Bytes contributed per member"
              >
                <DataTable
                  columns={['Member', 'Files', 'Size']}
                  rows={data.topUploaders.map((uploader) => [
                    <span className="font-medium text-foreground">
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

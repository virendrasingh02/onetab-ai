import type { AdminAnalyticsFilter } from '@org/types';
import { Card } from '@org/ui';
import { FileText, HardDrive, Layers, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AnalyticsAreaChart,
  AnalyticsDataTable,
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
  type ColumnDef,
} from '../components/index.js';
import { useAdminStorageAnalytics } from '../use-admin-analytics.js';

type StorageByWorkspaceRow = {
  workspaceId: string;
  workspaceName: string;
  filesCount: number;
  bytes: number;
};

export function StorageAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminStorageAnalytics(filter);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const mimeColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

  const typeDonut =
    data?.filesByType.map((item, idx) => ({
      name: item.label,
      value: item.value,
      color: mimeColors[idx % mimeColors.length],
    })) || [];

  const columns: ColumnDef<StorageByWorkspaceRow>[] = [
    {
      id: 'name',
      header: 'Workspace',
      accessorKey: 'workspaceName',
      sortable: true,
      cell: (row) => (
        <Link
          to={`/analytics/workspaces/${row.workspaceId}`}
          className="font-semibold text-foreground hover:underline"
        >
          {row.workspaceName}
        </Link>
      ),
    },
    {
      id: 'files',
      header: 'Total Files',
      accessorKey: 'filesCount',
      sortable: true,
      align: 'right',
      cell: (row) => row.filesCount.toLocaleString(),
    },
    {
      id: 'size',
      header: 'Storage Used',
      accessorKey: 'bytes',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-semibold">{formatBytes(row.bytes)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Storage & File Utilization"
        description="Monitor object storage growth, file type distributions (images, documents, archives), and highest consuming workspaces."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="storage"
        filter={filter}
      />

      <AnalyticsFilterBar
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Storage</span>
            <HardDrive className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.storageUsedBytes ? formatBytes(data.storageUsedBytes) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            MinIO / S3 bucket utilization
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Uploads</span>
            <FileText className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalFiles?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Uploaded: {data?.filesUploaded?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Growth</span>
            <TrendingUp className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            +{data?.growthPct ?? 0}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Compared to previous period
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Average File Size</span>
            <Layers className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.averageFileSizeBytes ? formatBytes(data.averageFileSizeBytes) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Per attachment upload
          </div>
        </Card>
      </div>

      {/* Storage Growth & Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Storage Consumption Growth"
            description="Accumulated storage over time"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.storageGrowth?.length}
            height={320}
          >
            <AnalyticsAreaChart
              data={data?.storageGrowth || []}
              xAxisKey="date"
              series={[
                { dataKey: 'value', name: 'Total Storage', color: '#3b82f6' },
              ]}
              valueFormatter={formatBytes}
              height={320}
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="File Types Breakdown"
            description="Storage distribution by file category"
            isLoading={isLoading}
            isError={isError}
            isEmpty={typeDonut.length === 0}
            height={320}
          >
            <AnalyticsDonutChart
              data={typeDonut}
              valueFormatter={formatBytes}
              centerLabel="Storage"
              centerValue={formatBytes(data?.storageUsedBytes || 0)}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Largest Workspaces Table */}
      <div>
        <AnalyticsDataTable
          title="Top Workspaces by Storage Volume"
          data={(data?.storageByWorkspace || []) as StorageByWorkspaceRow[]}
          columns={columns as ColumnDef<StorageByWorkspaceRow>[]}
          isLoading={isLoading}
          searchKey="workspaceName"
          searchPlaceholder="Search workspace..."
          emptyMessage="No workspace storage data recorded."
        />
      </div>
    </div>
  );
}

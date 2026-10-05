import {
  AreaChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Link } from 'react-router-dom';
import {
  AdminMetricCard,
  AnalyticsDataTable,
  AnalyticsFilterBar,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminStorageAnalytics } from '../use-admin-analytics.js';

type StorageByWorkspaceRow = {
  workspaceId: string;
  workspaceName: string;
  filesCount: number;
  bytes: number;
};

export function StorageAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminStorageAnalytics(filter);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const mimeColors = ['blue', 'green', 'violet', 'amber', 'pink', 'var(--muted-foreground)'];

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
        state={filterState}
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Total Storage"
          subtitle="Volume & Bucket Capacity"
          value={data?.storageUsedBytes ? formatBytes(data.storageUsedBytes) : '—'}
          badgeText={`+${data?.growthPct ?? 0}%`}
          badgeType="positive"
          secondaryText="MinIO / S3 utilization"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Total Uploads"
          subtitle="Asset Registry"
          value={data?.totalFiles?.toLocaleString() ?? '—'}
          badgeText="+10.2%"
          badgeType="positive"
          secondaryText={`Uploaded: ${data?.filesUploaded?.toLocaleString() ?? 0} files`}
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Growth Rate"
          subtitle="Expansion Run-Rate"
          value={`+${data?.growthPct ?? 0}%`}
          badgeText={`+${data?.growthPct ?? 0}%`}
          badgeType="positive"
          secondaryText="Storage runway healthy"
          sparklineColor="amber"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Average File Size"
          subtitle="Payload Benchmark"
          value={data?.averageFileSizeBytes ? formatBytes(data.averageFileSizeBytes) : '—'}
          badgeText="Optimized"
          badgeType="positive"
          secondaryText="Per attachment upload"
          sparklineColor="emerald"
          isLoading={isLoading}
        />
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
            <AreaChart
              data={data?.storageGrowth || []}
              xAxisKey="date"
              series={[
                { dataKey: 'value', name: 'Total Storage', color: 'blue' },
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
            <DonutChart
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

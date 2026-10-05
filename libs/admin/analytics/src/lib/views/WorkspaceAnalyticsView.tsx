import type { AdminWorkspaceAnalyticsRow } from '@org/types';
import {
  Badge,
  Button,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdminMetricCard,
  AnalyticsDataTable,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminWorkspaceAnalytics } from '../use-admin-analytics.js';

export function WorkspaceAnalyticsView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } =
    useAdminWorkspaceAnalytics({
      page,
      pageSize: 15,
      search: search || undefined,
      status: tierFilter !== 'ALL' ? tierFilter : undefined,
    });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const columns: ColumnDef<AdminWorkspaceAnalyticsRow>[] = [
    {
      id: 'name',
      header: 'Workspace',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground truncate max-w-[180px]">
            {row.name}
          </span>
          <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
            /{row.slug}
          </span>
        </div>
      ),
    },
    {
      id: 'tier',
      header: 'Plan',
      accessorKey: 'subscriptionPlan',
      sortable: true,
      cell: (row) => {
        const variant =
          row.subscriptionPlan === 'ENTERPRISE'
            ? 'secondary'
            : row.subscriptionPlan === 'PRO'
            ? 'primary'
            : 'outline';
        return <Badge variant={variant} className="text-xs">{row.subscriptionPlan}</Badge>;
      },
    },
    {
      id: 'members',
      header: 'Members',
      accessorKey: 'usersCount',
      sortable: true,
      align: 'right',
      cell: (row) => row.usersCount.toLocaleString(),
    },
    {
      id: 'activeUsers',
      header: 'Active',
      accessorKey: 'activeUsersCount',
      sortable: true,
      align: 'right',
      cell: (row) => row.activeUsersCount.toLocaleString(),
    },
    {
      id: 'messages',
      header: 'Messages',
      accessorKey: 'messagesCount',
      sortable: true,
      align: 'right',
      cell: (row) => row.messagesCount.toLocaleString(),
    },
    {
      id: 'storage',
      header: 'Storage',
      accessorKey: 'storageBytes',
      sortable: true,
      align: 'right',
      cell: (row) => formatBytes(row.storageBytes),
    },
    {
      id: 'lastActive',
      header: 'Last Active',
      accessorKey: 'lastActivityAt',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="text-muted-foreground text-[11px]">
          {row.lastActivityAt
            ? new Date(row.lastActivityAt).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'center',
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/analytics/workspaces/${row.id}`);
          }}
          title="Drill down"
        >
          <ExternalLink className="size-3.5" />
        </Button>
      ),
    },
  ];

  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Workspace Intelligence"
        description="Directory of all active and inactive workspaces, membership counts, channels, storage utilization, and subscription tiers."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="workspaces"
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Total Workspaces"
          subtitle="Tenant Organizations"
          value={summary?.totalWorkspaces?.toLocaleString() ?? '—'}
          badgeText="+18.4%"
          badgeType="positive"
          secondaryText="Registered enterprise orgs"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Active Workspaces"
          subtitle="Monthly Concurrency"
          value={summary?.activeWorkspaces?.toLocaleString() ?? '—'}
          badgeText="+9.1%"
          badgeType="positive"
          secondaryText="Active in last 30 days"
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Total Revenue"
          subtitle="MRR & Platform Billings"
          value={`$${summary?.totalRevenue?.toLocaleString() ?? '0'}`}
          badgeText="+15.3%"
          badgeType="positive"
          secondaryText="Across all active tiers"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Storage Consumed"
          subtitle="Volume & Attachments"
          value={formatBytes(summary?.totalStorageBytes ?? 0)}
          badgeText="+6.8%"
          badgeType="positive"
          secondaryText="Media & document blobs"
          sparklineColor="amber"
          isLoading={isLoading}
        />
      </div>

      {/* Filter and search row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search workspace by name or slug..."
            value={search}
            onValueChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            className="w-64 h-9 text-xs"
          />

          <Select
            value={tierFilter}
            onValueChange={(val) => {
              setTierFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Tier Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Tiers</SelectItem>
              <SelectItem value="FREE" className="text-xs">Free</SelectItem>
              <SelectItem value="PRO" className="text-xs">Pro</SelectItem>
              <SelectItem value="ENTERPRISE" className="text-xs">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          Click any row to view full workspace analytics.
        </p>
      </div>

      {/* Workspaces Table */}
      <div>
        <AnalyticsDataTable
          title="All Workspaces"
          data={(data?.items || []) as AdminWorkspaceAnalyticsRow[]}
          columns={columns as ColumnDef<AdminWorkspaceAnalyticsRow>[]}
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/analytics/workspaces/${row.id}`)}
          pageSize={15}
          emptyMessage="No workspaces matched your search."
        />
      </div>
    </div>
  );
}

import type { AdminWorkspaceAnalyticsRow } from '@org/types';
import {
  Badge,
  Button,
  Card,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import {
  Building2,
  Database,
  DollarSign,
  ExternalLink,
  HardDrive,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Workspaces</span>
            <Building2 className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {summary?.totalWorkspaces?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Registered organizations
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Active (30d)</span>
            <Database className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {summary?.activeWorkspaces?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Workspaces with recent activity
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Revenue</span>
            <DollarSign className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            ${summary?.totalRevenue?.toLocaleString() ?? '0'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Across all accounts
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Storage Consumed</span>
            <HardDrive className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {formatBytes(summary?.totalStorageBytes ?? 0)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Files & attachments
          </div>
        </Card>
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

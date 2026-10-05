import {
  AreaChart,
  ChartContainer,
} from '@org/analytics-ui';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@org/ui';
import {
  ArrowLeft,
  Laptop,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AdminMetricCard,
  AnalyticsFilterBar,
  AnalyticsHeader,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminWorkspaceDetailAnalytics } from '../use-admin-analytics.js';

export function WorkspaceDetailAnalyticsView() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminWorkspaceDetailAnalytics(workspaceId, filter);

  const ws = data?.overview;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (isError || !ws) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-destructive font-semibold">
          Workspace could not be found or failed to load.
        </p>
        <Button variant="outline" onClick={() => navigate('/analytics/workspaces')}>
          <ArrowLeft className="size-4 mr-2" />
          Back to Workspaces
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/analytics/workspaces')}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Workspaces
        </Button>
      </div>

      <AnalyticsHeader
        title={ws.name}
        description={`Organization slug: /${ws.slug} • Created: ${new Date(ws.createdAt).toLocaleDateString()}`}
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType={`workspace-${workspaceId}`}
        filter={filter}
        extraActions={
          <Badge
            variant={
              ws.plan === 'ENTERPRISE'
                ? 'secondary'
                : ws.plan === 'PRO'
                ? 'primary'
                : 'outline'
            }
            className="text-xs px-2.5 py-0.5"
          >
            {ws.plan} Plan
          </Badge>
        }
      />

      <AnalyticsFilterBar
        state={filterState}
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Total Members"
          subtitle="Seat Allocation"
          value={ws.userCount.toLocaleString()}
          badgeText="+11.2%"
          badgeType="positive"
          secondaryText={`Active: ${ws.activeUsers.toLocaleString()} members`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Messages Sent"
          subtitle="Internal Comms Velocity"
          value={data?.communication?.messagesSent?.toLocaleString() ?? '0'}
          badgeText="+14.5%"
          badgeType="positive"
          secondaryText={`Channels: ${data?.communication?.channelMessages?.toLocaleString() ?? 0} · DMs: ${data?.communication?.directMessages?.toLocaleString() ?? 0}`}
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Storage Used"
          subtitle="Quota Headroom"
          value={formatBytes(ws.storageBytes)}
          badgeText="+5.3%"
          badgeType="positive"
          secondaryText={`Uploads: ${data?.files?.uploads?.toLocaleString() ?? 0} files`}
          sparklineColor="amber"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Revenue Generated"
          subtitle="Subscription Tier"
          value={`$${ws.revenue?.toLocaleString() ?? '0'}`}
          badgeText={data?.revenue?.billingStatus ?? 'Active'}
          badgeType="positive"
          secondaryText={`Plan: ${ws.plan || 'Enterprise'}`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />
      </div>

      {/* Message Growth & Storage Growth Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Message Growth Trend"
          description="Messages exchanged over selected timeframe"
          isLoading={isLoading}
          isError={isError}
          isEmpty={!data?.communication?.messageGrowth?.length}
          height={280}
        >
          <AreaChart
            data={data?.communication?.messageGrowth || []}
            xAxisKey="date"
            series={[
              { dataKey: 'value', name: 'Messages', color: 'violet' },
            ]}
            height={280}
          />
        </ChartContainer>

        <ChartContainer
          title="Storage Growth Trend"
          description="Accumulated storage over time"
          isLoading={isLoading}
          isError={isError}
          isEmpty={!data?.files?.storageGrowth?.length}
          height={280}
        >
          <AreaChart
            data={data?.files?.storageGrowth || []}
            xAxisKey="date"
            series={[
              { dataKey: 'value', name: 'Storage Bytes', color: 'blue' },
            ]}
            valueFormatter={formatBytes}
            height={280}
          />
        </ChartContainer>
      </div>

      {/* Workspace Members Table */}
      <Card className="p-4">
        <CardHeader className="p-0 pb-3 border-b mb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Workspace Members ({data?.users?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {(!data?.users || data.users.length === 0) ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No members found.
            </p>
          ) : (
            data.users.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{m.name || m.email}</span>
                  {m.name && (
                    <span className="text-[11px] text-muted-foreground">
                      {m.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {m.role}
                  </Badge>
                  {m.platform && (
                    <Badge variant="outline" className="text-[9px] gap-1">
                      <Laptop className="size-2.5" />
                      {m.platform}
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-[11px]">
                    {m.lastActiveAt
                      ? new Date(m.lastActiveAt).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

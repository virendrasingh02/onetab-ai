import {
  Badge,
  Card,
  CardContent,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import {
  Activity,
  AlertTriangle,
  Building,
  HardDrive,
  Key,
  Laptop,
  LogIn,
  Plug,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnalyticsHeader } from '../components/index.js';
import { useAdminLiveActivity } from '../use-admin-analytics.js';

function getActivityIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'USER_REGISTERED':
    case 'USER_ACTIVE':
      return <LogIn className="size-4 text-accent-blue" />;
    case 'WORKSPACE_CREATED':
      return <Building className="size-4 text-success" />;
    case 'FILE_UPLOADED':
      return <HardDrive className="size-4 text-accent-cyan" />;
    case 'API_SPIKE':
      return <Plug className="size-4 text-accent-violet" />;
    case 'SUBSCRIPTION_CREATED':
    case 'PAYMENT_SUCCESS':
      return <Key className="size-4 text-warning" />;
    default:
      return <Activity className="size-4 text-muted-foreground" />;
  }
}

export function LiveActivityView() {
  const [isLive, setIsLive] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data: items, isLoading, refetch, isFetching, dataUpdatedAt } =
    useAdminLiveActivity(isLive);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      if (typeFilter !== 'ALL' && item.type.toUpperCase() !== typeFilter.toUpperCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const userEmail = (item.metadata?.userEmail as string) || '';
        const wsName = (item.metadata?.workspaceName as string) || '';
        const matchesEmail = userEmail.toLowerCase().includes(q);
        const matchesWs = wsName.toLowerCase().includes(q);
        return matchesTitle || matchesEmail || matchesWs;
      }
      return true;
    });
  }, [items, typeFilter, search]);

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Live Platform Activity Stream"
        description="Real-time chronological telemetry feed of user logins, workspace activities, attachments, and integrations."
        lastUpdated={dataUpdatedAt}
        isLive={isLive}
        onToggleLive={() => setIsLive((prev) => !prev)}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="live-activity"
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-card/60 backdrop-blur-xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search activity by title, user, or workspace..."
            value={search}
            onValueChange={(val) => setSearch(val)}
            className="h-8 text-xs w-64 sm:w-80"
          />

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Activity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
              <SelectItem value="USER_ACTIVE" className="text-xs">User Activity</SelectItem>
              <SelectItem value="WORKSPACE_CREATED" className="text-xs">Workspaces Created</SelectItem>
              <SelectItem value="FILE_UPLOADED" className="text-xs">File Uploads</SelectItem>
              <SelectItem value="MESSAGE_POSTED" className="text-xs">Messages Posted</SelectItem>
              <SelectItem value="PAYMENT_SUCCESS" className="text-xs">Billing & Payments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Showing <strong>{filteredItems.length}</strong> events
          </span>
        </div>
      </div>

      {/* Stream List */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading platform activity stream...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Activity className="size-8 mx-auto opacity-40" />
              <p className="font-medium">No activity matching your filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item) => {
                const userEmail = item.metadata?.userEmail as string | undefined;
                const workspaceName = item.metadata?.workspaceName as string | undefined;
                const platform = item.metadata?.platform as string | undefined;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 p-3.5 hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      {getActivityIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-foreground">
                            {item.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                            {item.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-muted-foreground text-xs">
                          {item.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        {userEmail && (
                          <span className="flex items-center gap-1">
                            <User className="size-3" />
                            {userEmail}
                          </span>
                        )}

                        {workspaceName && (
                          <span className="flex items-center gap-1">
                            <Building className="size-3" />
                            {workspaceName}
                          </span>
                        )}

                        {platform && platform !== 'UNKNOWN' && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 gap-1">
                            <Laptop className="size-2.5" />
                            {platform}
                          </Badge>
                        )}

                        {item.severity === 'critical' && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1 gap-1">
                            <AlertTriangle className="size-2.5" />
                            Critical
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

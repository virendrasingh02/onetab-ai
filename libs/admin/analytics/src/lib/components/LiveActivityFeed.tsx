import type { AdminLiveActivityItem } from '@org/types';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  AlertTriangle,
  Building,
  HardDrive,
  Info,
  Key,
  Laptop,
  LogIn,
  Plug,
  Radio,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface LiveActivityFeedProps {
  items?: AdminLiveActivityItem[];
  isLoading?: boolean;
  maxItems?: number;
  showViewAll?: boolean;
  className?: string;
}

function getActivityIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'USER_REGISTERED':
    case 'USER_ACTIVE':
      return <LogIn className="size-3.5 text-accent-blue" />;
    case 'WORKSPACE_CREATED':
      return <Building className="size-3.5 text-success" />;
    case 'FILE_UPLOADED':
      return <HardDrive className="size-3.5 text-accent-cyan" />;
    case 'API_SPIKE':
      return <Plug className="size-3.5 text-accent-violet" />;
    case 'SUBSCRIPTION_CREATED':
    case 'PAYMENT_SUCCESS':
      return <Key className="size-3.5 text-warning" />;
    default:
      return <Activity className="size-3.5 text-muted-foreground" />;
  }
}

export function LiveActivityFeed({
  items,
  isLoading = false,
  maxItems = 10,
  showViewAll = false,
  className,
}: LiveActivityFeedProps) {
  const displayedItems = (items || []).slice(0, maxItems);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4 border-b">
        <div className="flex items-center gap-2">
          <Radio className="size-3.5 text-success animate-pulse" />
          <CardTitle className="text-base font-semibold">Live Activity</CardTitle>
        </div>
        {showViewAll && (
          <Link
            to="/analytics/live"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all stream
          </Link>
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[420px]">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-full shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <Info className="size-6 mx-auto mb-2 opacity-50" />
            No recent platform activity recorded.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedItems.map((item) => {
              const timeString = new Date(item.timestamp).toLocaleTimeString(
                undefined,
                { hour: '2-digit', minute: '2-digit', second: '2-digit' },
              );

              const userEmail = item.metadata?.userEmail as string | undefined;
              const workspaceName = item.metadata?.workspaceName as string | undefined;
              const platform = item.metadata?.platform as string | undefined;

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors text-xs"
                >
                  <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {getActivityIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeString}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-muted-foreground truncate text-[11px]">
                        {item.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                      {userEmail && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="size-2.5" />
                          <span className="truncate max-w-[120px]">
                            {userEmail}
                          </span>
                        </span>
                      )}

                      {workspaceName && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Building className="size-2.5" />
                          <span className="truncate max-w-[100px]">
                            {workspaceName}
                          </span>
                        </span>
                      )}

                      {platform && platform !== 'UNKNOWN' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1 font-normal h-4 gap-0.5"
                        >
                          <Laptop className="size-2" />
                          {platform}
                        </Badge>
                      )}

                      {item.severity === 'critical' && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] py-0 px-1 h-4 gap-0.5"
                        >
                          <AlertTriangle className="size-2" />
                          Alert
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
  );
}

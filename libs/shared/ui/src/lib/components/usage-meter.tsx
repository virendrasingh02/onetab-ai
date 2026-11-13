import type React from 'react';
import { cn } from '@org/utils';
import { Button } from './button.js';
import { AlertCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { ResourceUsageMetric } from '@org/types';

export interface UsageMeterProps {
  metric: ResourceUsageMetric;
  icon?: React.ElementType;
  onUpgradeClick?: () => void;
  className?: string;
  showUpgradeButton?: boolean;
}

export function UsageMeter({
  metric,
  icon: Icon,
  onUpgradeClick,
  className,
  showUpgradeButton = true,
}: UsageMeterProps) {
  const isUnlimited = metric.limit === -1;
  const isExceeded = metric.isLimitReached;
  const isWarning = metric.isNearLimit && !isExceeded;

  let barColorClass = 'bg-primary';
  if (isExceeded) {
    barColorClass = 'bg-destructive';
  } else if (isWarning) {
    barColorClass = 'bg-warning';
  }

  const formattedUsed =
    metric.unit === 'bytes'
      ? formatStorageBytes(metric.used)
      : metric.used.toLocaleString();

  const formattedLimit = isUnlimited
    ? 'Unlimited'
    : metric.unit === 'bytes'
      ? formatStorageBytes(metric.limit)
      : metric.limit.toLocaleString();

  return (
    <div
      className={cn(
        'p-4 space-y-3 shadow-2xs rounded-xl border border-border/80 bg-card',
        isExceeded && 'border-destructive/30 bg-destructive/5',
        isWarning && 'border-warning/30 bg-warning/5',
        className,
      )}
    >
      <div className="gap-2 flex items-center justify-between">
        <div className="gap-2 min-w-0 flex items-center">
          {Icon ? (
            <Icon className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className="text-xs font-semibold truncate text-foreground">
            {metric.label}
          </span>
        </div>
        <div className="text-xs font-medium shrink-0 text-foreground">
          <span>{formattedUsed}</span>
          <span className="font-normal text-muted-foreground">
            {' '}
            / {formattedLimit}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      {!isUnlimited ? (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                barColorClass,
              )}
              style={{ width: `${Math.min(100, metric.percentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-meta text-muted-foreground">
            <span>{metric.percentage}% utilized</span>
            {isExceeded ? (
              <span className="gap-1 font-semibold flex items-center text-destructive">
                <AlertCircle className="size-3" />
                Limit reached
              </span>
            ) : isWarning ? (
              <span className="gap-1 font-medium flex items-center text-warning-text">
                <AlertTriangle className="size-3" />
                Near limit
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-xs flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium text-primary">
            ✓ Unlimited quota
          </span>
        </div>
      )}

      {/* Contextual Warning & Upgrade CTA */}
      {(isExceeded || isWarning) && showUpgradeButton && onUpgradeClick ? (
        <div className="pt-1 gap-2 flex items-center justify-between">
          <p className="leading-tight text-meta text-muted-foreground">
            {isExceeded
              ? 'Upgrade to continue without interruption.'
              : 'Approaching plan quota limit.'}
          </p>
          <Button
            variant={isExceeded ? 'destructive' : 'outline'}
            size="xs"
            onClick={onUpgradeClick}
            className="font-semibold h-6 px-2 shrink-0 text-meta"
          >
            <span>Upgrade</span>
            <ArrowUpRight className="size-3 ml-0.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatStorageBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

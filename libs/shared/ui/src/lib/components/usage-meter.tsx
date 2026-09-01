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

  const formattedUsed = metric.unit === 'bytes'
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
        'rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs',
        isExceeded && 'border-destructive/30 bg-destructive/5',
        isWarning && 'border-warning/30 bg-warning/5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
          <span className="text-xs font-semibold text-foreground truncate">
            {metric.label}
          </span>
        </div>
        <div className="text-xs font-medium text-foreground shrink-0">
          <span>{formattedUsed}</span>
          <span className="text-muted-foreground font-normal"> / {formattedLimit}</span>
        </div>
      </div>

      {/* Progress Track */}
      {!isUnlimited ? (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColorClass)}
              style={{ width: `${Math.min(100, metric.percentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{metric.percentage}% utilized</span>
            {isExceeded ? (
              <span className="flex items-center gap-1 font-semibold text-destructive">
                <AlertCircle className="size-3" />
                Limit reached
              </span>
            ) : isWarning ? (
              <span className="flex items-center gap-1 font-medium text-warning-text">
                <AlertTriangle className="size-3" />
                Near limit
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="text-xs font-medium text-primary">✓ Unlimited quota</span>
        </div>
      )}

      {/* Contextual Warning & Upgrade CTA */}
      {(isExceeded || isWarning) && showUpgradeButton && onUpgradeClick ? (
        <div className="pt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground leading-tight">
            {isExceeded
              ? 'Upgrade to continue without interruption.'
              : 'Approaching plan quota limit.'}
          </p>
          <Button
            variant={isExceeded ? 'destructive' : 'outline'}
            size="xs"
            onClick={onUpgradeClick}
            className="text-[11px] font-semibold shrink-0 h-6 px-2"
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

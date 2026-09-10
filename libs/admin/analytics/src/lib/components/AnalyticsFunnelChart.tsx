import { cn } from '@org/utils';
import { ArrowDown, Users } from 'lucide-react';

export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  dropOffPercentage?: number;
}

export interface AnalyticsFunnelChartProps {
  stages: FunnelStage[];
  height?: number | string;
  className?: string;
}

export function AnalyticsFunnelChart({
  stages,
  className,
}: AnalyticsFunnelChartProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className={cn('flex flex-col gap-3 py-2 w-full', className)}>
      {stages.map((stage, idx) => {
        const widthPct = Math.max((stage.count / maxCount) * 100, 8);
        const prevStage = idx > 0 ? stages[idx - 1] : null;
        const dropOff =
          prevStage && prevStage.count > 0
            ? Math.round(((prevStage.count - stage.count) / prevStage.count) * 100)
            : 0;

        return (
          <div key={stage.name} className="flex flex-col gap-1">
            {idx > 0 && (
              <div className="flex items-center gap-1.5 pl-6 text-[11px] text-muted-foreground">
                <ArrowDown className="size-3 text-destructive" />
                <span className="text-destructive font-medium">-{dropOff}%</span>
                <span>drop-off from {prevStage?.name}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-28 sm:w-36 shrink-0 text-xs font-medium truncate flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" />
                {stage.name}
              </div>
              <div className="flex-1 relative flex items-center bg-muted/30 rounded-md h-8 overflow-hidden p-1">
                <div
                  className="h-full rounded bg-primary/80 transition-all duration-500 flex items-center px-2.5"
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="text-xs font-semibold text-primary-foreground">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-14 text-right text-xs font-semibold text-muted-foreground">
                {stage.percentage}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
